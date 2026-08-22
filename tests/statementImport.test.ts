import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildStatementInsertRows,
  buildStatementImportPayload,
  createStatementDraft,
  suggestCategoryId,
  type StatementCategory,
  type StatementTransaction,
} from '../lib/statementImport';

const categories: StatementCategory[] = [
  { id: 'cat-dining', name: 'Dining', type: 'expense' },
  { id: 'cat-entertainment', name: 'Entertainment', type: 'expense' },
  { id: 'cat-income', name: 'Income', type: 'income' },
];

const transactions: StatementTransaction[] = [
  {
    transactionDate: '2026-08-01',
    amount: 12.5,
    kind: 'expense',
    merchant: 'DoorDash',
    description: 'Express Checkout Payment',
    externalId: 'paypal:expense-1',
    currency: 'USD',
  },
  {
    transactionDate: '2026-08-02',
    amount: 44,
    kind: 'expense',
    merchant: 'Steam Games',
    description: 'PreApproved Payment',
    externalId: 'paypal:expense-2',
    currency: 'USD',
  },
  {
    transactionDate: '2026-08-03',
    amount: 100,
    kind: 'income',
    merchant: 'Example Sender',
    description: 'General Payment',
    externalId: 'paypal:income-1',
    currency: 'USD',
  },
  {
    transactionDate: '2026-08-04',
    amount: 20,
    kind: 'transfer',
    merchant: 'Example Bank',
    description: 'Bank Withdrawal to PP Account',
    externalId: 'paypal:transfer-1',
    currency: 'USD',
  },
];

test('suggestCategoryId matches provider merchants without crossing transaction kinds', () => {
  assert.equal(suggestCategoryId(transactions[0], categories), 'cat-dining');
  assert.equal(suggestCategoryId(transactions[1], categories), 'cat-entertainment');
  assert.equal(suggestCategoryId(transactions[2], categories), 'cat-income');
});

test('createStatementDraft marks existing external IDs as disabled duplicates', () => {
  const draft = createStatementDraft(
    transactions,
    new Set(['paypal:expense-1']),
    categories,
  );

  assert.deepEqual(
    draft.map(({ externalId, duplicate, selected, categoryId }) => ({ externalId, duplicate, selected, categoryId })),
    [
      { externalId: 'paypal:expense-1', duplicate: true, selected: false, categoryId: 'cat-dining' },
      { externalId: 'paypal:expense-2', duplicate: false, selected: true, categoryId: 'cat-entertainment' },
      { externalId: 'paypal:income-1', duplicate: false, selected: true, categoryId: 'cat-income' },
      { externalId: 'paypal:transfer-1', duplicate: false, selected: true, categoryId: null },
    ],
  );
});

test('buildStatementInsertRows emits only approved new rows with stable source identity', () => {
  const draft = createStatementDraft(transactions, new Set(['paypal:expense-1']), categories);
  draft[2] = { ...draft[2], selected: false };
  draft[3] = { ...draft[3], selected: false };

  const rows = buildStatementInsertRows(draft, 'user-1', 'account-paypal');

  assert.deepEqual(rows, [
    {
      user_id: 'user-1',
      account_id: 'account-paypal',
      category_id: 'cat-entertainment',
      transaction_date: '2026-08-02',
      amount: 44,
      kind: 'expense',
      merchant: 'Steam Games',
      description: 'PreApproved Payment',
      notes: null,
      source: 'csv_import',
      external_id: 'paypal:expense-2',
    },
  ]);
});

test('buildStatementInsertRows permits an unlinked account and uncategorized row', () => {
  const draft = createStatementDraft([transactions[0]], new Set(), []);
  const [row] = buildStatementInsertRows(draft, 'user-1', null);

  assert.equal(row.account_id, null);
  assert.equal(row.category_id, null);
});

test('buildStatementImportPayload preserves snapshot-only recovery when all rows are duplicates', () => {
  const draft = createStatementDraft(transactions, new Set(transactions.map(row => row.externalId)), categories);
  const snapshot = {
    snapshotDate: '2026-08-10',
    balance: 3100,
    minPayment: 100,
    paymentDueDate: '2026-09-04',
  };

  const payload = buildStatementImportPayload(draft, 'user-1', 'account-paypal', snapshot);

  assert.deepEqual(payload, { transactions: [], snapshot });
});
