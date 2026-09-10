import type { VercelRequest, VercelResponse } from '@vercel/node';

import { syncPlaidItemsForUser } from '../../lib/server/plaid-sync';
import { requireUser } from '../../lib/server/supabase';

type Body = {
  delphi_account_id?: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const { delphi_account_id } = (req.body ?? {}) as Body;
    const result = await syncPlaidItemsForUser(user.id, delphi_account_id);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error('Plaid transaction sync error', error);
    return res.status(500).json({ error: 'Could not sync Plaid transactions.' });
  }
}
