import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { ProfileDTO } from '../types/dto';

export const useTeamMembers = () => {
  return useQuery({
    queryKey: ['team'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .is('deleted_at', null)
        .in('role', ['admin', 'director', 'manager', 'specialist', 'storekeeper'])
        .order('full_name');
      
      if (error) throw error;
      return data as ProfileDTO[];
    }
  });
};

export const useTeamTasksStats = () => {
  return useQuery({
    queryKey: ['team_tasks_stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('assigned_to, status, deadline')
        .is('is_deleted', false)
        .neq('status', 'completed');
      
      if (error) throw error;
      return data || [];
    }
  });
};
