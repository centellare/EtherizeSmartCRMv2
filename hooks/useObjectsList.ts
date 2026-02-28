import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui';
import { ObjectDTO } from '../types/dto';

export const useObjectsList = (profileId?: string) => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: objects = [], isLoading } = useQuery({
    queryKey: ['objects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('objects')
        .select('*, client:clients(name), responsible:profiles!responsible_id(full_name), tasks(id, status, is_deleted)')
        .is('is_deleted', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as ObjectDTO[];
    },
    enabled: !!profileId,
    refetchInterval: 5000, // Poll every 5 seconds
    staleTime: 1000
  });

  const deleteObject = useMutation({
    mutationFn: async ({ id, profileId }: { id: string, profileId: string }) => {
      const now = new Date().toISOString();
      await api.softDelete('objects', id, profileId);
      
      // Cascade soft delete (manual for now, ideally should be DB trigger or separate service method)
      const { error: taskError } = await supabase.from('tasks').update({ is_deleted: true, deleted_at: now }).eq('object_id', id);
      if (taskError) throw taskError;

      const { error: transError } = await supabase.from('transactions').update({ deleted_at: now }).eq('object_id', id);
      if (transError) throw transError;
    },
    onSuccess: () => {
      toast.success('Объект и связанные данные перенесены в корзину');
      queryClient.invalidateQueries({ queryKey: ['objects'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при удалении: ${error.message}`);
    }
  });

  return {
    objects,
    isLoading,
    deleteObject
  };
};
