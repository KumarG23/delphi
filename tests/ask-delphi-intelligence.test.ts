import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deriveFinancialIntelligence,
  intelligenceWindow,
  type IntelligenceTransaction,
} from '../lib/askDelphi/intelligence-core';

test('intelligenceWindow compares through the same day of the previous month', () => {
  assert.deepEqual(intelligenceWindow('2026-09-11'), {
    currentPeriodStart: '2026-09-01',
    previousComparableStart: '2026-08-01',
    previousComparableEnd: '2026-08-11',
    queryStart: '2026-08-01',
    currentMonthDate: '2026-09-01',
  });
});

test('intelligenceWindow safely clips end-of-month comparisons', () => {
  assert.equal(intelligenceWindow('2026-03-31').previousComparableEnd, '2026-02-28');
  assert.equal(intelligenceWindow('2028-03-31').previousComparableEnd, '2028-02-29');
});

test('deriveFinancialIntelligence calculates MTD comparisons and ignores transfers', () => {
  const transactions: IntelligenceTransaction[] = [
    {
      transaction_date: '2026-09-02',
      amount: 2000,
      kind: 'income',
      merchant: null,
      description: 'Payroll',
      category_id: 'salary',
    },
    {
      transaction_date: '2026-09-03',
      amount: 300,
      kind: 'expense',
      merchant: 'Market',
      description: 'Groceries',
      category_id: 'groceries',
    },
    {
      transaction_date: '2026-09-05',
      amount: 100,
      kind: 'expense',
      merchant: 'Cafe',
      description: 'Dining',
      category_id: 'dining',
    },
    {
      transaction_date: '2026-09-06',
      amount: 900,
      kind: 'transfer',
      merchant: null,
      description: 'Credit card payment',
      category_id: null,
    },
    {
      transaction_date: '2026-08-02',
      amount: 1800,
      kind: 'income',
      merchant: null,
      description: 'Payroll',
      category_id: 'salary',
    },
    {
      transaction_date: '2026-08-04',
      amount: 500,
      kind: 'expense',
      merchant: 'Market',
      description: 'Groceries',
      category_id: 'groceries',
    },
    {
      transaction_date: '2026-08-20',
      amount: 999,
      kind: 'expense',
      merchant: 'Too late for comparable window',
      description: null,
      category_id: 'shopping',
    },
  ];

  const result = deriveFinancialIntelligence({
    today: '2026-09-11',
    transactions,
    categories: [
      { id: 'salary', name: 'Salary', type: 'income' },
      { id: 'groceries', name: 'Groceries', type: 'expense' },
      { id: 'dining', name: 'Dining', type: 'expense' },
      { id: 'shopping', name: 'Shopping', type: 'expense' },
    ],
    completedCashflowMonths: [
      { month: '2026-08-01', total_income: 4000, total_expense: 3000, net_cashflow: 1000 },
      { month: '2026-07-01', total_income: 4000, total_expense: 3200, net_cashflow: 800 },
      { month: '2026-06-01', total_income: 3900, total_expense: 2800, net_cashflow: 1100 },
    ],
  });

  assert.equal(result.currentMtdIncome, 2000);
  assert.equal(result.currentMtdExpense, 400);
  assert.equal(result.currentMtdNet, 1600);
  assert.equal(result.currentSavingsRatePct, 80);
  assert.equal(result.previousComparableIncome, 1800);
  assert.equal(result.previousComparableExpense, 500);
  assert.equal(result.previousComparableNet, 1300);
  assert.equal(result.expenseChangePct, -20);
  assert.ok(result.incomeChangePct !== null);
  assert.ok(Math.abs(result.incomeChangePct - 11.111111) < 0.001);

  assert.deepEqual(result.topSpendingCategories.map((category) => category.name), [
    'Groceries',
    'Dining',
  ]);
  assert.equal(result.topSpendingCategories[0].sharePct, 75);

  assert.equal(result.completedMonthsUsed, 3);
  assert.equal(result.averageMonthlyIncome, 11900 / 3);
  assert.equal(result.averageMonthlyExpense, 3000);
  assert.equal(result.averageMonthlyNet, 2900 / 3);
});

test('largest recent expenses are limited to the last 30 days and sorted', () => {
  const result = deriveFinancialIntelligence({
    today: '2026-09-11',
    transactions: [
      {
        transaction_date: '2026-09-10',
        amount: 50,
        kind: 'expense',
        merchant: 'Small',
        description: null,
        category_id: null,
      },
      {
        transaction_date: '2026-08-20',
        amount: 700,
        kind: 'expense',
        merchant: 'Big',
        description: null,
        category_id: null,
      },
      {
        transaction_date: '2026-08-12',
        amount: 1000,
        kind: 'expense',
        merchant: 'Too old',
        description: null,
        category_id: null,
      },
    ],
    categories: [],
    completedCashflowMonths: [],
  });

  assert.deepEqual(result.largestRecentExpenses.map((expense) => expense.merchant), [
    'Big',
    'Small',
  ]);
});
