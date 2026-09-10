import { useQuery } from '@tanstack/react-query';

import { supabase } from './supabase';
import type { MonthlyCashflow, MonthlySpending } from '@/types/database';

export const SPENDING_KEY = (month: string) => ['spending', month] as const;
export const CASHFLOW_KEY = ['cashflow'] as const;

export function useMonthlySpending(month: string) {
  return useQuery({
    queryKey: SPENDING_KEY(month),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_monthly_spending_by_category')
        .select('*')
        .eq('month', `${month}-01`)
        .order('total', { ascending: false });
      if (error) throw error;
      return data as MonthlySpending[];
    },
  });
}

export function useCashflowHistory() {
  return useQuery({
    queryKey: CASHFLOW_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_monthly_cashflow')
        .select('*')
        .order('month', { ascending: true })
        .limit(12);
      if (error) throw error;
      return data as MonthlyCashflow[];
    },
  });
}

export function useCurrentCashflow(month: string) {
  return useQuery<MonthlyCashflow | null>({
    queryKey: [...CASHFLOW_KEY, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_monthly_cashflow')
        .select('*')
        .eq('month', `${month}-01`)
        .single();
      // PGRST116 = no rows found; treat as null rather than an error.
      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      // Postgres views do not preserve NOT NULL metadata, so Supabase generates
      // nullable fields here even though this aggregate view always supplies
      // these values. Normalize at the data boundary rather than throughout UI.
      return {
        user_id: data.user_id ?? '',
        month: data.month ?? `${month}-01`,
        total_income: data.total_income ?? 0,
        total_expense: data.total_expense ?? 0,
        net_cashflow: data.net_cashflow ?? 0,
      };
    },
  });
}
