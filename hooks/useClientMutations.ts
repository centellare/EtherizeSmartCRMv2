import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useToast } from '../components/ui';
import { ClientDTO } from '../types/dto';
import { createNotification } from '../lib/notifications';

interface CreateClientPayload {
  name: string;
  type: 'person' | 'company';
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  requisites?: string | null;
  lead_source?: string | null;
  partner_id?: string | null;
  manager_id?: string | null;
  created_by: string;
}

interface UpdateClientPayload {
  id: string;
  name: string;
  type: 'person' | 'company';
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  requisites?: string | null;
  lead_source?: string | null;
  partner_id?: string | null;
  manager_id?: string | null;
  updated_by: string;
}

export const useClientMutations = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const createClient = useMutation({
    mutationFn: async ({ payload, staff, profile }: { payload: CreateClientPayload, staff: any[], profile: any }) => {
      const newClient = await api.create<ClientDTO>('clients', {
        ...payload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Notify manager
      if (payload.manager_id && payload.manager_id !== profile.id) {
        const managerName = staff.find(s => s.id === payload.manager_id)?.full_name || 'Менеджер';
        
        const telegramMsg = `${managerName}, 👤 Вам назначен новый клиент\n\n` +
          `<b>🏢 Клиент:</b> ${payload.name}\n` +
          `<b>👨‍💼 Кто назначил:</b> ${profile.full_name}\n` +
          `<b>📞 Телефон:</b> ${payload.phone || 'Не указан'}`;

        await createNotification(
          payload.manager_id!, 
          `Вам назначен новый клиент: ${payload.name}`, 
          `#clients/${newClient.id}`,
          telegramMsg
        );
      }

      return newClient;
    },
    onSuccess: () => {
      toast.success('Клиент успешно создан');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при создании клиента: ${error.message}`);
    },
  });

  const updateClient = useMutation({
    mutationFn: async ({ payload, initialData, staff, profile }: { 
      payload: UpdateClientPayload, 
      initialData: ClientDTO, 
      staff: any[], 
      profile: any 
    }) => {
      const updatedClient = await api.update<ClientDTO>('clients', payload.id, {
        ...payload,
        updated_at: new Date().toISOString(),
      });

      // Notify manager if changed
      if (initialData.manager_id !== payload.manager_id && payload.manager_id && payload.manager_id !== profile.id) {
        const managerName = staff.find(s => s.id === payload.manager_id)?.full_name || 'Менеджер';
        
        await createNotification(
          payload.manager_id, 
          `Вам назначен клиент: ${payload.name}`, 
          `#clients/${initialData.id}`,
          'info'
        );
      }

      return updatedClient;
    },
    onSuccess: () => {
      toast.success('Данные клиента обновлены');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при обновлении клиента: ${error.message}`);
    },
  });

  return {
    createClient,
    updateClient,
  };
};
