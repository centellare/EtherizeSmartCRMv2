
import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Modal, Input, Select, ConfirmModal, Badge } from '../../ui';
import { formatDate, getMinskISODate } from '../../../lib/dateUtils';
import { TaskModal } from '../Tasks/modals/TaskModal';

const STAGES = [
  { id: 'negotiation', label: 'Переговоры' },
  { id: 'design', label: 'Проектирование' },
  { id: 'logistics', label: 'Логистика' },
  { id: 'assembly', label: 'Сборка' },
  { id: 'mounting', label: 'Монтаж' },
  { id: 'commissioning', label: 'Пусконаладка' },
  { id: 'programming', label: 'Программирование' },
  { id: 'support', label: 'Поддержка' }
];

interface TasksTabProps {
  object: any;
  profile: any;
  viewedStageId: string;
  tasks: any[];
  staff: any[];
  canManage: boolean;
  refreshData: () => Promise<void>;
  onStartNextStage: () => void;
  onJumpForward: () => void;
  onRollback: () => void;
  updateStatus: (s: string) => void;
  forceOpenTaskModal?: boolean;
  onTaskModalOpened?: () => void;
}

export const TasksTab: React.FC<TasksTabProps> = ({
  object,
  profile,
  viewedStageId,
  tasks: allTasks,
  staff,
  canManage,
  refreshData,
  onStartNextStage,
  onJumpForward,
  onRollback,
  updateStatus,
  forceOpenTaskModal,
  onTaskModalOpened
}) => {
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isTaskDetailsModalOpen, setIsTaskDetailsModalOpen] = useState(false);
  const [isTaskCloseModalOpen, setIsTaskCloseModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  const [closeForm, setCloseForm] = useState({ comment: '', link: '', doc_name: '' });
  const [checklists, setChecklists] = useState<Record<string, any[]>>({});

  useEffect(() => {
    const fetchChecklists = async () => {
      const taskIds = allTasks.filter(t => t.object_id === object.id && t.stage_id === viewedStageId).map(t => t.id);
      if (taskIds.length === 0) return;

      const { data } = await supabase
        .from('task_checklists')
        .select('*')
        .in('task_id', taskIds)
        .order('created_at', { ascending: true });

      if (data) {
        const grouped = data.reduce((acc, item) => {
          if (!acc[item.task_id]) acc[item.task_id] = [];
          acc[item.task_id].push(item);
          return acc;
        }, {} as Record<string, any[]>);
        setChecklists(grouped);
      }
    };
    fetchChecklists();
  }, [allTasks, viewedStageId, object.id]);

  const filteredTasks = useMemo(() => {
    return allTasks.filter(t => t.object_id === object.id && t.stage_id === viewedStageId)
      .map(t => ({ ...t, checklist: checklists[t.id] || [] }));
  }, [allTasks, viewedStageId, object.id, checklists]);

  const isViewingHistory = viewedStageId !== object.current_stage;
  const isAdmin = profile.role === 'admin' || profile.role === 'director';
  
  const canJumpForward = !!object.rolled_back_from;

  useEffect(() => {
    if (forceOpenTaskModal) {
      handleOpenCreateModal();
      onTaskModalOpened?.();
    }
  }, [forceOpenTaskModal]);

  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setSelectedTask(null);
    setIsTaskModalOpen(true);
  };

  const handleOpenEditModal = (task: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTask(task);
    setIsEditMode(true);
    setIsTaskModalOpen(true);
  };

  const toggleChecklistItem = async (itemId: string, currentStatus: boolean) => {
    const isExecutor = selectedTask?.assigned_to === profile.id;
    if (!isExecutor && !isAdmin) return;

    const updatedChecklist = selectedTask.checklist.map((item: any) => 
      item.id === itemId ? { ...item, is_completed: !currentStatus } : item
    );
    setSelectedTask({ ...selectedTask, checklist: updatedChecklist });
    
    await supabase.from('task_checklists').update({ is_completed: !currentStatus }).eq('id', itemId);
    
    setChecklists(prev => ({
      ...prev,
      [selectedTask.id]: updatedChecklist
    }));
  };

  const handleDeleteInit = (task: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({ open: true, id: task.id });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    setLoading(true);
    const { error } = await supabase.from('tasks').update({ is_deleted: true }).eq('id', deleteConfirm.id);
    if (!error) {
      setDeleteConfirm({ open: false, id: null });
      await refreshData();
    }
    setLoading(false);
  };

  const handleCloseTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    setLoading(true);
    
    try {
        const { data, error } = await supabase.from('tasks').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: profile.id, // Explicitly set who completed it
          completion_comment: closeForm.comment,
          completion_doc_link: closeForm.link,
          completion_doc_name: closeForm.doc_name
        })
        .eq('id', selectedTask.id)
        .select(); // IMPORTANT: Select to check if row was actually updated
        
        if (error) throw error;

        // RLS Check: If no data returned, it means permission denied silently
        if (!data || data.length === 0) {
            throw new Error('Нет прав на завершение этой задачи (только исполнитель или админ)');
        }
        
        setIsTaskCloseModalOpen(false);
        setIsTaskDetailsModalOpen(false);
        setCloseForm({ comment: '', link: '', doc_name: '' });
        await refreshData();
    } catch (e: any) {
        console.error(e);
        // Show the error in UI instead of silent failure
        alert(e.message || 'Ошибка при завершении задачи');
    } finally {
        setLoading(false);
    }
  };

  const canEditDelete = (task: any) => {
    const isCreator = task.created_by === profile.id;
    if (task.status === 'completed') return isAdmin;
    return isAdmin || profile.role === 'director' || isCreator;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className={`flex flex-col md:flex-row justify-between items-center p-4 sm:p-6 rounded-[28px] border transition-all gap-4 ${isViewingHistory ? 'bg-amber-50 border-amber-200 shadow-inner' : 'bg-white border-slate-200 shadow-sm'}`}>
         <div className="text-center md:text-left min-w-0 flex-grow pr-4">
            <h4 className={`font-bold flex items-center justify-center md:justify-start gap-2 truncate ${isViewingHistory ? 'text-amber-800' : 'text-slate-800'}`}>
              {isViewingHistory && <span className="material-icons-round text-lg">history</span>}
              <span className="truncate">{isViewingHistory ? 'Просмотр: ' : 'Текущий: '}{STAGES.find(s=>s.id === viewedStageId)?.label}</span>
            </h4>
            {isViewingHistory && <p className="text-[10px] font-bold text-amber-600 uppercase mt-1">Данный этап уже был завершен или изменен</p>}
         </div>
         <div className="flex flex-wrap justify-center md:justify-end gap-2 shrink-0">
           {!isViewingHistory ? (
             <>
               {object.current_status === 'review_required' && canManage && (
                 <Button variant="tonal" className="h-10 px-4 text-xs" icon="verified" onClick={() => updateStatus('in_work')}>Принять работу</Button>
               )}
               {profile.role === 'specialist' && object.current_status !== 'review_required' && (
                 <Button variant="tonal" className="h-10 px-4 text-xs" icon="send" onClick={() => updateStatus('review_required')}>Сдать на проверку</Button>
               )}
               {canManage && !['review_required', 'frozen', 'completed'].includes(object.current_status) && (
                 <>
                  {canJumpForward ? (
                    <Button variant="primary" className="h-10 px-4 text-xs bg-amber-600 hover:bg-amber-700" icon="fast_forward" onClick={onJumpForward}>
                      Вернуться на {STAGES.find(s => s.id === object.rolled_back_from)?.label}
                    </Button>
                  ) : (
                    <Button variant="tonal" className="h-10 px-4 text-xs" icon={object.current_stage === 'support' ? "task_alt" : "skip_next"} onClick={onStartNextStage}>
                      {object.current_stage === 'support' ? "Завершить проект" : "Завершить и далее"}
                    </Button>
                  )}
                 </>
               )}
             </>
           ) : (
             canManage && viewedStageId !== object.current_stage && (
               <Button variant="secondary" className="h-10 px-4 text-xs" icon="settings_backup_restore" onClick={onRollback}>Вернуть объект на этот этап</Button>
             )
           )}
         </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
         <div className="flex justify-between items-center mb-2 px-1">
            <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Задачи этапа</h5>
            {!isViewingHistory && (
              <Button className="h-8 px-3 text-[10px]" icon="add" onClick={handleOpenCreateModal} disabled={object.current_status === 'frozen'}>Добавить задачу</Button>
            )}
         </div>
         
         {filteredTasks.length === 0 ? (
           <div className="p-16 text-center bg-white border border-dashed border-slate-200 rounded-[32px] text-slate-300 flex flex-col items-center">
             <span className="material-icons-round text-4xl mb-2">assignment_late</span>
             <p className="text-sm italic font-medium">Задач пока нет</p>
           </div>
         ) : (
           filteredTasks.map(task => {
            const hasFiles = !!task.doc_link || !!task.completion_doc_link;
            const completedCount = task.checklist?.filter((c: any) => c.is_completed).length || 0;
            const totalCount = task.checklist?.length || 0;

            return (
              <div key={task.id} onClick={() => { setSelectedTask(task); setIsTaskDetailsModalOpen(true); }}
                className={`bg-white p-4 sm:p-5 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between group cursor-pointer hover:border-blue-300 gap-4 ${task.status === 'completed' ? 'border-slate-100 opacity-60' : 'border-slate-200 shadow-sm'}`}>
                <div className="flex items-start sm:items-center gap-4 sm:gap-5 min-w-0 flex-grow pr-0 sm:pr-4">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${task.status === 'completed' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-500'}`}>
                      <span className="material-icons-round text-2xl">{task.status === 'completed' ? 'check_circle' : 'pending'}</span>
                    </div>
                    <div className="flex flex-col min-w-0 flex-grow">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium truncate text-base ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{task.title}</p>
                        {hasFiles && <span className="material-icons-round text-sm text-slate-400">attach_file</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{task.executor?.full_name}</p>
                        {totalCount > 0 && (
                          <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-600">
                            <span className="material-icons-round text-[10px]">checklist</span>
                            {completedCount}/{totalCount}
                          </div>
                        )}
                        {task.deadline && (
                           <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${task.deadline < getMinskISODate() && task.status !== 'completed' ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-500'}`}>
                             До {formatDate(task.deadline)}
                           </span>
                        )}
                      </div>
                    </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-50 w-full sm:w-auto">
                  <div className="flex gap-1">
                    {canEditDelete(task) && (
                      <>
                        <button onClick={(e) => handleOpenEditModal(task, e)} className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-all">
                          <span className="material-icons-round text-lg">edit</span>
                        </button>
                        <button onClick={(e) => handleDeleteInit(task, e)} className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all">
                          <span className="material-icons-round text-lg">delete</span>
                        </button>
                      </>
                    )}
                  </div>
                  {(task.executor?.id === profile.id || isAdmin) && task.status !== 'completed' && (
                    <button onClick={(e) => { e.stopPropagation(); setSelectedTask(task); setIsTaskCloseModalOpen(true); }} className="w-10 h-10 rounded-2xl bg-[#f2f3f5] border border-[#e1e2e1] flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all text-[#444746] shrink-0">
                      <span className="material-icons-round text-lg">done</span>
                    </button>
                  )}
                </div>
              </div>
            );
           })
         )}
      </div>

      {/* Shared Task Creation/Editing Modal */}
      <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title={isEditMode ? "Редактирование задачи" : "Новая задача"}>
        <TaskModal 
            mode={isEditMode ? 'edit' : 'create'}
            initialData={selectedTask}
            profile={profile}
            staff={staff}
            objects={[object]} // Pass current object as single item array to auto-select
            onSuccess={() => {
                setIsTaskModalOpen(false);
                refreshData();
            }}
        />
      </Modal>

      {/* Task Details Modal */}
      <Modal isOpen={isTaskDetailsModalOpen} onClose={() => setIsTaskDetailsModalOpen(false)} title="Карточка задачи">
        {selectedTask && (
          <div className="space-y-6">
            <h4 className="text-xl font-bold">{selectedTask.title}</h4>
            <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-100">
               <div><p className="text-[10px] font-bold text-slate-400 uppercase">Исполнитель</p><p className="text-sm font-medium">{selectedTask.executor?.full_name}</p></div>
               <div><p className="text-[10px] font-bold text-slate-400 uppercase">Срок</p><p className="text-sm font-medium">{selectedTask.deadline ? formatDate(selectedTask.deadline) : 'Бессрочно'}</p></div>
            </div>

            {selectedTask.checklist && selectedTask.checklist.length > 0 && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                 <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Чек-лист выполнения</p>
                 <div className="space-y-3">
                    {selectedTask.checklist.map((item: any) => {
                      const canToggle = selectedTask.assigned_to === profile.id || isAdmin;
                      return (
                        <div key={item.id} className="flex items-start gap-3">
                          <button type="button" disabled={!canToggle} onClick={() => toggleChecklistItem(item.id, item.is_completed)} className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 ${item.is_completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white'}`}>
                            {item.is_completed && <span className="material-icons-round text-xs">check</span>}
                          </button>
                          <span className={`text-sm leading-tight ${item.is_completed ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>{item.content}</span>
                        </div>
                      );
                    })}
                 </div>
              </div>
            )}

            {(selectedTask.doc_link || selectedTask.completion_doc_link) && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Документация</p>
                {selectedTask.doc_link && (
                  <a href={selectedTask.doc_link} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl hover:border-blue-300 transition-colors">
                    <span className="material-icons-round text-blue-500">description</span>
                    <span className="text-xs font-medium text-slate-700 truncate">{selectedTask.doc_name || 'Исходный документ'}</span>
                  </a>
                )}
                {selectedTask.completion_doc_link && (
                  <a href={selectedTask.completion_doc_link} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl hover:border-emerald-300 transition-colors">
                    <span className="material-icons-round text-emerald-600">verified</span>
                    <span className="text-xs font-medium text-emerald-900 truncate">{selectedTask.completion_doc_name || 'Отчет о выполнении'}</span>
                  </a>
                )}
              </div>
            )}

            {selectedTask.comment && (
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Описание</p>
                <p className="text-sm text-slate-600 italic whitespace-pre-wrap leading-relaxed">{selectedTask.comment}</p>
              </div>
            )}
            
            <Button variant="tonal" className="w-full" onClick={() => setIsTaskDetailsModalOpen(false)}>Закрыть</Button>
          </div>
        )}
      </Modal>

      {/* Task Completion Modal */}
      <Modal isOpen={isTaskCloseModalOpen} onClose={() => setIsTaskCloseModalOpen(false)} title="Отчет о выполнении">
        <form onSubmit={handleCloseTask} className="space-y-4">
          <textarea required className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm outline-none focus:border-blue-500 shadow-inner" rows={3} value={closeForm.comment} onChange={(e:any) => setCloseForm({...closeForm, comment: e.target.value})} placeholder="Что было сделано..." />
          <Input label="Ссылка на результат" value={closeForm.link} onChange={(e:any) => setCloseForm({...closeForm, link: e.target.value})} />
          <Input label="Название документа" value={closeForm.doc_name} onChange={(e:any) => setCloseForm({...closeForm, doc_name: e.target.value})} />
          <Button type="submit" className="w-full h-12" loading={loading} variant="primary">Завершить задачу</Button>
        </form>
      </Modal>

      <ConfirmModal isOpen={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, id: null })} onConfirm={handleDeleteConfirm} title="Удаление задачи" message="Вы уверены? Действие нельзя отменить." loading={loading} />
    </div>
  );
};

export default TasksTab;
