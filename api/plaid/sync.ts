import type { VercelRequest, VercelResponse } from '@vercel/node';

import { plaidRequest } from '../../lib/server/plaid';
import {
  normalizePlaidTransaction,
  type PlaidTransactionLike,
} from '../../lib/server/plaid-transactions';
import { requireUser, supabaseAdmin } from '../../lib/server/supabase';

type PlaidItemRow = {
  id: string;
  access_token: string;
  transactions_cursor: string | null;
};

type PlaidAccountRow = {
  plaid_account_id: string;
  delphi_account_id: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
  type: 'expense' | 'income';
};

type RemovedTransaction = { transaction_id: string };

type TransactionsSyncResponse = {
  added: PlaidTransactionLike[];
  modified: PlaidTransactionLike[];
  removed: RemovedTransaction[];
  next_cursor: string;
  has_more: boolean;
};

type ItemSyncResult = {
  item_id: string;
  added: number;
  modified: number;
  removed: number;
  skipped: number;
  success: boolean;
  error?: string;
};

function categoryKey(type: 'expense' | 'income', name: string): string {
  return `${type}:${name.toLowerCase()}`;
}

async function loadPages(item: PlaidItemRow): Promise<{
  added: PlaidTransactionLike[];
  modified: PlaidTransactionLike[];
  removed: RemovedTransaction[];
  nextCursor: string;
}> {
  let cursor = item.transactions_cursor ?? undefined;
  const added: PlaidTransactionLike[] = [];
  const modified: PlaidTransactionLike[] = [];
  const removed: RemovedTransaction[] = [];
  let hasMore = true;

  while (hasMore) {
    const response = await plaidRequest<TransactionsSyncResponse>('/transactions/sync', {
      access_token: item.access_token,
      ...(cursor ? { cursor } : {}),
      count: 500,
      options: { personal_finance_category_version: 'v2' },
    });

    added.push(...response.added);
    modified.push(...response.modified);
    removed.push(...response.removed);
    cursor = response.next_cursor;
    hasMore = response.has_more;
  }

  if (!cursor) throw new Error('Plaid did not return a transaction cursor');
  return { added, modified, removed, nextCursor: cursor };
}

async function markRemoved(userId: string, transactionId: string): Promise<void> {
  await supabaseAdmin(
    `transactions?user_id=eq.${encodeURIComponent(userId)}&source=eq.plaid&external_id=eq.${encodeURIComponent(transactionId)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        is_active: false,
        updated_at: new Date().toISOString(),
      }),
    },
  );
}

async function syncItem(
  userId: string,
  item: PlaidItemRow,
  accountMap: Map<string, string>,
  categories: Map<string, string>,
): Promise<ItemSyncResult> {
  try {
    // Fetch every page before persisting the new cursor. If pagination fails,
    // the stored cursor remains unchanged and a retry can safely start over.
    const pages = await loadPages(item);
    const rows = [];
    let skipped = 0;

    for (const plaidTransaction of [...pages.added, ...pages.modified]) {
      const normalized = normalizePlaidTransaction(plaidTransaction);
      const delphiAccountId = accountMap.get(normalized.plaidAccountId);
      if (!delphiAccountId) {
        skipped += 1;
        continue;
      }

      const categoryType = normalized.kind === 'income' ? 'income' : 'expense';
      const categoryId = normalized.categoryName
        ? categories.get(categoryKey(categoryType, normalized.categoryName)) ?? null
        : null;

      rows.push({
        user_id: userId,
        account_id: delphiAccountId,
        transaction_date: normalized.transactionDate,
        amount: normalized.amount,
        kind: normalized.kind,
        merchant: normalized.merchant,
        category_id: categoryId,
        description: normalized.description,
        notes: normalized.notes,
        source: 'plaid',
        external_id: normalized.externalId,
        is_active: true,
        updated_at: new Date().toISOString(),
      });
    }

    if (rows.length > 0) {
      await supabaseAdmin('transactions?on_conflict=user_id,source,external_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      });
    }

    for (const removed of pages.removed) {
      await markRemoved(userId, removed.transaction_id);
    }

    await supabaseAdmin(`plaid_items?id=eq.${encodeURIComponent(item.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        transactions_cursor: pages.nextCursor,
        last_synced_at: new Date().toISOString(),
        last_error_code: null,
        last_error_message: null,
      }),
    });

    return {
      item_id: item.id,
      added: pages.added.length,
      modified: pages.modified.length,
      removed: pages.removed.length,
      skipped,
      success: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Plaid sync error';
    console.error('Plaid transaction sync item error', item.id, error);

    try {
      await supabaseAdmin(`plaid_items?id=eq.${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          last_error_message: message.slice(0, 500),
        }),
      });
    } catch (statusError) {
      console.error('Could not save Plaid sync error state', statusError);
    }

    return {
      item_id: item.id,
      added: 0,
      modified: 0,
      removed: 0,
      skipped: 0,
      success: false,
      error: message,
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const userId = encodeURIComponent(user.id);

    const [items, plaidAccounts, categoryRows] = await Promise.all([
      supabaseAdmin<PlaidItemRow[]>(
        `plaid_items?user_id=eq.${userId}&status=eq.active&select=id,access_token,transactions_cursor`,
      ),
      supabaseAdmin<PlaidAccountRow[]>(
        `plaid_accounts?user_id=eq.${userId}&is_active=eq.true&select=plaid_account_id,delphi_account_id`,
      ),
      supabaseAdmin<CategoryRow[]>(
        `categories?user_id=eq.${userId}&is_active=eq.true&select=id,name,type`,
      ),
    ]);

    if (items.length === 0) {
      return res.status(200).json({
        linked_items: 0,
        successful_items: 0,
        failed_items: 0,
        added: 0,
        modified: 0,
        removed: 0,
        skipped: 0,
        results: [],
      });
    }

    const accountMap = new Map<string, string>();
    for (const account of plaidAccounts) {
      if (account.delphi_account_id) {
        accountMap.set(account.plaid_account_id, account.delphi_account_id);
      }
    }

    const categories = new Map(
      categoryRows.map((category) => [
        categoryKey(category.type, category.name),
        category.id,
      ]),
    );

    const results: ItemSyncResult[] = [];
    for (const item of items) {
      results.push(await syncItem(user.id, item, accountMap, categories));
    }

    const totals = results.reduce(
      (sum, result) => ({
        added: sum.added + result.added,
        modified: sum.modified + result.modified,
        removed: sum.removed + result.removed,
        skipped: sum.skipped + result.skipped,
      }),
      { added: 0, modified: 0, removed: 0, skipped: 0 },
    );

    return res.status(200).json({
      linked_items: items.length,
      successful_items: results.filter((result) => result.success).length,
      failed_items: results.filter((result) => !result.success).length,
      ...totals,
      results,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error('Plaid transaction sync error', error);
    return res.status(500).json({ error: 'Could not sync Plaid transactions.' });
  }
}
