
import React, { useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Button, Input } from '../../../ui';
import { createNotification } from '../../../../lib/notifications';

interface TaskCompletionModalProps {
  task: any;
  onSuccess: () => void;
}

export const TaskCompletionModal: React.FC<TaskCompletionModalProps> = ({ task, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ comment: '', link: '', doc_name: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('tasks').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
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

      // Notify creator
      const { data: { user } } = await supabase.auth.getUser();
      if (user && task.created_by && task.created_by !== user.id) {
        await createNotification(task.created_by, `Задача "${task.title}" выполнена.`);
      }

      onSuccess();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Ошибка при завершении задачи');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <textarea required className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm outline-none focus:border-blue-500 shadow-inner" rows={3} value={form.comment} onChange={(e) => setForm({...form, comment: e.target.value})} placeholder="Что было сделано..." />
      <Input label="Ссылка на результат" value={form.link} onChange={(e:any) => setForm({...form, link: e.target.value})} />
      <Input label="Название документа" value={form.doc_name} onChange={(e:any) => setForm({...form, doc_name: e.target.value})} />
      <Button type="submit" className="w-full h-12" loading={loading} variant="primary">Завершить задачу</Button>
    </form>
  );
};
