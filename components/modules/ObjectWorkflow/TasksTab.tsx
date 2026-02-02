
import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Modal, Input, Select, ConfirmModal, Badge } from '../../ui';

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
  tasks,
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

  const [taskForm, setTaskForm] = useState({ 
    id: '',
    title: '', 
    assigned_to: '', 
    start_date: new Date().toISOString().split('T')[0],
    deadline: '', 
    comment: '', 
    doc_link: '', 
    doc_name: '' 
  });
  const [closeForm, setCloseForm] = useState({ comment: '', link: '', doc_name: '' });

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => t.object_id === object.id && t.stage_id === viewedStageId);
  }, [tasks, viewedStageId, object.id]);

  const isViewingHistory = viewedStageId !== object.current_stage;
  const isAdmin = profile.role === 'admin' || profile.role === 'director';
  const isDirector = profile.role === 'director';
  const isSpecialist = profile.role === 'specialist';
  const isManager = profile.role === 'manager';
  const canJumpForward = !!object.rolled_back_from;

  const availableExecutors = useMemo(() => {
    if (!profile) return [];
    if (isAdmin || isDirector) return staff;
    if (isManager) {
      return staff.filter(s => ['specialist', 'manager', 'director'].includes(s.role));
    }
    if (isSpecialist) {
      return staff.filter(s => s.id === profile.id || s.role === 'manager');
    }
    return [];
  }, [staff, profile]);

  useEffect(() => {
    if (forceOpenTaskModal) {
      handleOpenCreateModal();
      onTaskModalOpened?.();
    }
  }, [forceOpenTaskModal]);

  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setTaskForm({ 
      id: '',
      title: '', 
      assigned_to: '', 
      start_date: new Date().toISOString().split('T')[0], 
      deadline: '', 
      comment: '', 
      doc_link: '', 
      doc_name: '' 
    });
    setIsTaskModalOpen(true);
  };

  const handleOpenEditModal = (task: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTask(task);
    setIsEditMode(true);
    setTaskForm({
      id: task.id,
      title: task.title,
      assigned_to: task.assigned_to,
      start_date: task.start_date || new Date().toISOString().split('T')[0],
      deadline: task.deadline || '',
      comment: task.comment || '',
      doc_link: task.doc_link || '',
      doc_name: task.doc_name || ''
    });
    setIsTaskModalOpen(true);
  };

  const handleDeleteInit = (task: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({ open: true, id: task.id });
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (taskForm.deadline && new Date(taskForm.deadline) < new Date(taskForm.start_date)) {
      alert("Ошибка: Дата дедлайна не может быть раньше даты начала.");
      return;
    }

    setLoading(true);
    if (isEditMode) {
      const { error } = await supabase.from('tasks').update({
        title: taskForm.title,
        assigned_to: taskForm.assigned_to,
        start_date: taskForm.start_date,
        deadline: taskForm.deadline || null,
        comment: taskForm.comment,
        doc_link: taskForm.doc_link,
        doc_name: taskForm.doc_name,
        last_edited_at: new Date().toISOString(),
        last_edited_by: profile.id
      }).eq('id', taskForm.id);
      
      if (!error) {
        setIsTaskModalOpen(false);
        await refreshData();
      }
    } else {
      const { error } = await supabase.rpc('create_task_safe', {
        p_object_id: object.id,
        p_title: taskForm.title,
        p_assigned_to: taskForm.assigned_to,
        p_start_date: taskForm.start_date,
        p_deadline: taskForm.deadline || null,
        p_comment: taskForm.comment,
        p_doc_link: taskForm.doc_link || null,
        p_doc_name: taskForm.doc_name || null,
        p_user_id: profile.id
      });

      if (!error) {
        setIsTaskModalOpen(false);
        await refreshData();
      } else { alert(error.message); }
    }
    setLoading(false);
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
    const { error } = await supabase.from('tasks').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completion_comment: closeForm.comment,
      completion_doc_link: closeForm.link,
      completion_doc_name: closeForm.doc_name
    }).eq('id', selectedTask.id);
    
    if (!error) {
      setIsTaskCloseModalOpen(false);
      setIsTaskDetailsModalOpen(false);
      setCloseForm({ comment: '', link: '', doc_name: '' });
      await refreshData();
    }
    setLoading(false);
  };

  const canEditDelete = (task: any) => {
    const isCreator = task.created_by === profile.id;
    if (task.status === 'completed') return isAdmin;
    return isAdmin || isDirector || isCreator;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className={`flex flex-col md:flex-row justify-between items-center p-6 rounded-[28px] border transition-all gap-4 ${isViewingHistory ? 'bg-amber-50 border-amber-200 shadow-inner' : 'bg-white border-slate-200 shadow-sm'}`}>
         <div className="text-center md:text-left">
            <h4 className={`font-bold flex items-center justify-center md:justify-start gap-2 ${isViewingHistory ? 'text-amber-800' : 'text-slate-800'}`}>
              {isViewingHistory && <span className="material-icons-round text-lg">history</span>}
              {isViewingHistory ? 'Просмотр этапа: ' : 'Текущий этап: '}
              {STAGES.find(s=>s.id === viewedStageId)?.label}
            </h4>
            {isViewingHistory && <p className="text-[10px] font-bold text-amber-600 uppercase mt-1">Данный этап уже был завершен или изменен</p>}
            {!isViewingHistory && canJumpForward && (
              <div className="mt-2 px-3 py-1 bg-amber-100 border border-amber-200 rounded-lg inline-flex items-center gap-2">
                <span className="material-icons-round text-amber-600 text-sm">info</span>
                <span className="text-[10px] font-bold text-amber-800 uppercase">Режим правок после отката</span>
              </div>
            )}
         </div>
         <div className="flex flex-wrap justify-center gap-2">
           {!isViewingHistory ? (
             <>
               {object.current_status === 'review_required' && canManage && (
                 <Button variant="tonal" className="h-10 px-6 text-xs" icon="verified" onClick={() => updateStatus('in_work')}>Принять работу</Button>
               )}
               {isSpecialist && object.current_status !== 'review_required' && (
                 <Button variant="tonal" className="h-10 px-6 text-xs" icon="send" onClick={() => updateStatus('review_required')}>Сдать этап на проверку</Button>
               )}
               {canManage && !['review_required', 'frozen', 'completed'].includes(object.current_status) && (
                 <>
                  {canJumpForward ? (
                    <Button variant="primary" className="h-10 px-6 text-xs bg-amber-600 hover:bg-amber-700" icon="fast_forward" onClick={onJumpForward}>
                      Вернуться на {STAGES.find(s => s.id === object.rolled_back_from)?.label}
                    </Button>
                  ) : (
                    <Button variant="tonal" className="h-10 px-6 text-xs" icon={object.current_stage === 'support' ? "task_alt" : "skip_next"} onClick={onStartNextStage}>
                      {object.current_stage === 'support' ? "Завершить проект" : "Завершить и далее"}
                    </Button>
                  )}
                 </>
               )}
             </>
           ) : (
             canManage && viewedStageId !== object.current_stage && (
               <Button variant="secondary" className="h-10 px-6 text-xs" icon="settings_backup_restore" onClick={onRollback}>Вернуть объект на этот этап</Button>
             )
           )}
         </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
         <div className="flex justify-between items-center mb-2 px-1">
            <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Список задач этапа</h5>
            {!isViewingHistory && (
              <Button className="h-8 text-xs" icon="add" onClick={handleOpenCreateModal} disabled={object.current_status === 'frozen'}>Добавить задачу</Button>
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
            return (
              <div key={task.id} onClick={() => { setSelectedTask(task); setIsTaskDetailsModalOpen(true); }}
                className={`bg-white p-5 rounded-3xl border transition-all flex items-center justify-between group cursor-pointer hover:border-blue-300 ${task.status === 'completed' ? 'border-slate-100 opacity-60' : 'border-slate-200 shadow-sm'}`}>
                <div className="flex items-center gap-4 flex-grow min-w-0 pr-4">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${task.status === 'completed' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-500'}`}>
                      <span className="material-icons-round text-2xl">{task.status === 'completed' ? 'check_circle' : 'pending'}</span>
                    </div>
                    <div className="flex flex-col min-w-0 flex-grow">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium truncate text-base ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{task.title}</p>
                        {hasFiles && <span className="material-icons-round text-sm text-slate-400">attach_file</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{task.executor?.full_name}</p>
                        {task.deadline && (
                           <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${new Date(task.deadline) < new Date() && task.status !== 'completed' ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-500'}`}>
                             До {new Date(task.deadline).toLocaleDateString()}
                           </span>
                        )}
                        <span className="text-[9px] text-slate-300 font-bold uppercase tracking-tight">Создана: {new Date(task.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
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
                  {(task.executor?.id === profile.id || isAdmin) && task.status !== 'completed' && (
                    <button onClick={(e) => { e.stopPropagation(); setSelectedTask(task); setIsTaskCloseModalOpen(true); }} className="w-10 h-10 rounded-2xl bg-[#f2f3f5] border border-[#e1e2e1] flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all text-[#444746]">
                      <span className="material-icons-round text-lg">done</span>
                    </button>
                  )}
                </div>
              </div>
            );
           })
         )}
      </div>

      {/* Task Creation/Editing Modal */}
      <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title={isEditMode ? "Редактирование задачи" : "Новая задача"}>
        <form onSubmit={handleSaveTask} className="space-y-4">
          <Input label="Что сделать?" required value={taskForm.title} onChange={(e:any) => setTaskForm({...taskForm, title: e.target.value})} />
          <Select 
            label="Исполнитель" 
            required 
            value={taskForm.assigned_to} 
            onChange={(e:any) => setTaskForm({...taskForm, assigned_to: e.target.value})}
            options={[{value: '', label: 'Выбрать исполнителя'}, ...availableExecutors.map(s => ({value: s.id, label: s.full_name}))]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Дата старта" type="date" required value={taskForm.start_date} onChange={(e:any) => setTaskForm({...taskForm, start_date: e.target.value})} />
            <Input label="Дедлайн" type="date" value={taskForm.deadline} onChange={(e:any) => setTaskForm({...taskForm, deadline: e.target.value})} />
          </div>
          <div className="w-full">
            <label className="block text-xs font-medium text-[#444746] mb-1.5 ml-1">Описание / ТЗ</label>
            <textarea className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm outline-none focus:border-blue-500 shadow-inner" rows={3} value={taskForm.comment} onChange={(e) => setTaskForm({...taskForm, comment: e.target.value})} />
          </div>
          <Button type="submit" className="w-full h-12" loading={loading}>{isEditMode ? 'Сохранить изменения' : 'Создать задачу'}</Button>
        </form>
      </Modal>

      {/* Task Details Modal */}
      <Modal isOpen={isTaskDetailsModalOpen} onClose={() => setIsTaskDetailsModalOpen(false)} title="Карточка задачи">
        {selectedTask && (
          <div className="space-y-6">
            <h4 className="text-xl font-bold">{selectedTask.title}</h4>
            <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-100">
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase">Исполнитель</p>
                 <p className="text-sm font-medium">{selectedTask.executor?.full_name}</p>
               </div>
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase">Срок</p>
                 <p className="text-sm font-medium">{selectedTask.deadline ? new Date(selectedTask.deadline).toLocaleDateString() : 'Бессрочно'}</p>
               </div>
            </div>
            {selectedTask.comment && (
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Описание</p>
                <p className="text-sm text-slate-600 italic whitespace-pre-wrap leading-relaxed">{selectedTask.comment}</p>
              </div>
            )}
            {selectedTask.status === 'completed' && selectedTask.completion_comment && (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="text-[10px] font-bold text-emerald-700 uppercase mb-2">Отчет исполнителя</p>
                <p className="text-sm text-emerald-900 italic whitespace-pre-wrap leading-relaxed">{selectedTask.completion_comment}</p>
              </div>
            )}
            <Button variant="tonal" className="w-full" onClick={() => setIsTaskDetailsModalOpen(false)}>Закрыть</Button>
          </div>
        )}
      </Modal>

      {/* Task Completion Modal */}
      <Modal isOpen={isTaskCloseModalOpen} onClose={() => setIsTaskCloseModalOpen(false)} title="Отчет о выполнении">
        <form onSubmit={handleCloseTask} className="space-y-4">
          <div className="w-full">
            <label className="block text-xs font-medium text-[#444746] mb-1.5 ml-1">Комментарий к результату</label>
            <textarea required className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm outline-none focus:border-blue-500 shadow-inner" rows={3} value={closeForm.comment} onChange={(e:any) => setCloseForm({...closeForm, comment: e.target.value})} placeholder="Что было сделано..." />
          </div>
          <Input label="Ссылка на документ/результат" value={closeForm.link} onChange={(e:any) => setCloseForm({...closeForm, link: e.target.value})} placeholder="URL (Google Drive, Telegram, etc.)" />
          <Input label="Название документа" value={closeForm.doc_name} onChange={(e:any) => setCloseForm({...closeForm, doc_name: e.target.value})} placeholder="Напр: Акт скрытых работ" />
          <Button type="submit" className="w-full h-12" loading={loading} variant="primary">Завершить задачу</Button>
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={deleteConfirm.open} 
        onClose={() => setDeleteConfirm({ open: false, id: null })} 
        onConfirm={handleDeleteConfirm} 
        title="Удаление задачи" 
        message="Вы уверены, что хотите удалить эту задачу? Действие нельзя отменить." 
        loading={loading}
      />
    </div>
  );
};
