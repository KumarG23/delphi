const PLAID_SANDBOX = 'https://sandbox.plaid.com';

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function plaidBaseUrl(): string {
  const env = process.env.PLAID_ENV ?? 'sandbox';
  if (env !== 'sandbox') {
    throw new Error('Only PLAID_ENV=sandbox is supported right now');
  }
  return PLAID_SANDBOX;
}

export async function plaidRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${plaidBaseUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: required(process.env.PLAID_CLIENT_ID, 'PLAID_CLIENT_ID'),
      secret: required(process.env.PLAID_SECRET, 'PLAID_SECRET'),
      ...body,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const message = typeof data?.error_message === 'string' ? data.error_message : `Plaid request failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}
