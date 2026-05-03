import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';
import type { Category, ComputedBalance, Transaction, TransactionKind, TransactionSource } from '@/types/database';

export const TRANSACTIONS_KEY = ['transactions'] as const;
export const CATEGORIES_KEY = ['categories'] as const;

export interface TransactionFilters {
  month?: string;
  accountId?: string;
  categoryId?: string;
  kind?: TransactionKind;
}

export function useTransactions(filters?: TransactionFilters) {
  return useQuery({
    queryKey: [...TRANSACTIONS_KEY, filters],
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('is_active', true);

      if (filters?.month) {
        const [year, mon] = filters.month.split('-').map(Number);
        const start = `${year}-${String(mon).padStart(2, '0')}-01`;
        const endYear = mon === 12 ? year + 1 : year;
        const endMon = mon === 12 ? 1 : mon + 1;
        const end = `${endYear}-${String(endMon).padStart(2, '0')}-01`;
        query = query.gte('transaction_date', start).lt('transaction_date', end);
      }

      if (filters?.accountId) {
        query = query.eq('account_id', filters.accountId);
      }

      if (filters?.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }

      if (filters?.kind) {
        query = query.eq('kind', filters.kind);
      }

      const { data, error } = await query.order('transaction_date', { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as Category[];
    },
  });
}

export function useComputedBalance(accountId: string | null) {
  return useQuery({
    queryKey: ['computed_balance', accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_account_computed_balance')
        .select('*')
        .eq('account_id', accountId!)
        .single();
      if (error) throw error;
      return data as ComputedBalance;
    },
    enabled: accountId !== null,
  });
}

export interface AddTransactionInput {
  transaction_date: string;
  amount: number;
  kind: TransactionKind;
  merchant?: string | null;
  category_id?: string | null;
  account_id?: string | null;
  description?: string | null;
  notes?: string | null;
  source?: TransactionSource;
}

export function useAddTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddTransactionInput) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase.from('transactions').insert({
        user_id: session.user.id,
        transaction_date: input.transaction_date,
        amount: input.amount,
        kind: input.kind,
        merchant: input.merchant ?? null,
        category_id: input.category_id ?? null,
        account_id: input.account_id ?? null,
        description: input.description ?? null,
        notes: input.notes ?? null,
        source: input.source ?? 'manual',
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TRANSACTIONS_KEY }),
  });
}

export interface UpdateTransactionInput extends Partial<AddTransactionInput> {
  id: string;
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: UpdateTransactionInput) => {
      const { error } = await supabase
        .from('transactions')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TRANSACTIONS_KEY }),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TRANSACTIONS_KEY }),
  });
}
