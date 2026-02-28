import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui';

export const useObjectWorkflowMutations = (objectId: string) => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const updateStatus = useMutation({
    mutationFn: async ({ status, userId }: { status: string, userId: string }) => {
      const { error } = await supabase
        .from('objects')
        .update({ current_status: status, updated_by: userId, updated_at: new Date().toISOString() })
        .eq('id', objectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['object', objectId] });
      toast.success('Статус объекта обновлен');
    },
    onError: () => toast.error('Ошибка обновления статуса')
  });

  const nextStage = useMutation({
    mutationFn: async (params: { nextStage: string, responsibleId: string, deadline: string | null, userId: string }) => {
      const { error } = await supabase.rpc('transition_object_stage', {
        p_object_id: objectId,
        p_next_stage: params.nextStage,
        p_responsible_id: params.responsibleId,
        p_deadline: params.deadline,
        p_user_id: params.userId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['object', objectId] });
      queryClient.invalidateQueries({ queryKey: ['object_stages', objectId] });
      toast.success('Переход на новый этап выполнен');
    },
    onError: (err: any) => toast.error(err.message || 'Ошибка перехода')
  });

  const rollbackStage = useMutation({
    mutationFn: async (params: { targetStage: string, reason: string, responsibleId: string, userId: string }) => {
      const { error } = await supabase.rpc('rollback_object_stage', {
        p_object_id: objectId,
        p_target_stage: params.targetStage,
        p_reason: params.reason,
        p_responsible_id: params.responsibleId,
        p_user_id: params.userId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['object', objectId] });
      queryClient.invalidateQueries({ queryKey: ['object_stages', objectId] });
      toast.success('Объект возвращен на доработку');
    },
    onError: (err: any) => toast.error(err.message || 'Ошибка возврата')
  });

  const restoreStage = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('restore_object_stage', {
        p_object_id: objectId,
        p_user_id: userId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['object', objectId] });
      queryClient.invalidateQueries({ queryKey: ['object_stages', objectId] });
      toast.success('Этап успешно восстановлен');
    },
    onError: (err: any) => toast.error(err.message || 'Ошибка восстановления этапа')
  });

  const finalizeProject = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('finalize_project', { p_object_id: objectId, p_user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['object', objectId] });
      toast.success('Проект успешно завершен!');
    },
    onError: () => toast.error('Ошибка при завершении проекта')
  });

  return {
    updateStatus,
    nextStage,
    rollbackStage,
    restoreStage,
    finalizeProject
  };
};
