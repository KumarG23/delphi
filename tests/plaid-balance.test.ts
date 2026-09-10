import assert from 'node:assert/strict';
import test from 'node:test';

import { selectPlaidSnapshotBalance } from '../lib/server/plaid-balance';

test('selectPlaidSnapshotBalance prefers current balance', () => {
  assert.equal(selectPlaidSnapshotBalance({ current: 125.5, available: 120 }), 125.5);
});

test('selectPlaidSnapshotBalance falls back to available balance', () => {
  assert.equal(selectPlaidSnapshotBalance({ current: null, available: 88.25 }), 88.25);
});

test('selectPlaidSnapshotBalance rejects missing or non-finite values', () => {
  assert.equal(selectPlaidSnapshotBalance({ current: null, available: null }), null);
  assert.equal(selectPlaidSnapshotBalance({ current: Number.NaN, available: null }), null);
});
