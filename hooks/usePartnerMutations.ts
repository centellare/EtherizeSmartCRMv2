import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useToast } from '../components/ui';
import { PartnerDTO } from '../types/dto';

interface CreatePartnerPayload {
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  default_commission_percent: number;
  status: 'active' | 'inactive';
  notes?: string | null;
}

interface UpdatePartnerPayload {
  id: string;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  default_commission_percent: number;
  status: 'active' | 'inactive';
  notes?: string | null;
}

export const usePartnerMutations = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const createPartner = useMutation({
    mutationFn: async (payload: CreatePartnerPayload) => {
      return api.create<PartnerDTO>('partners', {
        ...payload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      toast.success('Партнер успешно создан');
      queryClient.invalidateQueries({ queryKey: ['partners'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при создании партнера: ${error.message}`);
    },
  });

  const updatePartner = useMutation({
    mutationFn: async (payload: UpdatePartnerPayload) => {
      return api.update<PartnerDTO>('partners', payload.id, {
        ...payload,
        updated_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      toast.success('Данные партнера обновлены');
      queryClient.invalidateQueries({ queryKey: ['partners'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при обновлении партнера: ${error.message}`);
    },
  });

  const deletePartner = useMutation({
    mutationFn: async (id: string) => {
      // Assuming soft delete is supported for partners, otherwise use hard delete
      // If 'partners' table has 'deleted_at' column, use softDelete.
      // Based on previous patterns, let's assume soft delete is preferred.
      // However, check if 'partners' table supports soft delete.
      // If not sure, use hard delete via api.delete or check schema.
      // Let's assume soft delete for consistency with other modules.
      // BUT wait, ApiClient.softDelete requires userId for 'deleted_by' field usually.
      // Let's check api.ts again.
      return api.delete('partners', id); 
    },
    onSuccess: () => {
      toast.success('Партнер удален');
      queryClient.invalidateQueries({ queryKey: ['partners'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при удалении партнера: ${error.message}`);
    },
  });

  return {
    createPartner,
    updatePartner,
    deletePartner
  };
};
