
import { useQuery } from '@tanstack/react-query';
import { supabase, measureQuery } from '../lib/supabase';
import { TaskDTO } from '../types/dto';

export const useTasks = (options: { 
  userId?: string; 
  objectId?: string;
  filterMode?: 'all' | 'mine' | 'created';
  status?: string[];
  isDeleted?: boolean;
} = {}) => {
  return useQuery({
    queryKey: ['tasks', options],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select(`
          *, 
          checklist:task_checklists(*), 
          questions:task_questions(*), 
          executor:profiles!assigned_to(id, full_name, role), 
          objects(id, name, responsible_id), 
          creator:profiles!created_by(id, full_name)
        `)
        .is('is_deleted', options.isDeleted || false);

      if (options.status) {
        query = query.in('status', options.status);
      }

      if (options.objectId) {
        query = query.eq('object_id', options.objectId);
      }

      if (options.filterMode === 'mine' && options.userId) {
        query = query.eq('assigned_to', options.userId);
      } else if (options.filterMode === 'created' && options.userId) {
        query = query.eq('created_by', options.userId);
      }

      const { data, error } = await measureQuery(query.order('created_at', { ascending: false }));
      
      if (error) throw error;
      return data as unknown as TaskDTO[];
    },
    staleTime: 1000 * 60 * 2,
  });
};
