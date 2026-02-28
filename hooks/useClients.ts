import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui';

export const useClients = (profileId?: string) => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('*, manager:profiles!fk_clients_manager(full_name), objects!fk_objects_client(id, name, is_deleted), partner:partners(id, name)')
        .is('deleted_at', null)
        .order('name');
      return data || []; 
    },
    enabled: !!profileId
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clients').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Клиент удален');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при удалении: ${error.message}`);
    }
  });

  return {
    clients,
    isLoading,
    deleteClient
  };
};
