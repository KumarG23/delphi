import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';
import { ACCOUNTS_KEY } from './accounts';
import type { BalanceSnapshot } from '@/types/database';

export const SNAPSHOTS_KEY = (accountId: string) => ['snapshots', accountId] as const;

export function useAccountSnapshots(accountId: string) {
  return useQuery({
    queryKey: SNAPSHOTS_KEY(accountId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('balance_snapshots')
        .select('*')
        .eq('account_id', accountId)
        .eq('is_active', true)
        .order('snapshot_date', { ascending: false })
        .limit(90);
      if (error) throw error;
      return data as BalanceSnapshot[];
    },
  });
}

export interface LogBalanceInput {
  account_id: string;
  snapshot_date: string;
  balance: number;
  apr?: number | null;
  apy?: number | null;
  min_payment?: number | null;
  payment_due_date?: string | null;
  notes?: string | null;
}

export function useLogBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LogBalanceInput) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('balance_snapshots')
        .upsert(
          {
            account_id: input.account_id,
            user_id: session.user.id,
            snapshot_date: input.snapshot_date,
            balance: input.balance,
            apr: input.apr ?? null,
            apy: input.apy ?? null,
            min_payment: input.min_payment ?? null,
            payment_due_date: input.payment_due_date ?? null,
            notes: input.notes ?? null,
          },
          { onConflict: 'account_id,snapshot_date' },
        );
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: SNAPSHOTS_KEY(variables.account_id) });
      qc.invalidateQueries({ queryKey: ACCOUNTS_KEY });
    },
  });
}

export function useDeleteSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; accountId: string }) => {
      const { error } = await supabase
        .from('balance_snapshots')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: SNAPSHOTS_KEY(variables.accountId) });
      qc.invalidateQueries({ queryKey: ACCOUNTS_KEY });
    },
  });
}
