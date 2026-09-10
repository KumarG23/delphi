import type { VercelRequest, VercelResponse } from '@vercel/node';

import { plaidRequest } from '../../lib/server/plaid';
import { classifyPlaidAccount } from '../../lib/server/plaid-account-map';
import { requireUser, supabaseAdmin } from '../../lib/server/supabase';

type ExchangeResponse = { access_token: string; item_id: string };
type PlaidAccount = {
  account_id: string;
  name: string;
  official_name: string | null;
  mask: string | null;
  type: string;
  subtype: string | null;
  balances: {
    available: number | null;
    current: number | null;
    iso_currency_code: string | null;
  };
};
type AccountsResponse = { accounts: PlaidAccount[] };
type PlaidItemRow = { id: string };
type ExistingPlaidAccountRow = {
  plaid_account_id: string;
  delphi_account_id: string | null;
};
type DelphiAccountRow = { id: string };
type SnapshotRow = { id: string };

type Body = {
  public_token?: string;
  institution_id?: string | null;
  institution_name?: string | null;
};

async function ensureDelphiAccount(
  userId: string,
  plaidAccount: PlaidAccount,
  institutionName: string | null,
  existingDelphiAccountId?: string | null,
): Promise<string> {
  if (existingDelphiAccountId) return existingDelphiAccountId;

  const classification = classifyPlaidAccount(plaidAccount.type, plaidAccount.subtype);
  const created = await supabaseAdmin<DelphiAccountRow[]>('accounts', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      name: plaidAccount.official_name || plaidAccount.name,
      category: classification.category,
      type: classification.type,
      institution: institutionName,
      currency: plaidAccount.balances.iso_currency_code || 'USD',
      is_active: true,
    }),
  });

  const id = created[0]?.id;
  if (!id) throw new Error('Delphi account was not created');
  return id;
}

async function saveBalanceSnapshot(
  userId: string,
  delphiAccountId: string,
  balance: number | null,
): Promise<boolean> {
  if (balance === null || !Number.isFinite(balance)) return false;

  const snapshotDate = new Date().toISOString().slice(0, 10);
  const snapshotPayload = {
    user_id: userId,
    account_id: delphiAccountId,
    snapshot_date: snapshotDate,
    balance,
    entered_at: new Date().toISOString(),
    is_active: true,
    notes: 'Synced from Plaid',
  };

  // Do not rely on PostgREST upsert conflict inference here. The initial Plaid
  // implementation successfully created/mapped accounts but the snapshot upsert
  // could fail after Link had already succeeded. An explicit read + update/insert
  // keeps this operation idempotent and makes the success boundary clearer.
  const existing = await supabaseAdmin<SnapshotRow[]>(
    `balance_snapshots?account_id=eq.${encodeURIComponent(delphiAccountId)}&snapshot_date=eq.${encodeURIComponent(snapshotDate)}&select=id&limit=1`,
  );

  if (existing[0]?.id) {
    await supabaseAdmin(
      `balance_snapshots?id=eq.${encodeURIComponent(existing[0].id)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          balance,
          entered_at: snapshotPayload.entered_at,
          is_active: true,
          notes: snapshotPayload.notes,
        }),
      },
    );
    return true;
  }

  await supabaseAdmin('balance_snapshots', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(snapshotPayload),
  });
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const { public_token, institution_id, institution_name } = (req.body ?? {}) as Body;
    if (!public_token) return res.status(400).json({ error: 'public_token required' });

    const exchanged = await plaidRequest<ExchangeResponse>('/item/public_token/exchange', {
      public_token,
    });

    const items = await supabaseAdmin<PlaidItemRow[]>('plaid_items?on_conflict=item_id', {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        user_id: user.id,
        item_id: exchanged.item_id,
        access_token: exchanged.access_token,
        institution_id: institution_id ?? null,
        institution_name: institution_name ?? null,
        status: 'active',
        last_error_code: null,
        last_error_message: null,
      }),
    });

    const plaidItem = items[0];
    if (!plaidItem?.id) throw new Error('Plaid Item was not stored');

    const accountResponse = await plaidRequest<AccountsResponse>('/accounts/get', {
      access_token: exchanged.access_token,
    });

    const existingRows = await supabaseAdmin<ExistingPlaidAccountRow[]>(
      `plaid_accounts?user_id=eq.${encodeURIComponent(user.id)}&plaid_item_id=eq.${encodeURIComponent(plaidItem.id)}&select=plaid_account_id,delphi_account_id`,
    );
    const existingByPlaidId = new Map(
      existingRows.map((row) => [row.plaid_account_id, row.delphi_account_id]),
    );

    const now = new Date().toISOString();
    const storedAccounts = [];
    const warnings: string[] = [];

    for (const account of accountResponse.accounts) {
      const delphiAccountId = await ensureDelphiAccount(
        user.id,
        account,
        institution_name ?? null,
        existingByPlaidId.get(account.account_id),
      );

      await supabaseAdmin('plaid_accounts?on_conflict=user_id,plaid_account_id', {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          user_id: user.id,
          plaid_item_id: plaidItem.id,
          plaid_account_id: account.account_id,
          delphi_account_id: delphiAccountId,
          name: account.name,
          official_name: account.official_name,
          mask: account.mask,
          type: account.type,
          subtype: account.subtype,
          iso_currency_code: account.balances.iso_currency_code,
          current_balance: account.balances.current,
          available_balance: account.balances.available,
          last_balance_at: now,
          is_active: true,
        }),
      });

      let balance_saved = false;
      try {
        balance_saved = await saveBalanceSnapshot(
          user.id,
          delphiAccountId,
          account.balances.current,
        );
      } catch (error) {
        // A balance snapshot is secondary to the bank-link operation. Do not
        // report the entire Plaid connection as failed after the Item/account
        // have already been securely stored and mapped.
        console.error('Plaid balance snapshot error', error);
        warnings.push(`Could not save the initial balance for account ${account.account_id}.`);
      }

      storedAccounts.push({
        plaid_account_id: account.account_id,
        delphi_account_id: delphiAccountId,
        name: account.name,
        official_name: account.official_name,
        mask: account.mask,
        type: account.type,
        subtype: account.subtype,
        current_balance: account.balances.current,
        available_balance: account.balances.available,
        iso_currency_code: account.balances.iso_currency_code,
        balance_saved,
      });
    }

    return res.status(200).json({
      item_id: exchanged.item_id,
      accounts: storedAccounts,
      warnings,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error('Plaid token exchange error', error);
    return res.status(500).json({ error: 'Could not finish Plaid connection.' });
  }
}
