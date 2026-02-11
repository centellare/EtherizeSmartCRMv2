
import React, { useState } from 'react';
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
  const [checklist, setChecklist] = useState(task.checklist || []);

  const toggleChecklistItem = async (itemId: string, currentStatus: boolean) => {
    const isExecutor = task.assigned_to === profile.id;
    if (!isExecutor && !isAdmin) return;

    // Optimistic update
    setChecklist((prev: any[]) => prev.map((item: any) => 
        item.id === itemId ? { ...item, is_completed: !currentStatus } : item
    ));
    
    await supabase.from('task_checklists').update({ is_completed: !currentStatus }).eq('id', itemId);
  };

  if (!task) return null;

  const canEditDelete = () => {
    if (task.status === 'completed') return isAdmin;
    return isAdmin || task.created_by === profile?.id;
  };

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

        <div className="flex flex-wrap gap-2">
            {canEditDelete() && (
                <>
                <Button variant="tonal" onClick={onEdit} icon="edit" className="flex-1 min-w-[120px]">Изменить</Button>
                <Button variant="danger" onClick={onDelete} icon="delete" className="flex-1 min-w-[120px]">Удалить</Button>
                </>
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
