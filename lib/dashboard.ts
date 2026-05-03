import { useQuery } from '@tanstack/react-query';

import { supabase } from './supabase';
import type { NetWorthPoint } from '@/types/database';

export const NET_WORTH_KEY = ['net_worth_history'] as const;

export function useNetWorthHistory() {
  return useQuery({
    queryKey: NET_WORTH_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_net_worth_history')
        .select('*')
        .order('snapshot_date', { ascending: true });
      if (error) throw error;
      return data as NetWorthPoint[];
    },
  });
}
