import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui';
import { ClientDTO } from '../types/dto';

export const useClients = (profileId?: string) => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*, manager:profiles!fk_clients_manager(full_name, role), objects!fk_objects_client(id, name, is_deleted), partner:partners(id, name)')
        .is('deleted_at', null)
        .order('name');
      
      if (error) throw error;
      return data as unknown as ClientDTO[]; 
    },
    enabled: !!profileId
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      await api.softDelete('clients', id);
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
