import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';
import { NET_WORTH_KEY } from './dashboard';
import type { AccountCategory, AccountSummary, AccountType } from '@/types/database';

export const ACCOUNTS_KEY = ['accounts'] as const;

export const CATEGORY_LABELS: Record<AccountCategory, string> = {
  debt: 'Debt',
  cash: 'Cash',
  investment: 'Investments',
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  credit_card: 'Credit Card',
  personal_loan: 'Personal Loan',
  mortgage: 'Mortgage',
  auto_loan: 'Auto Loan',
  student_loan: 'Student Loan',
  other_debt: 'Other Debt',
  checking: 'Checking',
  savings: 'Savings',
  hysa: 'High-Yield Savings',
  money_market: 'Money Market',
  cash_other: 'Other Cash',
  '401k': '401(k)',
  traditional_ira: 'Traditional IRA',
  roth_ira: 'Roth IRA',
  brokerage: 'Brokerage',
  crypto: 'Crypto',
  investment_other: 'Other Investment',
};

export const TYPES_BY_CATEGORY: Record<AccountCategory, AccountType[]> = {
  debt: ['credit_card', 'personal_loan', 'mortgage', 'auto_loan', 'student_loan', 'other_debt'],
  cash: ['checking', 'savings', 'hysa', 'money_market', 'cash_other'],
  investment: ['401k', 'traditional_ira', 'roth_ira', 'brokerage', 'crypto', 'investment_other'],
};

export function useAccounts() {
  return useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_account_summary')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('name');
      if (error) throw error;
      return data as AccountSummary[];
    },
  });
}

export interface AddAccountInput {
  name: string;
  category: AccountCategory;
  type: AccountType;
  institution: string;
  openingBalance: number | null;
}

export function useAddAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddAccountInput) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('accounts')
        .insert({
          user_id: session.user.id,
          name: input.name.trim(),
          category: input.category,
          type: input.type,
          institution: input.institution.trim() || null,
        })
        .select('id')
        .single();
      if (error) throw error;

      if (input.openingBalance !== null && input.openingBalance > 0) {
        const today = new Date().toISOString().split('T')[0];
        const { error: snapErr } = await supabase.from('balance_snapshots').insert({
          account_id: data.id,
          user_id: session.user.id,
          snapshot_date: today,
          balance: input.openingBalance,
        });
        if (snapErr) throw snapErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACCOUNTS_KEY });
      qc.invalidateQueries({ queryKey: NET_WORTH_KEY });
    },
  });
}

export interface UpdateAccountInput {
  id: string;
  name: string;
  nickname: string;
  institution: string;
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateAccountInput) => {
      const { error } = await supabase
        .from('accounts')
        .update({
          name: input.name.trim(),
          nickname: input.nickname.trim() || null,
          institution: input.institution.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
  });
}

export function useArchiveAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('accounts')
        .update({
          is_active: false,
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
  });
}
