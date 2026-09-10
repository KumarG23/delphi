import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyPlaidAccount } from '../lib/server/plaid-account-map';

test('classifyPlaidAccount maps common deposit accounts', () => {
  assert.deepEqual(classifyPlaidAccount('depository', 'checking'), {
    category: 'cash',
    type: 'checking',
  });
  assert.deepEqual(classifyPlaidAccount('depository', 'savings'), {
    category: 'cash',
    type: 'savings',
  });
  assert.deepEqual(classifyPlaidAccount('depository', 'money market'), {
    category: 'cash',
    type: 'money_market',
  });
});

test('classifyPlaidAccount maps debt accounts conservatively', () => {
  assert.deepEqual(classifyPlaidAccount('credit', 'credit card'), {
    category: 'debt',
    type: 'credit_card',
  });
  assert.deepEqual(classifyPlaidAccount('loan', 'mortgage'), {
    category: 'debt',
    type: 'mortgage',
  });
  assert.deepEqual(classifyPlaidAccount('loan', 'student'), {
    category: 'debt',
    type: 'student_loan',
  });
  assert.deepEqual(classifyPlaidAccount('loan', 'something-new'), {
    category: 'debt',
    type: 'other_debt',
  });
});

test('classifyPlaidAccount maps investment accounts', () => {
  assert.deepEqual(classifyPlaidAccount('investment', '401k'), {
    category: 'investment',
    type: '401k',
  });
  assert.deepEqual(classifyPlaidAccount('investment', 'roth ira'), {
    category: 'investment',
    type: 'roth_ira',
  });
  assert.deepEqual(classifyPlaidAccount('investment', 'brokerage'), {
    category: 'investment',
    type: 'brokerage',
  });
});
