import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type IntelligenceTransaction = {
  transaction_date: string;
  amount: number;
  kind: 'expense' | 'income' | 'transfer';
  merchant: string | null;
  description: string | null;
  category_id: string | null;
};

export type IntelligenceCategory = {
  id: string;
  name: string;
  type: 'expense' | 'income';
};

export type IntelligenceCashflowMonth = {
  month: string;
  total_income: number;
  total_expense: number;
  net_cashflow: number;
};

export type SpendingCategoryInsight = {
  name: string;
  total: number;
  transactionCount: number;
  sharePct: number;
};

export type LargeExpenseInsight = {
  date: string;
  merchant: string;
  amount: number;
  category: string | null;
};

export type FinancialIntelligence = {
  asOfDate: string;
  currentPeriodStart: string;
  previousComparableStart: string;
  previousComparableEnd: string;
  currentMtdIncome: number;
  currentMtdExpense: number;
  currentMtdNet: number;
  currentSavingsRatePct: number | null;
  previousComparableIncome: number;
  previousComparableExpense: number;
  previousComparableNet: number;
  expenseChangePct: number | null;
  incomeChangePct: number | null;
  topSpendingCategories: SpendingCategoryInsight[];
  largestRecentExpenses: LargeExpenseInsight[];
  completedMonthsUsed: number;
  averageMonthlyIncome: number | null;
  averageMonthlyExpense: number | null;
  averageMonthlyNet: number | null;
};

function ymd(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseYmd(value: string): { year: number; monthIndex: number; day: number } {
  const [year, month, day] = value.split('-').map(Number);
  return { year, monthIndex: month - 1, day };
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function localToday(): string {
  const now = new Date();
  return ymd(now.getFullYear(), now.getMonth(), now.getDate());
}

function dateDaysAgo(value: string, days: number): string {
  const { year, monthIndex, day } = parseYmd(value);
  const date = new Date(year, monthIndex, day);
  date.setDate(date.getDate() - days);
  return ymd(date.getFullYear(), date.getMonth(), date.getDate());
}

export function intelligenceWindow(today: string) {
  const { year, monthIndex, day } = parseYmd(today);
  const currentPeriodStart = ymd(year, monthIndex, 1);

  const previousDate = new Date(year, monthIndex - 1, 1);
  const previousYear = previousDate.getFullYear();
  const previousMonthIndex = previousDate.getMonth();
  const previousComparableStart = ymd(previousYear, previousMonthIndex, 1);
  const previousComparableDay = Math.min(day, daysInMonth(previousYear, previousMonthIndex));
  const previousComparableEnd = ymd(previousYear, previousMonthIndex, previousComparableDay);
  const recentExpenseStart = dateDaysAgo(today, 29);

  return {
    currentPeriodStart,
    previousComparableStart,
    previousComparableEnd,
    queryStart: previousComparableStart < recentExpenseStart
      ? previousComparableStart
      : recentExpenseStart,
    currentMonthDate: `${currentPeriodStart}`,
  };
}

function sumKind(
  rows: IntelligenceTransaction[],
  kind: 'income' | 'expense',
  start: string,
  end: string,
): number {
  return rows.reduce((sum, row) => {
    if (row.kind !== kind) return sum;
    if (row.transaction_date < start || row.transaction_date > end) return sum;
    return sum + Number(row.amount || 0);
  }, 0);
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function deriveFinancialIntelligence(input: {
  today: string;
  transactions: IntelligenceTransaction[];
  categories: IntelligenceCategory[];
  completedCashflowMonths: IntelligenceCashflowMonth[];
}): FinancialIntelligence {
  const { today, transactions, categories, completedCashflowMonths } = input;
  const window = intelligenceWindow(today);
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  const currentMtdIncome = sumKind(
    transactions,
    'income',
    window.currentPeriodStart,
    today,
  );
  const currentMtdExpense = sumKind(
    transactions,
    'expense',
    window.currentPeriodStart,
    today,
  );
  const previousComparableIncome = sumKind(
    transactions,
    'income',
    window.previousComparableStart,
    window.previousComparableEnd,
  );
  const previousComparableExpense = sumKind(
    transactions,
    'expense',
    window.previousComparableStart,
    window.previousComparableEnd,
  );

  const categoryTotals = new Map<string, { total: number; count: number }>();
  for (const row of transactions) {
    if (
      row.kind !== 'expense'
      || row.transaction_date < window.currentPeriodStart
      || row.transaction_date > today
    ) {
      continue;
    }

    const name = row.category_id
      ? categoryNames.get(row.category_id) ?? 'Uncategorized'
      : 'Uncategorized';
    const existing = categoryTotals.get(name) ?? { total: 0, count: 0 };
    existing.total += Number(row.amount || 0);
    existing.count += 1;
    categoryTotals.set(name, existing);
  }

  const topSpendingCategories = [...categoryTotals.entries()]
    .map(([name, value]) => ({
      name,
      total: value.total,
      transactionCount: value.count,
      sharePct: currentMtdExpense > 0 ? (value.total / currentMtdExpense) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);

  const recentStart = dateDaysAgo(today, 29);
  const largestRecentExpenses = transactions
    .filter((row) => (
      row.kind === 'expense'
      && row.transaction_date >= recentStart
      && row.transaction_date <= today
    ))
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5)
    .map((row) => ({
      date: row.transaction_date,
      merchant: row.merchant?.trim() || row.description?.trim() || 'Unknown merchant',
      amount: Number(row.amount || 0),
      category: row.category_id ? categoryNames.get(row.category_id) ?? null : null,
    }));

  const normalizedCompleted = completedCashflowMonths
    .map((month) => ({
      month: month.month,
      total_income: Number(month.total_income || 0),
      total_expense: Number(month.total_expense || 0),
      net_cashflow: Number(month.net_cashflow || 0),
    }))
    .slice(0, 3);

  const currentMtdNet = currentMtdIncome - currentMtdExpense;
  const previousComparableNet = previousComparableIncome - previousComparableExpense;

  return {
    asOfDate: today,
    currentPeriodStart: window.currentPeriodStart,
    previousComparableStart: window.previousComparableStart,
    previousComparableEnd: window.previousComparableEnd,
    currentMtdIncome,
    currentMtdExpense,
    currentMtdNet,
    currentSavingsRatePct: currentMtdIncome > 0
      ? (currentMtdNet / currentMtdIncome) * 100
      : null,
    previousComparableIncome,
    previousComparableExpense,
    previousComparableNet,
    expenseChangePct: pctChange(currentMtdExpense, previousComparableExpense),
    incomeChangePct: pctChange(currentMtdIncome, previousComparableIncome),
    topSpendingCategories,
    largestRecentExpenses,
    completedMonthsUsed: normalizedCompleted.length,
    averageMonthlyIncome: average(normalizedCompleted.map((month) => month.total_income)),
    averageMonthlyExpense: average(normalizedCompleted.map((month) => month.total_expense)),
    averageMonthlyNet: average(normalizedCompleted.map((month) => month.net_cashflow)),
  };
}

export function useFinancialIntelligence(enabled = true) {
  const today = localToday();
  const window = intelligenceWindow(today);

  return useQuery({
    queryKey: ['ask-delphi-intelligence', today],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const [transactionsResult, categoriesResult, cashflowResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('transaction_date,amount,kind,merchant,description,category_id')
          .eq('is_active', true)
          .gte('transaction_date', window.queryStart)
          .lte('transaction_date', today)
          .order('transaction_date', { ascending: false })
          .limit(1000),
        supabase
          .from('categories')
          .select('id,name,type')
          .eq('is_active', true),
        supabase
          .from('v_monthly_cashflow')
          .select('month,total_income,total_expense,net_cashflow')
          .lt('month', window.currentMonthDate)
          .order('month', { ascending: false })
          .limit(3),
      ]);

      if (transactionsResult.error) throw transactionsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;
      if (cashflowResult.error) throw cashflowResult.error;

      const transactions: IntelligenceTransaction[] = (transactionsResult.data ?? []).map((row) => ({
        transaction_date: row.transaction_date,
        amount: Number(row.amount ?? 0),
        kind: row.kind,
        merchant: row.merchant,
        description: row.description,
        category_id: row.category_id,
      }));

      const categories: IntelligenceCategory[] = (categoriesResult.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
      }));

      const completedCashflowMonths: IntelligenceCashflowMonth[] = (cashflowResult.data ?? []).map((row) => ({
        month: row.month ?? '',
        total_income: Number(row.total_income ?? 0),
        total_expense: Number(row.total_expense ?? 0),
        net_cashflow: Number(row.net_cashflow ?? 0),
      }));

      return deriveFinancialIntelligence({
        today,
        transactions,
        categories,
        completedCashflowMonths,
      });
    },
  });
}
