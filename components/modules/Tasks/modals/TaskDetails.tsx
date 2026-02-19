
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Badge, Button } from '../../../ui';
import { formatDate, getMinskISODate } from '../../../../lib/dateUtils';

interface TaskDetailsProps {
  task: any;
  profile: any;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onNavigateToObject: (objId: string, stageId?: string) => void;
}

export const TaskDetails: React.FC<TaskDetailsProps> = ({ 
  task, profile, isAdmin, onEdit, onDelete, onClose, onNavigateToObject 
}) => {
  // Local state for optimistic checklist updates
  const [checklist, setChecklist] = useState(task?.checklist || []);
  const [questions, setQuestions] = useState(task?.questions || []);
  const [reopenLoading, setReopenLoading] = useState(false);

  // Sync state if task prop changes (important for Drawer persistence)
  useEffect(() => {
    if (task?.checklist) {
      setChecklist(task.checklist);
    }
    if (task?.questions) {
      setQuestions(task.questions);
    }
  }, [task]);

  const toggleChecklistItem = async (itemId: string, currentStatus: boolean) => {
    if (!task) return;
    const isExecutor = task.assigned_to === profile.id;
    if (!isExecutor && !isAdmin) return;

    // Optimistic update
    setChecklist((prev: any[]) => prev.map((item: any) => 
        item.id === itemId ? { ...item, is_completed: !currentStatus } : item
    ));
    
    await supabase.from('task_checklists').update({ is_completed: !currentStatus }).eq('id', itemId);
  };

  const saveAnswer = async (questionId: string, answer: string) => {
    if (!task) return;
    
    // Optimistic update
    setQuestions((prev: any[]) => prev.map((q: any) => 
        q.id === questionId ? { ...q, answer, answered_at: new Date().toISOString(), answered_by: profile.id } : q
    ));

    await supabase.from('task_questions').update({ 
        answer, 
        answered_at: new Date().toISOString(),
        answered_by: profile.id 
    }).eq('id', questionId);
  };

  const copyQuestionsToClipboard = () => {
    if (!questions.length) return;
    
    const text = questions.map((q: any, i: number) => 
        `${i + 1}. Вопрос: ${q.question}\n   Ответ: ${q.answer || '—'}`
    ).join('\n\n');
    
    navigator.clipboard.writeText(text).then(() => {
        alert('Вопросы и ответы скопированы в буфер обмена');
    });
  };

  const handleReopen = async () => {
      setReopenLoading(true);
      try {
          await supabase.from('tasks').update({
              status: 'pending',
              completed_at: null,
              completion_comment: null,
              completion_doc_link: null,
              completion_doc_name: null
          }).eq('id', task.id);
          
          // Close drawer to refresh list or update UI
          onClose(); 
          // Note: Realtime subscription in parent will handle the UI update
      } catch (e) {
          console.error(e);
          alert('Ошибка при возврате задачи');
      } finally {
          setReopenLoading(false);
      }
  };

  if (!task) return <div className="p-6 text-center text-slate-400">Задача не выбрана</div>;

  const canEditDelete = () => {
    if (task.status === 'completed') return isAdmin;
    return isAdmin || task.created_by === profile?.id;
  };

  // Determine if user can perform actions (Executor or Admin/Manager)
  const canAction = task.assigned_to === profile.id || isAdmin;

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-start">
            <h3 className="text-xl font-bold text-slate-900 leading-tight pr-4">{task.title}</h3>
            <Badge color={task.status === 'completed' ? 'emerald' : 'blue'}>
            {task.status === 'completed' ? 'ВЫПОЛНЕНО' : 'В РАБОТЕ'}
            </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-100">
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Объект</p>
                <p className="text-sm font-medium text-slate-700">{task.objects?.name || 'Не указан'}</p>
            </div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Срок</p>
                <p className={`text-sm font-bold ${task.deadline && task.deadline < getMinskISODate() && task.status !== 'completed' ? 'text-red-500' : 'text-slate-700'}`}>
                {task.deadline ? formatDate(task.deadline) : 'Бессрочно'}
                </p>
            </div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Поставил задачу</p>
                <p className="text-sm font-medium text-slate-700">{task.creator?.full_name || 'Система'}</p>
            </div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Создана</p>
                <p className="text-sm font-medium text-slate-700">{formatDate(task.created_at, true)}</p>
            </div>
        </div>

        {checklist.length > 0 && (
            <div className="bg-slate-50 p-5 rounded-[24px] border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Чек-лист выполнения</p>
                <div className="space-y-3">
                {checklist.map((item: any) => {
                    const canToggle = task.assigned_to === profile.id || isAdmin;
                    return (
                    <div key={item.id} className="flex items-start gap-3 group/item">
                        <button 
                        type="button"
                        disabled={!canToggle}
                        onClick={() => toggleChecklistItem(item.id, item.is_completed)}
                        className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors mt-0.5 ${item.is_completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white hover:border-blue-500'}`}
                        >
                        {item.is_completed && <span className="material-icons-round text-xs">check</span>}
                        </button>
                        <span className={`text-sm leading-tight transition-all ${item.is_completed ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>
                        {item.content}
                        </span>
                    </div>
                    );
                })}
                </div>
            </div>
        )}

        {questions.length > 0 && (
            <div className="bg-amber-50 p-5 rounded-[24px] border border-amber-100">
                <div className="flex justify-between items-center mb-4">
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Вопросы (Q&A)</p>
                    <button onClick={copyQuestionsToClipboard} className="text-amber-600 hover:text-amber-800 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                        <span className="material-icons-round text-sm">content_copy</span>
                        Копировать
                    </button>
                </div>
                <div className="space-y-4">
                {questions.map((item: any, idx: number) => {
                    const canAnswer = task.assigned_to === profile.id || isAdmin;
                    return (
                    <div key={item.id} className="flex flex-col gap-2">
                        <div className="flex gap-2">
                            <span className="text-amber-400 font-bold text-sm">{idx + 1}.</span>
                            <span className="text-sm font-medium text-slate-800">{item.question}</span>
                        </div>
                        <div className="pl-6">
                            {canAnswer ? (
                                <textarea
                                    className="w-full bg-white border border-amber-200 rounded-xl p-2 text-sm outline-none focus:border-amber-500 min-h-[60px]"
                                    placeholder="Введите ответ..."
                                    value={item.answer || ''}
                                    onChange={(e) => {
                                        // Update local state immediately for typing
                                        const val = e.target.value;
                                        setQuestions((prev: any[]) => prev.map((q: any) => q.id === item.id ? { ...q, answer: val } : q));
                                    }}
                                    onBlur={(e) => saveAnswer(item.id, e.target.value)}
                                />
                            ) : (
                                <p className={`text-sm ${item.answer ? 'text-slate-700' : 'text-slate-400 italic'}`}>
                                    {item.answer || 'Ответ не предоставлен'}
                                </p>
                            )}
                        </div>
                    </div>
                    );
                })}
                </div>
            </div>
        )}

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Ответственный</p>
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                {task.executor?.full_name?.charAt(0)}
                </div>
                <p className="text-sm font-bold text-slate-800">{task.executor?.full_name}</p>
            </div>
        </div>

        {(task.doc_link || task.completion_doc_link) && (
            <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Документация</p>
            {task.doc_link && (
                <a href={task.doc_link} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl hover:border-blue-300 transition-colors">
                <span className="material-icons-round text-blue-500">description</span>
                <span className="text-xs font-medium text-slate-700 truncate">{task.doc_name || 'Исходный документ'}</span>
                </a>
            )}
            {task.completion_doc_link && (
                <a href={task.completion_doc_link} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl hover:border-emerald-300 transition-colors">
                <span className="material-icons-round text-emerald-600">verified</span>
                <span className="text-xs font-medium text-emerald-900 truncate">{task.completion_doc_name || 'Отчет о выполнении'}</span>
                </a>
            )}
            </div>
        )}

        {task.comment && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Описание / ТЗ</p>
            <p className="text-sm text-slate-600 whitespace-pre-wrap italic leading-relaxed">{task.comment}</p>
            </div>
        )}
        
        {/* Completion Info if Completed */}
        {task.status === 'completed' && task.completion_comment && (
             <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-2">Комментарий исполнителя</p>
                <p className="text-sm text-emerald-900 italic">{task.completion_comment}</p>
             </div>
        )}

        <div className="flex flex-wrap gap-2">
            {canEditDelete() && task.status !== 'completed' && (
                <>
                <Button variant="tonal" onClick={onEdit} icon="edit" className="flex-1 min-w-[120px]">Изменить</Button>
                <Button variant="danger" onClick={onDelete} icon="delete" className="flex-1 min-w-[120px]">Удалить</Button>
                </>
            )}
            
            {/* Logic for Completed Tasks: Show Reopen Button */}
            {task.status === 'completed' && canAction && (
                <Button 
                    variant="secondary" 
                    onClick={handleReopen} 
                    loading={reopenLoading}
                    icon="replay" 
                    className="flex-1 min-w-[140px] text-amber-600 border-amber-200 hover:bg-amber-50"
                >
                    Вернуть в работу
                </Button>
            )}

            {task.object_id && (
                <Button 
                onClick={() => { 
                    onNavigateToObject(task.object_id, task.stage_id); 
                    onClose(); 
                }} 
                icon="open_in_new" 
                className="flex-1 min-w-[120px]"
                >
                К объекту
                </Button>
            )}
        </div>
    </div>
  );
};
