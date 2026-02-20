
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Profile } from './useAuth';

export const useStaff = () => {
  return useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .is('deleted_at', null)
        .order('full_name');

      if (error) throw error;
      return data as Profile[];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};
