import { plaidRequest } from './plaid';
import { supabaseAdmin } from './supabase';

type AccountsResponse = {
  accounts: Array<{
    account_id: string;
    balances: {
      available: number | null;
      current: number | null;
      iso_currency_code: string | null;
    };
  }>;
};

type PlaidAccountRow = {
  id: string;
  plaid_account_id: string;
  delphi_account_id: string | null;
};

type SnapshotRow = { id: string };

export type PlaidBalanceRefreshResult = {
  refreshed: number;
  snapshots_saved: number;
  skipped: number;
};

export function selectPlaidSnapshotBalance(input: {
  current: number | null;
  available: number | null;
}): number | null {
  if (input.current !== null && Number.isFinite(input.current)) return input.current;
  if (input.available !== null && Number.isFinite(input.available)) return input.available;
  return null;
}

async function saveBalanceSnapshot(input: {
  userId: string;
  delphiAccountId: string;
  balance: number | null;
  timestamp: string;
}): Promise<boolean> {
  if (input.balance === null || !Number.isFinite(input.balance)) return false;

  const snapshotDate = input.timestamp.slice(0, 10);
  const existing = await supabaseAdmin<SnapshotRow[]>(
    `balance_snapshots?account_id=eq.${encodeURIComponent(input.delphiAccountId)}&snapshot_date=eq.${encodeURIComponent(snapshotDate)}&select=id&limit=1`,
  );

  if (existing[0]?.id) {
    await supabaseAdmin(`balance_snapshots?id=eq.${encodeURIComponent(existing[0].id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        balance: input.balance,
        entered_at: input.timestamp,
        is_active: true,
        notes: 'Synced from Plaid',
      }),
    });
    return true;
  }

  await supabaseAdmin('balance_snapshots', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: input.userId,
      account_id: input.delphiAccountId,
      snapshot_date: snapshotDate,
      balance: input.balance,
      entered_at: input.timestamp,
      is_active: true,
      notes: 'Synced from Plaid',
    }),
  });
  return true;
}

export async function refreshPlaidItemBalances(input: {
  userId: string;
  plaidItemId: string;
  accessToken: string;
}): Promise<PlaidBalanceRefreshResult> {
  // `/accounts/get` is free and returns balances cached from Plaid's most recent
  // successful Item update. Transactions Items refresh regularly, so this keeps
  // Delphi's automatic snapshots fresh without turning every webhook/manual sync
  // into a billed real-time Balance request. A deliberate real-time refresh can
  // be added separately later if the user wants one.
  const response = await plaidRequest<AccountsResponse>('/accounts/get', {
    access_token: input.accessToken,
  });

  const linkedAccounts = await supabaseAdmin<PlaidAccountRow[]>(
    `plaid_accounts?user_id=eq.${encodeURIComponent(input.userId)}&plaid_item_id=eq.${encodeURIComponent(input.plaidItemId)}&is_active=eq.true&select=id,plaid_account_id,delphi_account_id`,
  );
  const linkedByPlaidId = new Map(linkedAccounts.map((row) => [row.plaid_account_id, row]));

  const now = new Date().toISOString();
  let refreshed = 0;
  let snapshotsSaved = 0;
  let skipped = 0;

  for (const account of response.accounts) {
    const linked = linkedByPlaidId.get(account.account_id);
    if (!linked) {
      skipped += 1;
      continue;
    }

    await supabaseAdmin(`plaid_accounts?id=eq.${encodeURIComponent(linked.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        current_balance: account.balances.current,
        available_balance: account.balances.available,
        iso_currency_code: account.balances.iso_currency_code,
        last_balance_at: now,
      }),
    });
    refreshed += 1;

    if (linked.delphi_account_id) {
      const saved = await saveBalanceSnapshot({
        userId: input.userId,
        delphiAccountId: linked.delphi_account_id,
        balance: selectPlaidSnapshotBalance(account.balances),
        timestamp: now,
      });
      if (saved) snapshotsSaved += 1;
    }
  }

  return {
    refreshed,
    snapshots_saved: snapshotsSaved,
    skipped,
  };
}
