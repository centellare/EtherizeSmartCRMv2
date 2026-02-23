
import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { Button, Input, Select } from '../../../ui';
import { getMinskISODate } from '../../../../lib/dateUtils';
import { createNotification } from '../../../../lib/notifications';

interface TaskModalProps {
  mode: 'create' | 'edit';
  initialData?: any;
  profile: any;
  staff: any[];
  objects: any[];
  onSuccess: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({ mode, initialData, profile, staff, objects, onSuccess }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    id: '', 
    object_id: '', 
    title: '', 
    assigned_to: '', 
    start_date: getMinskISODate(), 
    deadline: '', 
    comment: '', 
    doc_link: '', 
    doc_name: '',
    checklist: [] as { id?: string; content: string; is_completed?: boolean }[],
    questions: [] as { id?: string; question: string; answer?: string }[]
  });

  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setFormData({
        id: initialData.id,
        object_id: initialData.object_id,
        title: initialData.title,
        assigned_to: initialData.assigned_to,
        start_date: initialData.start_date ? getMinskISODate(initialData.start_date) : getMinskISODate(),
        deadline: initialData.deadline ? getMinskISODate(initialData.deadline) : '',
        comment: initialData.comment || '',
        doc_link: initialData.doc_link || '',
        doc_name: initialData.doc_name || '',
        checklist: initialData.checklist?.map((c: any) => ({ id: c.id, content: c.content, is_completed: c.is_completed })) || [],
        questions: initialData.questions?.map((q: any) => ({ id: q.id, question: q.question, answer: q.answer })) || []
      });
    } else {
      // Reset for create mode
      setFormData({
        id: '', 
        object_id: objects.length === 1 ? objects[0].id : '', // Auto-select if only 1 object
        title: '', 
        assigned_to: '', 
        start_date: getMinskISODate(), 
        deadline: '', 
        comment: '', 
        doc_link: '', 
        doc_name: '', 
        checklist: [],
        questions: []
      });
    }
  }, [mode, initialData, objects]);

  const addChecklistItem = () => {
    setFormData(prev => ({
      ...prev,
      checklist: [...prev.checklist, { content: '' }]
    }));
  };

  const updateChecklistItem = (index: number, content: string) => {
    const newList = [...formData.checklist];
    newList[index].content = content;
    setFormData({ ...formData, checklist: newList });
  };

  const removeChecklistItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      checklist: prev.checklist.filter((_, i) => i !== index)
    }));
  };

  const addQuestionItem = () => {
    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, { question: '' }]
    }));
  };

  const updateQuestionItem = (index: number, content: string) => {
    const newList = [...formData.questions];
    newList[index].question = content;
    setFormData({ ...formData, questions: newList });
  };

  const removeQuestionItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!formData.object_id) throw new Error('Выберите объект');
      if (!formData.title.trim()) throw new Error('Введите название задачи');
      if (!formData.assigned_to) throw new Error('Выберите исполнителя');

      let taskId = formData.id;
      
      if (mode === 'edit') {
        const { error } = await supabase.from('tasks').update({
          object_id: formData.object_id,
          title: formData.title,
          assigned_to: formData.assigned_to,
          start_date: formData.start_date,
          deadline: formData.deadline || null,
          comment: formData.comment,
          doc_link: formData.doc_link,
          doc_name: formData.doc_name,
          last_edited_at: new Date().toISOString(),
          last_edited_by: profile.id
        }).eq('id', formData.id);

        if (error) throw error;

        // Notify if assignee changed
        if (initialData.assigned_to !== formData.assigned_to && formData.assigned_to !== profile.id) {
          await createNotification(formData.assigned_to, `Вам назначена задача: ${formData.title}`, `#tasks/${taskId}`);
        }

      } else {
        // Find current stage from objects list
        const selectedObject = objects.find(o => o.id === formData.object_id);
        const currentStage = selectedObject?.current_stage || null;

        const { data: newTask, error } = await supabase.from('tasks').insert([{
            object_id: formData.object_id,
            title: formData.title,
            assigned_to: formData.assigned_to,
            start_date: formData.start_date,
            deadline: formData.deadline || null,
            comment: formData.comment,
            doc_link: formData.doc_link || null,
            doc_name: formData.doc_name || null,
            created_by: profile.id,
            stage_id: currentStage,
            status: 'pending'
        }]).select('id').single();

        if (error) throw error;
        if (newTask) taskId = newTask.id;

        // Notify assignee
        if (formData.assigned_to !== profile.id) {
          await createNotification(formData.assigned_to, `Вам назначена новая задача: ${formData.title}`, `#tasks/${taskId}`);
        }
      }

      if (taskId) {
        if (mode === 'edit') {
          const currentIds = formData.checklist.filter(c => c.id).map(c => c.id);
          if (currentIds.length > 0) {
            await supabase.from('task_checklists').delete().eq('task_id', taskId).not('id', 'in', `(${currentIds.join(',')})`);
          } else {
            await supabase.from('task_checklists').delete().eq('task_id', taskId);
          }

          const currentQIds = formData.questions.filter(q => q.id).map(q => q.id);
          if (currentQIds.length > 0) {
            await supabase.from('task_questions').delete().eq('task_id', taskId).not('id', 'in', `(${currentQIds.join(',')})`);
          } else {
            await supabase.from('task_questions').delete().eq('task_id', taskId);
          }
        }

        const itemsToUpsert = formData.checklist
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

        const questionsToUpsert = formData.questions
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
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onSuccess();
    },
    onError: (error: any) => {
      alert(`Ошибка: ${error.message || 'Не удалось сохранить'}`);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Что нужно сделать?" required value={formData.title} onChange={(e:any) => setFormData({...formData, title: e.target.value})} />
        <Select label="Объект" required value={formData.object_id} onChange={(e:any) => setFormData({...formData, object_id: e.target.value})} options={[{value: '', label: 'Выберите объект'}, ...objects.map(o => ({value: o.id, label: o.name}))]} />
        <Select label="Исполнитель" required value={formData.assigned_to} onChange={(e:any) => setFormData({...formData, assigned_to: e.target.value})} options={[{value: '', label: 'Выбрать исполнителя'}, ...staff.map(s => ({value: s.id, label: s.full_name}))]} />
        <div className="grid grid-cols-2 gap-4">
        <Input label="Начало" type="date" required value={formData.start_date} onChange={(e:any) => setFormData({...formData, start_date: e.target.value})} />
        <Input label="Дедлайн" type="date" value={formData.deadline} onChange={(e:any) => setFormData({...formData, deadline: e.target.value})} />
        </div>
        
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Документация (опц.)</p>
            <div className="grid grid-cols-2 gap-4">
            <Input label="Имя документа" value={formData.doc_name} onChange={(e:any) => setFormData({ ...formData, doc_name: e.target.value })} icon="description" />
            <Input label="Ссылка" value={formData.doc_link} onChange={(e:any) => setFormData({ ...formData, doc_link: e.target.value })} icon="link" />
            </div>
        </div>

        <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Подзадачи (чек-лист)</p>
            <button type="button" onClick={addChecklistItem} className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors">
                <span className="material-icons-round text-sm">add</span>
            </button>
            </div>
            <div className="space-y-2">
            {formData.checklist.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                <input 
                    className="flex-grow bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-blue-500" 
                    value={item.content} 
                    onChange={(e) => updateChecklistItem(idx, e.target.value)} 
                    placeholder={`Пункт ${idx + 1}`} 
                />
                <button type="button" onClick={() => removeChecklistItem(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                    <span className="material-icons-round text-sm">remove_circle_outline</span>
                </button>
                </div>
            ))}
            </div>
        </div>

        <div className="space-y-3 bg-amber-50 p-4 rounded-2xl border border-amber-100">
            <div className="flex justify-between items-center mb-1">
            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Вопросы (Q&A)</p>
            <button type="button" onClick={addQuestionItem} className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 transition-colors">
                <span className="material-icons-round text-sm">add</span>
            </button>
            </div>
            <div className="space-y-2">
            {formData.questions.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                <input 
                    className="flex-grow bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-amber-500" 
                    value={item.question} 
                    onChange={(e) => updateQuestionItem(idx, e.target.value)} 
                    placeholder={`Вопрос ${idx + 1}`} 
                />
                <button type="button" onClick={() => removeQuestionItem(idx)} className="text-amber-300 hover:text-red-500 transition-colors">
                    <span className="material-icons-round text-sm">remove_circle_outline</span>
                </button>
                </div>
            ))}
            </div>
        </div>

        <div className="w-full">
        <label className="block text-xs font-medium text-[#444746] mb-1.5 ml-1">Описание / ТЗ</label>
        <textarea className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:border-blue-500" rows={3} placeholder="Описание / детали..." value={formData.comment} onChange={(e) => setFormData({...formData, comment: e.target.value})} />
        </div>
        <Button type="submit" className="w-full h-14" loading={mutation.isPending}>{mode === 'edit' ? 'Сохранить изменения' : 'Создать задачу'}</Button>
    </form>
  );
};
