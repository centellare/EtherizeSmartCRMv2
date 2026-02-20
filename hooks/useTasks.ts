
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Task } from '../types';

export const useTasks = (options: { userId?: string; objectId?: string } = {}) => {
  return useQuery({
    queryKey: ['tasks', options],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('*, objects(name)')
        .is('is_deleted', false);

      if (options.userId) {
        query = query.eq('assigned_to', options.userId);
      }
      if (options.objectId) {
        query = query.eq('object_id', options.objectId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Task[];
    },
    staleTime: 1000 * 60 * 2,
  });
};
