import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useToast } from '../components/ui';
import { ObjectDTO } from '../types/dto';
import { createNotification } from '../lib/notifications';

interface CreateObjectPayload {
  name: string;
  address?: string | null;
  client_id: string;
  responsible_id: string;
  comment?: string | null;
  created_by: string;
}

interface UpdateObjectPayload {
  id: string;
  name: string;
  address?: string | null;
  client_id: string;
  responsible_id: string;
  comment?: string | null;
  updated_by: string;
}

export const useObjectMutations = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const createObject = useMutation({
    mutationFn: async ({ payload, clients, staff, profile }: { 
      payload: CreateObjectPayload, 
      clients: any[], 
      staff: any[], 
      profile: any 
    }) => {
      const newObject = await api.create<ObjectDTO>('objects', {
        ...payload,
        current_stage: 'negotiation',
        current_status: 'in_work',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Notify responsible
      if (newObject && payload.responsible_id && payload.responsible_id !== profile.id) {
        const clientName = clients.find(c => c.id === payload.client_id)?.name || 'Не указан';
        const responsibleName = staff.find(s => s.id === payload.responsible_id)?.full_name || 'Сотрудник';
        
        const telegramMsg = `${responsibleName}, 🏠 Вам назначен новый объект\n\n` +
          `<b>🏗 Объект:</b> ${payload.name}\n` +
          `<b>📍 Адрес:</b> ${payload.address || 'Не указан'}\n` +
          `<b>👨‍💼 Кто назначил:</b> ${profile.full_name}\n` +
          `<b>👤 Клиент:</b> ${clientName}`;

        await createNotification(
          payload.responsible_id, 
          `Вам назначен новый объект: ${payload.name}`, 
          `#objects/${newObject.id}`,
          telegramMsg
        );
      }

      return newObject;
    },
    onSuccess: () => {
      toast.success('Объект успешно создан');
      queryClient.invalidateQueries({ queryKey: ['objects'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при создании объекта: ${error.message}`);
    },
  });

  const updateObject = useMutation({
    mutationFn: async ({ payload, initialData, clients, staff, profile }: { 
      payload: UpdateObjectPayload, 
      initialData: ObjectDTO, 
      clients: any[], 
      staff: any[], 
      profile: any 
    }) => {
      const updatedObject = await api.update<ObjectDTO>('objects', payload.id, {
        ...payload,
        updated_at: new Date().toISOString(),
      });

      // Notify responsible if changed
      if (initialData.responsible_id !== payload.responsible_id && payload.responsible_id && payload.responsible_id !== profile.id) {
        const clientName = clients.find(c => c.id === payload.client_id)?.name || 'Не указан';
        const responsibleName = staff.find(s => s.id === payload.responsible_id)?.full_name || 'Сотрудник';
        
        const telegramMsg = `${responsibleName}, 🏠 Вам назначен объект\n\n` +
          `<b>🏗 Объект:</b> ${payload.name}\n` +
          `<b>📍 Адрес:</b> ${payload.address || 'Не указан'}\n` +
          `<b>👨‍💼 Кто назначил:</b> ${profile.full_name}\n` +
          `<b>👤 Клиент:</b> ${clientName}`;

        await createNotification(
          payload.responsible_id, 
          `Вам назначен объект: ${payload.name}`, 
          `#objects/${initialData.id}`,
          telegramMsg
        );
      }

      return updatedObject;
    },
    onSuccess: () => {
      toast.success('Данные объекта обновлены');
      queryClient.invalidateQueries({ queryKey: ['objects'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при обновлении объекта: ${error.message}`);
    },
  });

  return {
    createObject,
    updateObject,
  };
};
