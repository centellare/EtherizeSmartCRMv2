
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Object as CRMObject } from '../types';

export const useObjects = () => {
  return useQuery({
    queryKey: ['objects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('objects')
        .select('*')
        .is('is_deleted', false)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as CRMObject[];
    },
    staleTime: 1000 * 60 * 5,
  });
};
