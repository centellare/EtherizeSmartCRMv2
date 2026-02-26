
import React, { useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Button, Input } from '../../../ui';
import { createNotification } from '../../../../lib/notifications';

interface TaskCompletionModalProps {
  task: any;
  onSuccess: (createNew?: boolean, completionComment?: string) => void;
}

export const TaskCompletionModal: React.FC<TaskCompletionModalProps> = ({ task, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [form, setForm] = useState({ comment: '', link: '', doc_name: '' });

  const handleSubmit = async (e: React.FormEvent, createNew: boolean = false) => {
    e.preventDefault();
    if (!task) return;
    setLoading(true);
    if (createNew) setIsCreatingNew(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.from('tasks').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: user?.id,
        completion_comment: form.comment,
        completion_doc_link: form.link,
        completion_doc_name: form.doc_name
      })
      .eq('id', task.id)
      .select(); // Check for rows
      
      if (error) throw error;

      // If RLS filters the row (permission denied), data will be empty but no error thrown
      if (!data || data.length === 0) {
          throw new Error('Нет прав на завершение этой задачи.');
      }

      // Log to object_history
      if (task.object_id) {
        await supabase.from('object_history').insert([{
          object_id: task.object_id,
          action_text: `Завершена задача: ${task.title}. Результат: ${form.comment}`,
          created_by: user?.id
        }]);
      }

      // Notify creator
      if (user && task.created_by && task.created_by !== user.id) {
        await createNotification(task.created_by, `Задача "${task.title}" выполнена.`, `#tasks/${task.id}`);
      }

      onSuccess(createNew, form.comment);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Ошибка при завершении задачи');
    } finally {
      setLoading(false);
      setIsCreatingNew(false);
    }
  };

  return (
    <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
      <textarea required className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm outline-none focus:border-blue-500 shadow-inner" rows={3} value={form.comment} onChange={(e) => setForm({...form, comment: e.target.value})} placeholder="Что было сделано..." />
      <Input label="Ссылка на результат" value={form.link} onChange={(e:any) => setForm({...form, link: e.target.value})} />
      <Input label="Название документа" value={form.doc_name} onChange={(e:any) => setForm({...form, doc_name: e.target.value})} />
      
      <div className="flex flex-col gap-2 pt-2">
        <Button 
          type="submit" 
          className="w-full h-12" 
          loading={loading && !isCreatingNew} 
          variant="primary"
        >
          Завершить задачу
        </Button>
        <Button 
          type="button" 
          onClick={(e) => handleSubmit(e, true)}
          className="w-full h-12" 
          loading={loading && isCreatingNew} 
          variant="tonal"
          icon="add_task"
        >
          Завершить и создать следующую
        </Button>
      </div>
    </form>
  );
};
