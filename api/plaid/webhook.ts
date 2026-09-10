import type { VercelRequest, VercelResponse } from '@vercel/node';

import { syncPlaidItemByExternalId } from '../../lib/server/plaid-sync';
import { verifyPlaidWebhook } from '../../lib/server/plaid-webhook';
import { supabaseAdmin } from '../../lib/server/supabase';

export const config = {
  api: {
    bodyParser: false,
  },
};

type PlaidWebhookBody = {
  webhook_type?: string;
  webhook_code?: string;
  item_id?: string;
  environment?: string;
  error?: {
    error_code?: string | null;
    error_message?: string | null;
  } | null;
};

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function verificationHeader(req: VercelRequest): string | null {
  const value = req.headers['plaid-verification'];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function updateItemState(
  itemId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await supabaseAdmin(`plaid_items?item_id=eq.${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(fields),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rawBody = await readRawBody(req);
    const verification = verificationHeader(req);
    if (!verification) return res.status(401).json({ error: 'Missing Plaid verification header' });

    await verifyPlaidWebhook(rawBody, verification);

    const body = JSON.parse(rawBody.toString('utf8')) as PlaidWebhookBody;
    const expectedEnvironment = process.env.PLAID_ENV ?? 'sandbox';
    if (body.environment && body.environment !== expectedEnvironment) {
      return res.status(400).json({ error: 'Unexpected Plaid environment' });
    }

    if (!body.item_id) {
      return res.status(200).json({ received: true, ignored: true });
    }

    if (body.webhook_type === 'TRANSACTIONS' && body.webhook_code === 'SYNC_UPDATES_AVAILABLE') {
      const result = await syncPlaidItemByExternalId(body.item_id);
      if (!result) {
        // Unknown Items should not cause Plaid to retry indefinitely.
        return res.status(200).json({ received: true, ignored: true });
      }
      if (!result.success) {
        // A non-2xx response asks Plaid to retry the webhook later.
        return res.status(500).json({ received: true, synced: false });
      }
      return res.status(200).json({ received: true, synced: true });
    }

    if (body.webhook_type === 'ITEM' && body.webhook_code === 'ERROR') {
      await updateItemState(body.item_id, {
        status: 'error',
        last_error_code: body.error?.error_code ?? null,
        last_error_message: body.error?.error_message ?? 'Plaid Item error',
      });
      return res.status(200).json({ received: true });
    }

    if (body.webhook_type === 'ITEM' && body.webhook_code === 'LOGIN_REPAIRED') {
      await updateItemState(body.item_id, {
        status: 'active',
        last_error_code: null,
        last_error_message: null,
      });
      return res.status(200).json({ received: true });
    }

    if (body.webhook_type === 'ITEM' && body.webhook_code === 'USER_PERMISSION_REVOKED') {
      await updateItemState(body.item_id, {
        status: 'disconnected',
        last_error_code: 'USER_PERMISSION_REVOKED',
        last_error_message: 'Plaid access was revoked by the user.',
      });
      return res.status(200).json({ received: true });
    }

    // Acknowledgements and webhook types Delphi does not use yet are accepted
    // without work so Plaid does not retry them.
    return res.status(200).json({ received: true, ignored: true });
  } catch (error) {
    console.error('Plaid webhook error', error);
    return res.status(401).json({ error: 'Invalid Plaid webhook' });
  }
}
