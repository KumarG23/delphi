import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ACCOUNTS_KEY } from './accounts';
import { NET_WORTH_KEY } from './dashboard';
import { CASHFLOW_KEY } from './spending';
import { supabase } from './supabase';
import { TRANSACTIONS_KEY } from './transactions';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? '';
export const PLAID_ACCOUNT_STATUS_KEY = ['plaid-account-status'] as const;

type LinkTokenResponse = {
  link_token: string;
  expiration: string;
};

export type PlaidExchangeAccount = {
  plaid_account_id: string;
  delphi_account_id: string;
  name: string;
  official_name: string | null;
  mask: string | null;
  type: string;
  subtype: string | null;
  current_balance: number | null;
  available_balance: number | null;
  iso_currency_code: string | null;
};

type ExchangeResponse = {
  item_id: string;
  accounts: PlaidExchangeAccount[];
};

export type PlaidSyncResponse = {
  linked_items: number;
  successful_items: number;
  failed_items: number;
  added: number;
  modified: number;
  removed: number;
  skipped: number;
  results: Array<{
    item_id: string;
    added: number;
    modified: number;
    removed: number;
    skipped: number;
    success: boolean;
    error?: string;
  }>;
};

export type PlaidAccountStatus = {
  linked: boolean;
  institution_name?: string | null;
  last_synced_at?: string | null;
  last_balance_at?: string | null;
  mask?: string | null;
  status?: 'active' | 'error' | 'disconnected';
};

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) throw new Error('Please sign in again before connecting a bank.');

  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function parseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.error === 'string' ? body.error : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

export async function createPlaidLinkToken(): Promise<string> {
  const response = await fetch(`${API_BASE}/api/plaid/link-token`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  const body = await parseJson<LinkTokenResponse>(response);
  return body.link_token;
}

export async function exchangePlaidPublicToken(input: {
  publicToken: string;
  institutionId?: string | null;
  institutionName?: string | null;
}): Promise<ExchangeResponse> {
  const response = await fetch(`${API_BASE}/api/plaid/exchange-token`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      public_token: input.publicToken,
      institution_id: input.institutionId ?? null,
      institution_name: input.institutionName ?? null,
    }),
  });
  return parseJson<ExchangeResponse>(response);
}

async function requestPlaidSync(delphiAccountId?: string): Promise<PlaidSyncResponse> {
  const response = await fetch(`${API_BASE}/api/plaid/sync`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(
      delphiAccountId ? { delphi_account_id: delphiAccountId } : {},
    ),
  });
  return parseJson<PlaidSyncResponse>(response);
}

export async function syncPlaidTransactions(): Promise<PlaidSyncResponse> {
  return requestPlaidSync();
}

export async function syncPlaidAccount(accountId: string): Promise<PlaidSyncResponse> {
  return requestPlaidSync(accountId);
}

export async function getPlaidAccountStatus(accountId: string): Promise<PlaidAccountStatus> {
  const response = await fetch(
    `${API_BASE}/api/plaid/account-status?account_id=${encodeURIComponent(accountId)}`,
    {
      method: 'GET',
      headers: await authHeaders(),
    },
  );
  return parseJson<PlaidAccountStatus>(response);
}

export function usePlaidAccountStatus(accountId: string | null | undefined) {
  return useQuery({
    queryKey: [...PLAID_ACCOUNT_STATUS_KEY, accountId],
    queryFn: () => getPlaidAccountStatus(accountId!),
    enabled: Boolean(accountId),
    staleTime: 30_000,
  });
}

export function usePlaidRefresh() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
      queryClient.invalidateQueries({ queryKey: NET_WORTH_KEY }),
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY }),
      queryClient.invalidateQueries({ queryKey: ['spending'] }),
      queryClient.invalidateQueries({ queryKey: CASHFLOW_KEY }),
      queryClient.invalidateQueries({ queryKey: PLAID_ACCOUNT_STATUS_KEY }),
    ]);
  };
}

export function usePlaidSync() {
  const refreshFinancialData = usePlaidRefresh();
  return useMutation({
    mutationFn: syncPlaidTransactions,
    onSuccess: refreshFinancialData,
  });
}
