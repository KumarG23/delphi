import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireUser, supabaseAdmin } from '../../lib/server/supabase';

type PlaidAccountLinkRow = {
  plaid_item_id: string;
  last_balance_at: string | null;
  mask: string | null;
};

type PlaidItemRow = {
  institution_name: string | null;
  last_synced_at: string | null;
  status: 'active' | 'error' | 'disconnected';
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const accountId = typeof req.query.account_id === 'string' ? req.query.account_id : null;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const userId = encodeURIComponent(user.id);
    const links = await supabaseAdmin<PlaidAccountLinkRow[]>(
      `plaid_accounts?user_id=eq.${userId}&delphi_account_id=eq.${encodeURIComponent(accountId)}&is_active=eq.true&select=plaid_item_id,last_balance_at,mask&limit=1`,
    );

    const link = links[0];
    if (!link) {
      return res.status(200).json({ linked: false });
    }

    const items = await supabaseAdmin<PlaidItemRow[]>(
      `plaid_items?id=eq.${encodeURIComponent(link.plaid_item_id)}&user_id=eq.${userId}&select=institution_name,last_synced_at,status&limit=1`,
    );
    const item = items[0];

    return res.status(200).json({
      linked: true,
      institution_name: item?.institution_name ?? null,
      last_synced_at: item?.last_synced_at ?? null,
      last_balance_at: link.last_balance_at,
      mask: link.mask,
      status: item?.status ?? 'active',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error('Plaid account status error', error);
    return res.status(500).json({ error: 'Could not load Plaid account status.' });
  }
}
