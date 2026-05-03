import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';
import type { Profile } from '@/types/database';

export const PROFILE_KEY = ['profile'] as const;

export function useProfile() {
  return useQuery({
    queryKey: PROFILE_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').single();
      if (error) throw error;
      return data as Profile;
    },
  });
}

export type UpdateProfileInput = Partial<
  Pick<
    Profile,
    'display_name' | 'reminder_cadence' | 'reminder_day_of_month' | 'reminder_hour_local' | 'timezone'
  >
>;

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PROFILE_KEY }),
  });
}
