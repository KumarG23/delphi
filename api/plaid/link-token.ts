import type { VercelRequest, VercelResponse } from '@vercel/node';

import { plaidRequest } from '../../lib/server/plaid';
import { PLAID_WEBHOOK_URL } from '../../lib/server/plaid-sync';
import { requireUser } from '../../lib/server/supabase';

type LinkTokenResponse = {
  link_token: string;
  expiration: string;
  request_id: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const result = await plaidRequest<LinkTokenResponse>('/link/token/create', {
      client_name: 'Delphi',
      language: 'en',
      country_codes: ['US'],
      products: ['transactions'],
      webhook: PLAID_WEBHOOK_URL,
      user: { client_user_id: user.id },
    });

    return res.status(200).json({
      link_token: result.link_token,
      expiration: result.expiration,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error('Plaid link-token error', error);
    return res.status(500).json({ error: 'Could not start Plaid Link.' });
  }
}
