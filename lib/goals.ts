import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';
import type { AccountSummary, NetWorthPoint } from '@/types/database';

// Hand-defined (do not import from generated types/database.ts).
// TODO: switch to generated type after regen
export type GoalKind = 'payoff' | 'accumulate' | 'category_target';
export type GoalStatus = 'active' | 'achieved' | 'missed' | 'abandoned';

export interface Goal {
  id: string;
  user_id: string;
  kind: GoalKind;
  account_id: string | null;
  category: string | null;     // unused for v1 (category_target only)
  name: string;
  start_value: number;
  target_value: number;
  target_date: string | null;  // 'YYYY-MM-DD'
  status: GoalStatus;
  achieved_at: string | null;
  created_at: string;
  updated_at: string;
}

export const GOALS_KEY = ['goals'] as const;

export interface CreateGoalInput {
  kind: GoalKind;
  account_id: string | null;
  name: string;
  start_value: number;
  target_value: number;
  target_date?: string | null;
}

export interface UpdateGoalInput {
  id: string;
  name: string;
  target_value: number;
  target_date?: string | null;
}

export function useGoals() {
  return useQuery({
    queryKey: GOALS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .in('status', ['active', 'achieved'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Goal[];
    },
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateGoalInput) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase.from('goals').insert({
        user_id: session.user.id,
        kind: input.kind,
        account_id: input.account_id,
        category: null, // v1: category_target out of scope
        name: input.name.trim(),
        start_value: input.start_value,
        target_value: input.target_value,
        target_date: input.target_date || null,
        status: 'active',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GOALS_KEY });
    },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateGoalInput) => {
      const { error } = await supabase
        .from('goals')
        .update({
          name: input.name.trim(),
          target_value: input.target_value,
          target_date: input.target_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: GOALS_KEY }),
  });
}

export function useAbandonGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('goals')
        .update({
          status: 'abandoned',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: GOALS_KEY }),
  });
}

export function useMarkAchieved() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('goals')
        .update({
          status: 'achieved',
          achieved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: GOALS_KEY }),
  });
}

export interface GoalProgress {
  current: number;
  progress: number;   // 0..1 clamped
  pct: number;        // progress*100 for display
  achieved: boolean;
  verdict: 'achieved' | 'on_track' | 'behind' | 'no_deadline';
  remaining: number;  // >= 0
}

function parseDate(d: string | null | undefined): Date | null {
  if (!d) return null;
  // Handle both 'YYYY-MM-DD' and timestamptz
  const datePart = d.includes('T') ? d.split('T')[0] : d;
  const [y, m, day] = datePart.split('-').map(Number);
  if (!y || !m || !day) return null;
  return new Date(y, m - 1, day);
}

export function computeGoalProgress(
  goal: Goal,
  ctx: { accounts?: AccountSummary[] | null; netWorthHistory?: NetWorthPoint[] | null }
): GoalProgress {
  const { accounts, netWorthHistory } = ctx;

  // Determine current value
  let current = 0;
  if (goal.kind === 'payoff' || (goal.kind === 'accumulate' && goal.account_id)) {
    const acc = accounts?.find((a) => a.id === goal.account_id);
    current = acc?.latest_balance ?? 0;
  } else if (goal.kind === 'accumulate' && !goal.account_id) {
    // Net-worth goal
    if (netWorthHistory && netWorthHistory.length > 0) {
      current = netWorthHistory[netWorthHistory.length - 1].net_worth;
    } else {
      current = 0;
    }
  }

  const start = goal.start_value;
  const target = goal.target_value;

  let progress = 0;
  let achieved = false;

  if (goal.kind === 'payoff') {
    const denom = start - target;
    if (denom === 0) {
      progress = current <= target ? 1 : 0;
    } else {
      progress = (start - current) / denom;
    }
    achieved = current <= target;
  } else {
    // accumulate (savings or net-worth)
    const denom = target - start;
    if (denom === 0) {
      progress = current >= target ? 1 : 0;
    } else {
      progress = (current - start) / denom;
    }
    achieved = current >= target;
  }

  progress = Math.max(0, Math.min(1, progress));
  const pct = progress * 100;
  const remaining = Math.max(0, Math.abs(target - current));

  // Verdict
  let verdict: GoalProgress['verdict'] = 'no_deadline';
  if (achieved) {
    verdict = 'achieved';
  } else if (goal.target_date) {
    const created = parseDate(goal.created_at);
    const targetD = parseDate(goal.target_date);
    const today = parseDate(new Date().toISOString().split('T')[0]);
    if (created && targetD && today && targetD.getTime() > created.getTime()) {
      const total = targetD.getTime() - created.getTime();
      const elapsedMs = today.getTime() - created.getTime();
      const elapsed = Math.min(1, Math.max(0, elapsedMs / total));
      verdict = progress >= elapsed - 0.05 ? 'on_track' : 'behind';
    } else {
      verdict = 'no_deadline';
    }
  }

  return {
    current,
    progress,
    pct,
    achieved,
    verdict,
    remaining,
  };
}
