import assert from 'node:assert/strict';
import test from 'node:test';

import { PLAID_WEBHOOK_URL } from '../lib/server/plaid-sync';

test('Plaid webhook URL is an HTTPS endpoint', () => {
  const url = new URL(PLAID_WEBHOOK_URL);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.pathname, '/api/plaid/webhook');
});
