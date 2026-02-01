
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
  const isAdmin = profile.role === 'admin';
  const isDirector = profile.role === 'director';
  const isSpecialist = profile.role === 'specialist';
  const canJumpForward = !!object.rolled_back_from;

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
    if (new Date(taskForm.deadline) < new Date(taskForm.start_date)) {
      alert("Ошибка: Дата дедлайна не может быть раньше даты начала.");
      return;
    }

    setLoading(true);
    if (isEditMode) {
      const { error } = await supabase.from('tasks').update({
        title: taskForm.title,
        assigned_to: taskForm.assigned_to,
        start_date: taskForm.start_date,
        deadline: taskForm.deadline,
        comment: taskForm.comment,
        doc_link: taskForm.doc_link,
        doc_name: taskForm.doc_name,
        last_edited_at: new Date().toISOString(),
        last_edited_by: profile.id
      }).eq('id', taskForm.id);
      
      if (!error) {
        setIsTaskModalOpen(false);
        refreshData();
      }
    } else {
      const { error } = await supabase.rpc('create_task_safe', {
        p_object_id: object.id,
        p_title: taskForm.title,
        p_assigned_to: taskForm.assigned_to,
        p_start_date: taskForm.start_date,
        p_deadline: taskForm.deadline,
        p_comment: taskForm.comment,
        p_doc_link: taskForm.doc_link || null,
        p_doc_name: taskForm.doc_name || null,
        p_user_id: profile.id
      });

      if (!error) {
        setIsTaskModalOpen(false);
        refreshData();
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
      refreshData();
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
      refreshData();
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
                <div className="flex items-center gap-4 flex-grow min-w-0">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${task.status === 'completed' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-500'}`}>
                      <span className="material-icons-round text-2xl">{task.status === 'completed' ? 'check_circle' : 'pending'}</span>
                    </div>
                    <div className="flex flex-col min-w-0 pr-4">
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
                <div className="flex items-center gap-1">
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

      <Modal isOpen={isTaskDetailsModalOpen} onClose={() => setIsTaskDetailsModalOpen(false)} title="Карточка задачи">
        {selectedTask && (
          <div className="space-y-6">
            <h4 className="text-xl font-medium text-[#1c1b1f] leading-snug">{selectedTask.title}</h4>
            <div className="grid grid-cols-2 gap-4 py-5 border-y border-[#f2f3f5]">
               <div className="space-y-1">
                 <p className="text-[10px] uppercase font-bold text-slate-400">Поставил / Срок</p>
                 <p className="text-sm font-medium">{selectedTask.creator?.full_name || 'Система'} — {selectedTask.deadline ? new Date(selectedTask.deadline).toLocaleDateString() : '—'}</p>
                 <p className="text-[9px] text-slate-300 font-bold uppercase tracking-tight">Создана: {new Date(selectedTask.created_at).toLocaleDateString()}</p>
               </div>
               <div className="space-y-1">
                 <p className="text-[10px] uppercase font-bold text-slate-400">Исполнитель</p>
                 <p className="text-sm font-bold text-[#005ac1]">{selectedTask.executor?.full_name}</p>
               </div>
            </div>
            
            {(selectedTask.comment || selectedTask.doc_link) && (
              <div className="space-y-3">
                {selectedTask.comment && (
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Постановка</p>
                    <p className="text-sm text-slate-600 italic">"{selectedTask.comment}"</p>
                  </div>
                )}
                {selectedTask.doc_link && (
                  <a href={selectedTask.doc_link} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors group">
                    <span className="material-icons-round text-blue-600">link</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-blue-700 uppercase tracking-tighter">Входящий документ</p>
                      <p className="text-sm font-medium text-blue-900 truncate">{selectedTask.doc_name || 'Открыть ссылку'}</p>
                    </div>
                  </a>
                )}
              </div>
            )}

            {selectedTask.status === 'completed' && (
              <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-inner space-y-3">
                <p className="text-[10px] uppercase font-bold text-emerald-700">Отчет исполнителя</p>
                <p className="text-sm text-emerald-900 italic break-words leading-relaxed">
                  {selectedTask.completion_comment || "Результат зафиксирован без комментария"}
                </p>
                {selectedTask.completion_doc_link && (
                   <a href={selectedTask.completion_doc_link} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-emerald-100/50 rounded-xl hover:bg-emerald-100 transition-colors">
                      <span className="material-icons-round text-emerald-600">description</span>
                      <span className="text-xs font-bold text-emerald-800 uppercase">{selectedTask.completion_doc_name || 'Результат'}</span>
                   </a>
                )}
              </div>
            )}
            
            <div className="flex gap-2 pt-4">
              <Button variant="tonal" className="flex-1" onClick={() => setIsTaskDetailsModalOpen(false)}>Закрыть</Button>
              {(selectedTask.executor?.id === profile.id || isAdmin) && selectedTask.status !== 'completed' && (
                <Button variant="primary" className="flex-1" icon="done_all" onClick={() => setIsTaskCloseModalOpen(true)}>Сдать работу</Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title={isEditMode ? "Редактирование задачи" : "Постановка задачи"}>
        <form onSubmit={handleSaveTask} className="space-y-5 px-1 pb-4">
          <Input label="Что нужно сделать?" required value={taskForm.title} onChange={(e:any) => setTaskForm({...taskForm, title: e.target.value})} icon="edit_note" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Дата старта" type="date" required value={taskForm.start_date} onChange={(e:any) => setTaskForm({...taskForm, start_date: e.target.value})} icon="calendar_today" />
            <Input label="Дедлайн" type="date" required value={taskForm.deadline} onChange={(e:any) => setTaskForm({...taskForm, deadline: e.target.value})} icon="event" />
          </div>
          <Select label="Исполнитель" required value={taskForm.assigned_to} onChange={(e:any) => setTaskForm({...taskForm, assigned_to: e.target.value})} options={[{value:'', label:'Выберите сотрудника'}, ...staff.map(s => ({value: s.id, label: s.full_name}))]} icon="person_search" />
          
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
             <p className="text-[10px] font-bold text-slate-400 uppercase ml-1">Входящая документация</p>
             <Input label="Название документа" value={taskForm.doc_name} onChange={(e:any) => setTaskForm({...taskForm, doc_name: e.target.value})} icon="description" />
             <Input label="URL-ссылка" value={taskForm.doc_link} onChange={(e:any) => setTaskForm({...taskForm, doc_link: e.target.value})} icon="link" />
          </div>

          <div className="w-full">
            <label className="block text-xs font-medium text-[#444746] mb-1.5 ml-1">Описание / ТЗ</label>
            <textarea className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm outline-none focus:border-blue-500 shadow-inner" rows={3} value={taskForm.comment} onChange={(e) => setTaskForm({...taskForm, comment: e.target.value})} />
          </div>
          <Button type="submit" className="w-full h-14" icon="save" loading={loading}>
            {isEditMode ? 'Сохранить изменения' : 'Создать задачу'}
          </Button>
        </form>
      </Modal>

      <Modal isOpen={isTaskCloseModalOpen} onClose={() => setIsTaskCloseModalOpen(false)} title="Завершение работы">
        <form onSubmit={handleCloseTask} className="space-y-4 px-1">
           <div className="w-full">
            <label className="block text-xs font-medium text-[#444746] mb-1.5 ml-1">Отчет исполнителя</label>
            <textarea required className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm outline-none focus:border-blue-500 shadow-inner" rows={4} value={closeForm.comment} onChange={(e) => setCloseForm({...closeForm, comment: e.target.value})} />
           </div>
           <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 space-y-4">
             <p className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Результат (ссылка)</p>
             <Input label="Название файла" value={closeForm.doc_name} onChange={(e:any) => setCloseForm({...closeForm, doc_name: e.target.value})} icon="description" />
             <Input label="Ссылка" value={closeForm.link} onChange={(e:any) => setCloseForm({...closeForm, link: e.target.value})} icon="link" />
           </div>
           <Button type="submit" className="w-full h-14" icon="task_alt" loading={loading}>Зафиксировать результат</Button>
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={deleteConfirm.open} 
        onClose={() => setDeleteConfirm({ open: false, id: null })} 
        onConfirm={handleDeleteConfirm} 
        title="Удаление задачи" 
        message="Вы уверены, что хотите удалить задачу?" 
        loading={loading} 
      />
    </div>
  );
};
