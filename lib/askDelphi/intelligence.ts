import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import {
  deriveFinancialIntelligence,
  intelligenceWindow,
  type FinancialIntelligence,
  type IntelligenceCashflowMonth,
  type IntelligenceCategory,
  type IntelligenceTransaction,
} from './intelligence-core';

export type {
  FinancialIntelligence,
  IntelligenceCashflowMonth,
  IntelligenceCategory,
  IntelligenceTransaction,
  LargeExpenseInsight,
  SpendingCategoryInsight,
} from './intelligence-core';
export { deriveFinancialIntelligence, intelligenceWindow } from './intelligence-core';

function localToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function useFinancialIntelligence(enabled = true) {
  const today = localToday();
  const window = intelligenceWindow(today);

  return useQuery<FinancialIntelligence>({
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
