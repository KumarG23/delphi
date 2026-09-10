import assert from 'node:assert/strict';
import test from 'node:test';

import { parseOptionalJsonResponse } from '../lib/server/supabase';

test('parseOptionalJsonResponse accepts an empty successful response body', async () => {
  const response = new Response('', { status: 201 });
  const parsed = await parseOptionalJsonResponse<undefined>(response);
  assert.equal(parsed, undefined);
});

test('parseOptionalJsonResponse parses JSON when a body is returned', async () => {
  const response = new Response(JSON.stringify([{ id: 'abc' }]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  const parsed = await parseOptionalJsonResponse<Array<{ id: string }>>(response);
  assert.deepEqual(parsed, [{ id: 'abc' }]);
});
