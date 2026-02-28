import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui';
import { TaskDTO } from '../types/dto';
import { createNotification } from '../lib/notifications';

interface ChecklistItem {
  id?: string;
  content: string;
  is_completed?: boolean;
}

interface QuestionItem {
  id?: string;
  question: string;
  answer?: string;
}

interface CreateTaskPayload {
  object_id: string;
  title: string;
  assigned_to_multiple: string[];
  start_date: string;
  deadline?: string;
  comment?: string;
  doc_link?: string;
  doc_name?: string;
  checklist: ChecklistItem[];
  questions: QuestionItem[];
  created_by: string;
}

interface UpdateTaskPayload {
  id: string;
  object_id: string;
  title: string;
  assigned_to: string;
  start_date: string;
  deadline?: string;
  comment?: string;
  doc_link?: string;
  doc_name?: string;
  checklist: ChecklistItem[];
  questions: QuestionItem[];
  updated_by: string;
}

export const useTaskMutations = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const createTask = useMutation({
    mutationFn: async ({ payload, objects, staff, profile }: { 
      payload: CreateTaskPayload, 
      objects: any[], 
      staff: any[], 
      profile: any 
    }) => {
      if (payload.assigned_to_multiple.length === 0) throw new Error('Выберите хотя бы одного исполнителя');

      const selectedObject = objects.find(o => o.id === payload.object_id);
      const currentStage = selectedObject?.current_stage || null;

      for (const assigneeId of payload.assigned_to_multiple) {
        const { data: newTask, error } = await supabase.from('tasks').insert([{
            object_id: payload.object_id,
            title: payload.title,
            assigned_to: assigneeId,
            start_date: payload.start_date,
            deadline: payload.deadline || null,
            comment: payload.comment || null,
            doc_link: payload.doc_link || null,
            doc_name: payload.doc_name || null,
            created_by: profile.id,
            stage_id: currentStage,
            status: 'pending'
        }]).select('id').single();

        if (error) throw error;
        const taskId = newTask.id;

        // Notify assignee
        if (assigneeId !== profile.id) {
          const assignedToName = staff.find(s => s.id === assigneeId)?.full_name || 'Сотрудник';
          const objectName = selectedObject?.name || 'Объект';
          const deadlineStr = payload.deadline ? new Date(payload.deadline).toLocaleDateString('ru-RU') : 'Не указан';
          
          const telegramMsg = `<b>📋 Вам назначена новая задача</b>\n\n` +
            `<b>👤 Кому:</b> ${assignedToName}\n` +
            `<b>👨‍💼 От кого:</b> ${profile.full_name}\n` +
            `<b>🏠 Объект:</b> ${objectName}\n` +
            `<b>📅 Дедлайн:</b> ${deadlineStr}\n` +
            `<b>📝 Задача:</b> ${payload.title}`;

          await createNotification(
            assigneeId, 
            `Вам назначена новая задача: ${payload.title}`, 
            `#tasks/${taskId}`,
            telegramMsg
          );
        }

        // Insert checklists for this task
        const itemsToInsert = payload.checklist
          .filter(c => c.content.trim() !== '')
          .map(c => ({
            task_id: taskId,
            content: c.content,
            is_completed: false
          }));

        if (itemsToInsert.length > 0) {
          const { error: chkError } = await supabase.from('task_checklists').insert(itemsToInsert);
          if (chkError) throw chkError;
        }

        // Insert questions for this task
        const questionsToInsert = payload.questions
          .filter(q => q.question.trim() !== '')
          .map(q => ({
            task_id: taskId,
            question: q.question,
            answer: null,
            created_by: profile.id
          }));

        if (questionsToInsert.length > 0) {
          const { error: qError } = await supabase.from('task_questions').insert(questionsToInsert);
          if (qError) throw qError;
        }
      }
    },
    onSuccess: () => {
      toast.success('Задачи успешно созданы');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при создании задач: ${error.message}`);
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ payload, initialData, objects, staff, profile }: { 
      payload: UpdateTaskPayload, 
      initialData: TaskDTO, 
      objects: any[], 
      staff: any[], 
      profile: any 
    }) => {
      const taskId = payload.id;
      
      const { error } = await supabase.from('tasks').update({
        object_id: payload.object_id,
        title: payload.title,
        assigned_to: payload.assigned_to,
        start_date: payload.start_date,
        deadline: payload.deadline || null,
        comment: payload.comment || null,
        doc_link: payload.doc_link || null,
        doc_name: payload.doc_name || null,
        last_edited_at: new Date().toISOString(),
        last_edited_by: profile.id
      }).eq('id', taskId);

      if (error) throw error;

      // Notify if assignee changed
      if (initialData.assigned_to !== payload.assigned_to && payload.assigned_to !== profile.id) {
        const assignedToName = staff.find(s => s.id === payload.assigned_to)?.full_name || 'Сотрудник';
        const objectName = objects.find(o => o.id === payload.object_id)?.name || 'Объект';
        const deadlineStr = payload.deadline ? new Date(payload.deadline).toLocaleDateString('ru-RU') : 'Не указан';
        
        const telegramMsg = `<b>📋 Вам назначена задача</b>\n\n` +
          `<b>👤 Кому:</b> ${assignedToName}\n` +
          `<b>👨‍💼 От кого:</b> ${profile.full_name}\n` +
          `<b>🏠 Объект:</b> ${objectName}\n` +
          `<b>📅 Дедлайн:</b> ${deadlineStr}\n` +
          `<b>📝 Задача:</b> ${payload.title}`;

        await createNotification(
          payload.assigned_to, 
          `Вам назначена задача: ${payload.title}`, 
          `#tasks/${taskId}`,
          telegramMsg
        );
      }

      // Update checklists
      const currentIds = payload.checklist.filter(c => c.id).map(c => c.id);
      if (currentIds.length > 0) {
        await supabase.from('task_checklists').delete().eq('task_id', taskId).not('id', 'in', `(${currentIds.join(',')})`);
      } else {
        await supabase.from('task_checklists').delete().eq('task_id', taskId);
      }

      const itemsToUpsert = payload.checklist
        .filter(c => c.content.trim() !== '')
        .map(c => ({
          ...(c.id ? { id: c.id } : {}),
          task_id: taskId,
          content: c.content,
          is_completed: c.is_completed || false
        }));

      if (itemsToUpsert.length > 0) {
        const { error: chkError } = await supabase.from('task_checklists').upsert(itemsToUpsert);
        if (chkError) throw chkError;
      }

      // Update questions
      const currentQIds = payload.questions.filter(q => q.id).map(q => q.id);
      if (currentQIds.length > 0) {
        await supabase.from('task_questions').delete().eq('task_id', taskId).not('id', 'in', `(${currentQIds.join(',')})`);
      } else {
        await supabase.from('task_questions').delete().eq('task_id', taskId);
      }

      const questionsToUpsert = payload.questions
        .filter(q => q.question.trim() !== '')
        .map(q => ({
          ...(q.id ? { id: q.id } : {}),
          task_id: taskId,
          question: q.question,
          answer: q.answer || null,
          created_by: profile.id
        }));

      if (questionsToUpsert.length > 0) {
        const { error: qError } = await supabase.from('task_questions').upsert(questionsToUpsert);
        if (qError) throw qError;
      }
    },
    onSuccess: () => {
      toast.success('Задача обновлена');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при обновлении задачи: ${error.message}`);
    },
  });

  return {
    createTask,
    updateTask,
  };
};
