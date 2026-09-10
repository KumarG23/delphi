import { refreshPlaidItemBalances } from './plaid-balance';
import { plaidRequest } from './plaid';
import {
  normalizePlaidTransaction,
  type PlaidTransactionLike,
} from './plaid-transactions';
import { supabaseAdmin } from './supabase';

export const PLAID_WEBHOOK_URL =
  process.env.PLAID_WEBHOOK_URL ?? 'https://delphi.sharma-house.com/api/plaid/webhook';

export type PlaidItemRow = {
  id: string;
  user_id: string;
  item_id: string;
  access_token: string;
  transactions_cursor: string | null;
};

type PlaidAccountRow = {
  plaid_item_id: string;
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

type ItemGetResponse = {
  item: {
    item_id: string;
    webhook: string | null;
  };
};

export type ItemSyncResult = {
  item_id: string;
  added: number;
  modified: number;
  removed: number;
  skipped: number;
  balances_refreshed: number;
  balance_snapshots_saved: number;
  success: boolean;
  balance_warning?: string;
  error?: string;
};

export type PlaidSyncResult = {
  linked_items: number;
  successful_items: number;
  failed_items: number;
  added: number;
  modified: number;
  removed: number;
  skipped: number;
  balances_refreshed: number;
  balance_snapshots_saved: number;
  results: ItemSyncResult[];
};

function categoryKey(type: 'expense' | 'income', name: string): string {
  return `${type}:${name.toLowerCase()}`;
}

async function ensureWebhook(item: PlaidItemRow): Promise<void> {
  const current = await plaidRequest<ItemGetResponse>('/item/get', {
    access_token: item.access_token,
  });

  if (current.item.webhook === PLAID_WEBHOOK_URL) return;

  await plaidRequest('/item/webhook/update', {
    access_token: item.access_token,
    webhook: PLAID_WEBHOOK_URL,
  });
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

async function loadContext(userId: string): Promise<{
  plaidAccounts: PlaidAccountRow[];
  accountMap: Map<string, string>;
  categories: Map<string, string>;
}> {
  const encodedUserId = encodeURIComponent(userId);
  const [plaidAccounts, categoryRows] = await Promise.all([
    supabaseAdmin<PlaidAccountRow[]>(
      `plaid_accounts?user_id=eq.${encodedUserId}&is_active=eq.true&select=plaid_item_id,plaid_account_id,delphi_account_id`,
    ),
    supabaseAdmin<CategoryRow[]>(
      `categories?user_id=eq.${encodedUserId}&is_active=eq.true&select=id,name,type`,
    ),
  ]);

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

  return { plaidAccounts, accountMap, categories };
}

async function advanceCursor(item: PlaidItemRow, nextCursor: string): Promise<void> {
  // Use optimistic cursor advancement. If another webhook/manual sync already
  // moved this Item forward, this PATCH matches no rows and cannot overwrite a
  // newer cursor with an older one.
  const cursorFilter = item.transactions_cursor
    ? `eq.${encodeURIComponent(item.transactions_cursor)}`
    : 'is.null';

  await supabaseAdmin(
    `plaid_items?id=eq.${encodeURIComponent(item.id)}&transactions_cursor=${cursorFilter}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        transactions_cursor: nextCursor,
        last_synced_at: new Date().toISOString(),
        last_error_code: null,
        last_error_message: null,
      }),
    },
  );
}

export async function syncPlaidItem(
  item: PlaidItemRow,
  accountMap: Map<string, string>,
  categories: Map<string, string>,
): Promise<ItemSyncResult> {
  try {
    // Keep the Item's configured webhook current. New Items receive the webhook
    // during Link; this also upgrades Items that predate webhook support.
    await ensureWebhook(item);

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
        user_id: item.user_id,
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
      await markRemoved(item.user_id, removed.transaction_id);
    }

    // Keep balances and Delphi snapshots current whenever the Item is synced.
    // This uses Plaid's free cached Accounts data; a balance refresh failure is
    // secondary to transaction correctness and should not prevent cursor advance.
    let balancesRefreshed = 0;
    let balanceSnapshotsSaved = 0;
    let balanceWarning: string | undefined;
    try {
      const balanceResult = await refreshPlaidItemBalances({
        userId: item.user_id,
        plaidItemId: item.id,
        accessToken: item.access_token,
      });
      balancesRefreshed = balanceResult.refreshed;
      balanceSnapshotsSaved = balanceResult.snapshots_saved;
    } catch (balanceError) {
      balanceWarning = balanceError instanceof Error
        ? balanceError.message
        : 'Could not refresh cached Plaid balances';
      console.error('Plaid balance refresh error', item.id, balanceError);
    }

    await advanceCursor(item, pages.nextCursor);

    return {
      item_id: item.id,
      added: pages.added.length,
      modified: pages.modified.length,
      removed: pages.removed.length,
      skipped,
      balances_refreshed: balancesRefreshed,
      balance_snapshots_saved: balanceSnapshotsSaved,
      success: true,
      ...(balanceWarning ? { balance_warning: balanceWarning } : {}),
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
      balances_refreshed: 0,
      balance_snapshots_saved: 0,
      success: false,
      error: message,
    };
  }
}

function summarize(results: ItemSyncResult[]): PlaidSyncResult {
  const totals = results.reduce(
    (sum, result) => ({
      added: sum.added + result.added,
      modified: sum.modified + result.modified,
      removed: sum.removed + result.removed,
      skipped: sum.skipped + result.skipped,
      balances_refreshed: sum.balances_refreshed + result.balances_refreshed,
      balance_snapshots_saved: sum.balance_snapshots_saved + result.balance_snapshots_saved,
    }),
    {
      added: 0,
      modified: 0,
      removed: 0,
      skipped: 0,
      balances_refreshed: 0,
      balance_snapshots_saved: 0,
    },
  );

  return {
    linked_items: results.length,
    successful_items: results.filter((result) => result.success).length,
    failed_items: results.filter((result) => !result.success).length,
    ...totals,
    results,
  };
}

export async function syncPlaidItemsForUser(
  userId: string,
  delphiAccountId?: string,
): Promise<PlaidSyncResult> {
  const encodedUserId = encodeURIComponent(userId);
  const [allItems, context] = await Promise.all([
    supabaseAdmin<PlaidItemRow[]>(
      `plaid_items?user_id=eq.${encodedUserId}&status=eq.active&select=id,user_id,item_id,access_token,transactions_cursor`,
    ),
    loadContext(userId),
  ]);

  const targetItemIds = delphiAccountId
    ? new Set(
        context.plaidAccounts
          .filter((account) => account.delphi_account_id === delphiAccountId)
          .map((account) => account.plaid_item_id),
      )
    : null;

  const items = targetItemIds
    ? allItems.filter((item) => targetItemIds.has(item.id))
    : allItems;

  const results: ItemSyncResult[] = [];
  for (const item of items) {
    results.push(await syncPlaidItem(item, context.accountMap, context.categories));
  }
  return summarize(results);
}

export async function syncPlaidItemByExternalId(itemId: string): Promise<ItemSyncResult | null> {
  const items = await supabaseAdmin<PlaidItemRow[]>(
    `plaid_items?item_id=eq.${encodeURIComponent(itemId)}&status=eq.active&select=id,user_id,item_id,access_token,transactions_cursor&limit=1`,
  );
  const item = items[0];
  if (!item) return null;

  const context = await loadContext(item.user_id);
  return syncPlaidItem(item, context.accountMap, context.categories);
}
