import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizePlaidTransaction } from '../lib/server/plaid-transactions';

function tx(overrides: Record<string, unknown> = {}) {
  return {
    transaction_id: 'tx-1',
    account_id: 'acct-1',
    amount: 12.34,
    date: '2026-09-10',
    name: 'Test transaction',
    merchant_name: 'Test Merchant',
    pending: false,
    personal_finance_category: {
      primary: 'FOOD_AND_DRINK',
      detailed: 'FOOD_AND_DRINK_GROCERIES',
    },
    ...overrides,
  };
}

test('normalizes Plaid outflows as positive Delphi expenses', () => {
  const result = normalizePlaidTransaction(tx());
  assert.equal(result.kind, 'expense');
  assert.equal(result.amount, 12.34);
  assert.equal(result.categoryName, 'Groceries');
  assert.equal(result.merchant, 'Test Merchant');
});

test('normalizes negative Plaid amounts as Delphi income', () => {
  const result = normalizePlaidTransaction(tx({
    amount: -2500,
    merchant_name: null,
    personal_finance_category: {
      primary: 'INCOME',
      detailed: 'INCOME_WAGES',
    },
  }));
  assert.equal(result.kind, 'income');
  assert.equal(result.amount, 2500);
  assert.equal(result.categoryName, 'Salary');
  assert.equal(result.merchant, null);
});

test('recognizes negative outflow-category transactions as refunds', () => {
  const result = normalizePlaidTransaction(tx({
    amount: -42,
    personal_finance_category: {
      primary: 'GENERAL_MERCHANDISE',
      detailed: 'GENERAL_MERCHANDISE_SUPERSTORES',
    },
  }));
  assert.equal(result.kind, 'income');
  assert.equal(result.categoryName, 'Refund');
});

test('excludes account transfers and debt payments from cash-flow spending', () => {
  const transfer = normalizePlaidTransaction(tx({
    personal_finance_category: {
      primary: 'TRANSFER_OUT',
      detailed: 'TRANSFER_OUT_ACCOUNT_TRANSFER',
    },
  }));
  const cardPayment = normalizePlaidTransaction(tx({
    personal_finance_category: {
      primary: 'LOAN_PAYMENTS',
      detailed: 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT',
    },
  }));

  assert.equal(transfer.kind, 'transfer');
  assert.equal(transfer.categoryName, null);
  assert.equal(cardPayment.kind, 'transfer');
  assert.equal(cardPayment.categoryName, null);
});

test('marks pending Plaid transactions in notes', () => {
  const result = normalizePlaidTransaction(tx({ pending: true }));
  assert.match(result.notes, /Pending/);
});
