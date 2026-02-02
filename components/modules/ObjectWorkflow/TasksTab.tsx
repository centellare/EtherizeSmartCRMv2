
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

  // Состояние формы задачи теперь включает чек-лист
  const [taskForm, setTaskForm] = useState({ 
    id: '',
    title: '', 
    assigned_to: '', 
    start_date: new Date().toISOString().split('T')[0],
    deadline: '', 
    comment: '', 
    doc_link: '', 
    doc_name: '',
    checklist: [] as { id?: string; content: string; is_completed?: boolean }[]
  });
  
  const [closeForm, setCloseForm] = useState({ comment: '', link: '', doc_name: '' });

  // Загрузка чек-листов для текущих задач
  const [checklists, setChecklists] = useState<Record<string, any[]>>({});

  useEffect(() => {
    const fetchChecklists = async () => {
      const taskIds = allTasks.filter(t => t.object_id === object.id && t.stage_id === viewedStageId).map(t => t.id);
      if (taskIds.length === 0) return;

      const { data, error } = await supabase
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
  const isDirector = profile.role === 'director';
  const isSpecialist = profile.role === 'specialist';
  const isManager = profile.role === 'manager';
  const canJumpForward = !!object.rolled_back_from;

  const availableExecutors = useMemo(() => {
    if (!profile) return [];
    if (isAdmin || isDirector) return staff;
    if (isManager) return staff.filter(s => ['specialist', 'manager', 'director'].includes(s.role));
    if (isSpecialist) return staff.filter(s => s.id === profile.id || s.role === 'manager');
    return [];
  }, [staff, profile, isAdmin, isDirector, isManager, isSpecialist]);

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
      doc_name: '',
      checklist: []
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
      start_date: (task.start_date || '').split('T')[0] || new Date().toISOString().split('T')[0],
      deadline: (task.deadline || '').split('T')[0] || '',
      comment: task.comment || '',
      doc_link: task.doc_link || '',
      doc_name: task.doc_name || '',
      checklist: task.checklist?.map((c: any) => ({ id: c.id, content: c.content, is_completed: c.is_completed })) || []
    });
    setIsTaskModalOpen(true);
  };

  const addChecklistItem = () => {
    setTaskForm(prev => ({
      ...prev,
      checklist: [...prev.checklist, { content: '' }]
    }));
  };

  const updateChecklistItem = (index: number, content: string) => {
    const newList = [...taskForm.checklist];
    newList[index].content = content;
    setTaskForm({ ...taskForm, checklist: newList });
  };

  const removeChecklistItem = (index: number) => {
    setTaskForm(prev => ({
      ...prev,
      checklist: prev.checklist.filter((_, i) => i !== index)
    }));
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (taskForm.deadline && new Date(taskForm.deadline) < new Date(taskForm.start_date)) {
      alert("Ошибка: Дата дедлайна не может быть раньше даты начала.");
      return;
    }

    setLoading(true);
    let taskId = taskForm.id;

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
      
      if (error) {
        setLoading(false);
        return;
      }
    } else {
      // RPC не всегда возвращает ID, поэтому используем стандартный insert для новой задачи
      // Но в данной системе создание задачи идет через create_task_safe.
      // Чтобы получить ID, нам придется сделать дополнительный запрос после выполнения RPC.
      const { data, error } = await supabase.rpc('create_task_safe', {
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

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      // Так как RPC возвращает void, найдем последнюю созданную нами задачу в этом объекте
      const { data: lastTask } = await supabase
        .from('tasks')
        .select('id')
        .eq('object_id', object.id)
        .eq('created_by', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (lastTask) taskId = lastTask.id;
    }

    // Обработка подзадач (синхронизация чек-листа)
    if (taskId) {
      // Удаляем старые пункты, которых нет в новой форме (только при редактировании)
      if (isEditMode) {
        const currentIds = taskForm.checklist.filter(c => c.id).map(c => c.id);
        await supabase.from('task_checklists').delete().eq('task_id', taskId).not('id', 'in', `(${currentIds.join(',')})`);
      }

      // Добавляем/Обновляем пункты
      const itemsToUpsert = taskForm.checklist
        .filter(c => c.content.trim() !== '')
        .map(c => ({
          ...(c.id ? { id: c.id } : {}),
          task_id: taskId,
          content: c.content,
          is_completed: c.is_completed || false
        }));

      if (itemsToUpsert.length > 0) {
        await supabase.from('task_checklists').upsert(itemsToUpsert);
      }
    }

    setIsTaskModalOpen(false);
    await refreshData();
    setLoading(false);
  };

  const toggleChecklistItem = async (itemId: string, currentStatus: boolean) => {
    // Проверка прав: только исполнитель или директор/админ
    const isExecutor = selectedTask?.assigned_to === profile.id;
    if (!isExecutor && !isAdmin) return;

    // Оптимистичное обновление в UI
    const updatedChecklist = selectedTask.checklist.map((item: any) => 
      item.id === itemId ? { ...item, is_completed: !currentStatus } : item
    );
    setSelectedTask({ ...selectedTask, checklist: updatedChecklist });
    
    // Обновление в БД
    await supabase.from('task_checklists').update({ is_completed: !currentStatus }).eq('id', itemId);
    
    // Обновление общего стейта чек-листов
    setChecklists(prev => ({
      ...prev,
      [selectedTask.id]: updatedChecklist
    }));
  };

  // Define handleDeleteInit to initialize deletion modal
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

  // ФИКС: Явное приведение к boolean для предотвращения ошибки TS2322 (boolean | "")
  const isInvalidDates = !!(taskForm.deadline && new Date(taskForm.deadline) < new Date(taskForm.start_date));

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
            const hasChecklist = task.checklist && task.checklist.length > 0;
            const completedCount = task.checklist?.filter((c: any) => c.is_completed).length || 0;
            const totalCount = task.checklist?.length || 0;

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
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{task.executor?.full_name}</p>
                        {hasChecklist && (
                          <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-600">
                            <span className="material-icons-round text-[10px]">checklist</span>
                            {completedCount}/{totalCount}
                          </div>
                        )}
                        {task.deadline && (
                           <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${new Date(task.deadline) < new Date() && task.status !== 'completed' ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-500'}`}>
                             До {new Date(task.deadline).toLocaleDateString()}
                           </span>
                        )}
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
            <Input label="Дедлайн" type="date" value={taskForm.deadline} onChange={(e:any) => setTaskForm({...taskForm, deadline: e.target.value})} className={isInvalidDates ? 'border-red-500 ring-red-50' : ''} />
          </div>
          {isInvalidDates && (
            <p className="text-[10px] text-red-600 font-bold uppercase ml-1 animate-pulse">Срок не может быть раньше начала</p>
          )}
          
          {/* Секция подзадач */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
             <div className="flex justify-between items-center mb-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Подзадачи (чек-лист)</p>
                <button type="button" onClick={addChecklistItem} className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors">
                  <span className="material-icons-round text-sm">add</span>
                </button>
             </div>
             <div className="space-y-2">
                {taskForm.checklist.map((item, idx) => (
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
                {taskForm.checklist.length === 0 && (
                  <p className="text-[10px] text-slate-300 italic text-center">Нажмите +, чтобы добавить пункты</p>
                )}
             </div>
          </div>

          <div className="w-full">
            <label className="block text-xs font-medium text-[#444746] mb-1.5 ml-1">Описание / ТЗ</label>
            <textarea className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm outline-none focus:border-blue-500 shadow-inner" rows={3} value={taskForm.comment} onChange={(e) => setTaskForm({...taskForm, comment: e.target.value})} />
          </div>
          <Button type="submit" className="w-full h-12" loading={loading} disabled={isInvalidDates || loading}>{isEditMode ? 'Сохранить изменения' : 'Создать задачу'}</Button>
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

            {/* Отображение чек-листа в деталях */}
            {selectedTask.checklist && selectedTask.checklist.length > 0 && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                 <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Чек-лист выполнения</p>
                 <div className="space-y-3">
                    {selectedTask.checklist.map((item: any) => {
                      const canToggle = selectedTask.assigned_to === profile.id || isAdmin;
                      return (
                        <div key={item.id} className="flex items-start gap-3 group">
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
