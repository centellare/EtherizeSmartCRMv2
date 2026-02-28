
import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Modal, Input, Select, ConfirmModal, Badge, useToast } from '../../ui';
import { formatDate, getMinskISODate } from '../../../lib/dateUtils';
import { TaskModal } from '../Tasks/modals/TaskModal';
import { TaskDetails } from '../Tasks/modals/TaskDetails';
import { TaskCompletionModal } from '../Tasks/modals/TaskCompletionModal';
import { TaskList } from '../Tasks/TaskList';

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
  const toast = useToast();

  const filteredTasks = useMemo(() => {
    return allTasks.filter(t => t.object_id === object.id && t.stage_id === viewedStageId && (t.status !== 'completed' || viewedStageId !== object.current_stage));
  }, [allTasks, viewedStageId, object.id]);

  // Sync selectedTask with tasks updates
  useEffect(() => {
    if (selectedTask && filteredTasks.length > 0) {
      const updated = filteredTasks.find(t => t.id === selectedTask.id);
      if (updated && updated.status !== selectedTask.status) {
        setSelectedTask(updated);
      }
    }
  }, [filteredTasks, selectedTask]);

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

  const handleOpenEditModal = (task: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedTask(task);
    setIsEditMode(true);
    setIsTaskModalOpen(true);
  };



  const handleDeleteInit = (task: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
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
         <TaskList 
           tasks={filteredTasks}
           activeTab="active"
           archivePage={0}
           archiveTotal={0}
           currentUserId={profile.id}
           isAdmin={isAdmin}
           onPageChange={() => {}}
           onTaskClick={(task) => { setSelectedTask(task); setIsTaskDetailsModalOpen(true); }}
           onRequestComplete={(task) => { setSelectedTask(task); setIsTaskCloseModalOpen(true); }}
           hideObjectLink={true}
         />
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
                toast.success('Задача сохранена');
                refreshData();
            }}
        />
      </Modal>

      {/* Task Details Modal */}
      <Modal isOpen={isTaskDetailsModalOpen} onClose={() => setIsTaskDetailsModalOpen(false)} title="Карточка задачи">
        {selectedTask && (
          <>
            <TaskDetails
              task={selectedTask}
              profile={profile}
              isAdmin={isAdmin}
              onEdit={() => { setIsTaskDetailsModalOpen(false); handleOpenEditModal(selectedTask); }}
              onDelete={() => { setIsTaskDetailsModalOpen(false); handleDeleteInit(selectedTask); }}
              onClose={() => setIsTaskDetailsModalOpen(false)}
              onNavigateToObject={() => {}}
              hideObjectLink={true}
              onStatusChange={() => refreshData()}
            />
            {(selectedTask?.assigned_to === profile.id || isAdmin) && selectedTask?.status === 'in_progress' && (
                <div className="mt-8 pt-4 border-t border-slate-100">
                    <Button variant="primary" className="w-full h-12" onClick={() => { setIsTaskDetailsModalOpen(false); setIsTaskCloseModalOpen(true); }}>Завершить задачу</Button>
                </div>
            )}
          </>
        )}
      </Modal>

      {/* Task Completion Modal */}
      <Modal isOpen={isTaskCloseModalOpen} onClose={() => setIsTaskCloseModalOpen(false)} title="Отчет о выполнении">
        <TaskCompletionModal 
            task={selectedTask} 
            onSuccess={(createNew, completionComment) => {
                setIsTaskCloseModalOpen(false);
                setIsTaskDetailsModalOpen(false);
                toast.success('Задача завершена');
                refreshData();
                
                if (createNew && selectedTask) {
                    const contextText = `--- Контекст из задачи: ${selectedTask.title} ---\nЗадача: ${selectedTask.comment || 'Нет описания'}\nРезультат: ${completionComment || 'Нет отчета'}\n--------------------------------------------------------\n\n`;
                    setSelectedTask({
                        object_id: selectedTask.object_id,
                        client_id: selectedTask.client_id,
                        comment: contextText
                    });
                    setIsEditMode(false);
                    setIsTaskModalOpen(true);
                }
            }} 
        />
      </Modal>

      <ConfirmModal isOpen={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, id: null })} onConfirm={handleDeleteConfirm} title="Удаление задачи" message="Вы уверены? Действие нельзя отменить." loading={loading} />
    </div>
  );
};

export default TasksTab;
