import type { VercelRequest, VercelResponse } from '@vercel/node';

import { plaidRequest } from '../../lib/server/plaid';
import { requireUser, supabaseAdmin } from '../../lib/server/supabase';

type ExchangeResponse = { access_token: string; item_id: string };
type AccountsResponse = {
  accounts: Array<{
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
  }>;
};

type PlaidItemRow = { id: string };

type Body = {
  public_token?: string;
  institution_id?: string | null;
  institution_name?: string | null;
};

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

    if (accountResponse.accounts.length > 0) {
      await supabaseAdmin('plaid_accounts?on_conflict=user_id,plaid_account_id', {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(
          accountResponse.accounts.map((account) => ({
            user_id: user.id,
            plaid_item_id: plaidItem.id,
            plaid_account_id: account.account_id,
            name: account.name,
            official_name: account.official_name,
            mask: account.mask,
            type: account.type,
            subtype: account.subtype,
            iso_currency_code: account.balances.iso_currency_code,
            current_balance: account.balances.current,
            available_balance: account.balances.available,
            last_balance_at: new Date().toISOString(),
            is_active: true,
          })),
        ),
      });
    }

    return res.status(200).json({
      item_id: exchanged.item_id,
      accounts: accountResponse.accounts.map((account) => ({
        plaid_account_id: account.account_id,
        name: account.name,
        official_name: account.official_name,
        mask: account.mask,
        type: account.type,
        subtype: account.subtype,
        current_balance: account.balances.current,
        available_balance: account.balances.available,
        iso_currency_code: account.balances.iso_currency_code,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error('Plaid token exchange error', error);
    return res.status(500).json({ error: 'Could not finish Plaid connection.' });
  }
}
