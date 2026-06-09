import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';
import type { Event } from '@/types/database';

export const EVENTS_KEY = ['events'] as const;

export function useEvents() {
  return useQuery({
    queryKey: EVENTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Event[];
    },
  });
}

export interface CreateEventInput {
  event_date: string;
  label: string;
  note?: string | null;
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEventInput) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase.from('events').insert({
        user_id: session.user.id,
        event_date: input.event_date,
        label: input.label.trim(),
        note: input.note?.trim() || null,
        account_id: null,  // v1: global milestones only
        category: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EVENTS_KEY });
    },
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EVENTS_KEY });
    },
  });
}
