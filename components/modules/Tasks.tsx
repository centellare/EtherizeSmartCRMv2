
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase, measureQuery } from '../../lib/supabase';
import { Button, Input, Select, Badge, Modal, ConfirmModal, Toast } from '../ui';
import { Task } from '../../types';
import { formatDate, getMinskISODate } from '../../lib/dateUtils';

type FilterMode = 'all' | 'mine' | 'created';
type TaskTab = 'active' | 'today' | 'week' | 'overdue' | 'team' | 'archive';

const PAGE_SIZE = 50;

const Tasks: React.FC<{ profile: any; onNavigateToObject: (objectId: string, stageId?: string) => void }> = ({ profile, onNavigateToObject }) => {
  const [activeTab, setActiveTab] = useState<TaskTab>('active');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Временной фильтр для активных задач
  const [activeRange, setActiveRange] = useState({
    start: '',
    end: ''
  });

  // Состояния для архива
  const [archiveTasks, setArchiveTasks] = useState<Task[]>([]);
  const [archivePage, setArchivePage] = useState(0);
  const [archiveTotal, setArchiveTotal] = useState(0);
  const [archiveDates, setArchiveDates] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: getMinskISODate()
  });

  const [staff, setStaff] = useState<any[]>([]);
  const [objects, setObjects] = useState<any[]>([]);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isTaskDetailsModalOpen, setIsTaskDetailsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const isFetching = useRef(false);

  const [createForm, setCreateForm] = useState({
    id: '', 
    object_id: '', 
    title: '', 
    assigned_to: '', 
    start_date: getMinskISODate(), 
    deadline: '', 
    comment: '', 
    doc_link: '', 
    doc_name: '',
    checklist: [] as { id?: string; content: string; is_completed?: boolean }[]
  });

  const isAdmin = profile?.role === 'admin' || profile?.role === 'director';
  const isDirector = profile?.role === 'director';
  const isManager = profile?.role === 'manager';
  const isSpecialist = profile?.role === 'specialist';

  const resetForm = () => {
    setCreateForm({
      id: '', 
      object_id: '', 
      title: '', 
      assigned_to: '', 
      start_date: getMinskISODate(), 
      deadline: '', 
      comment: '', 
      doc_link: '', 
      doc_name: '',
      checklist: []
    });
  };

  const fetchSingleTask = async (id: string) => {
    const { data } = await supabase
      .from('tasks')
      .select('*, checklist:task_checklists(*), executor:profiles!assigned_to(id, full_name, role), objects(id, name, responsible_id), creator:profiles!created_by(id, full_name)')
      .eq('id', id)
      .single();
    return data;
  };

  // Базовое получение данных
  const fetchData = useCallback(async (silent = false) => {
    if (!profile?.id || isFetching.current) return;
    
    isFetching.current = true;
    const isInitial = tasks.length === 0 && !silent;
    if (isInitial) setLoading(true);
    
    try {
      let tasksQuery = supabase.from('tasks')
        .select('*, checklist:task_checklists(*), executor:profiles!assigned_to(id, full_name, role), objects(id, name, responsible_id), creator:profiles!created_by(id, full_name)')
        .is('is_deleted', false)
        .eq('status', 'pending');

      if (isSpecialist) {
        tasksQuery = tasksQuery.or(`assigned_to.eq.${profile.id},created_by.eq.${profile.id}`);
      }

      const [activeResult, staffResult, objectsResult] = await Promise.all([
        measureQuery(tasksQuery.order('deadline', { ascending: true })),
        supabase.from('profiles').select('id, full_name, role').is('deleted_at', null),
        supabase.from('objects').select('id, name, current_stage').is('is_deleted', false)
      ]);

      if (!activeResult.cancelled && activeResult.data) {
        setTasks(activeResult.data);
      }
      if (staffResult.data) setStaff(staffResult.data);
      if (objectsResult.data) setObjects(objectsResult.data);
    } catch (err) {
      console.error('Fetch tasks error:', err);
    } finally {
      isFetching.current = false;
      setLoading(false);
    }
  }, [profile?.id, isSpecialist, tasks.length]);

  // Realtime Logic
  useEffect(() => {
    fetchData();

    const channel = supabase.channel('tasks_smart_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          // If new task is pending, add it. If completed, ignore (it goes to archive)
          if (payload.new.status === 'pending' && !payload.new.is_deleted) {
             const newTask = await fetchSingleTask(payload.new.id);
             if (newTask) setTasks(prev => [newTask, ...prev]);
          }
        } else if (payload.eventType === 'UPDATE') {
          if (payload.new.is_deleted || payload.new.status === 'completed') {
             // If deleted or moved to completed -> remove from active list
             setTasks(prev => prev.filter(t => t.id !== payload.new.id));
          } else {
             // If updated and still pending -> update in place
             const updatedTask = await fetchSingleTask(payload.new.id);
             if (updatedTask) setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
          }
        } else if (payload.eventType === 'DELETE') {
           setTasks(prev => prev.filter(t => t.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_checklists' }, async (payload) => {
        // When a checklist item changes, we need to refresh the parent task to show correct progress/items
        // Casting to any to avoid TS errors on payload.new/old properties
        const newRecord = payload.new as any;
        const oldRecord = payload.old as any;
        const taskId = newRecord.task_id || oldRecord.task_id;
        
        if (taskId) {
           const updatedTask = await fetchSingleTask(taskId);
           // Only update if the task is currently in our list
           if (updatedTask && updatedTask.status === 'pending') {
             setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
           }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);


  const fetchArchive = useCallback(async (page = 0) => {
    if (!profile?.id) return;
    
    const isInitial = archiveTasks.length === 0;
    if (isInitial) setLoading(true);

    try {
      let query = supabase.from('tasks')
        .select('*, checklist:task_checklists(*), executor:profiles!assigned_to(id, full_name, role), objects(id, name, responsible_id), creator:profiles!created_by(id, full_name)', { count: 'exact' })
        .is('is_deleted', false)
        .eq('status', 'completed')
        .gte('completed_at', `${archiveDates.start}T00:00:00`)
        .lte('completed_at', `${archiveDates.end}T23:59:59`);

      if (isSpecialist || isManager) {
        query = query.or(`assigned_to.eq.${profile.id},created_by.eq.${profile.id}`);
      }

      if (filterMode === 'mine') {
        query = query.eq('assigned_to', profile.id);
      } else if (filterMode === 'created') {
        query = query.eq('created_by', profile.id);
      }

      const { data, count, error } = await query
        .order('completed_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (!error) {
        setArchiveTasks(data || []);
        setArchiveTotal(count || 0);
        setArchivePage(page);
      }
    } catch (err) {
      console.error('Archive fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, isSpecialist, isManager, archiveDates, filterMode, archiveTasks.length]);

  useEffect(() => {
    if (activeTab === 'archive') {
      fetchArchive(0);
    }
  }, [activeTab, fetchArchive]);

  const baseVisibleTasks = useMemo(() => {
    if (isAdmin) return tasks;
    return tasks.filter(t => t.assigned_to === profile.id || t.created_by === profile.id);
  }, [tasks, isAdmin, profile.id]);

  const overdueCount = useMemo(() => {
    const todayStr = getMinskISODate();
    return baseVisibleTasks.filter((t: Task) => t.deadline && t.deadline < todayStr).length;
  }, [baseVisibleTasks]);

  const filteredTasks = useMemo(() => {
    if (activeTab === 'archive') return archiveTasks;
    const todayStr = getMinskISODate();
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = getMinskISODate(tomorrow);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = getMinskISODate(nextWeek);

    let list = baseVisibleTasks;
    if (filterMode === 'mine') {
      list = list.filter((t: Task) => t.assigned_to === profile.id);
    } else if (filterMode === 'created') {
      list = list.filter((t: Task) => t.created_by === profile.id);
    }

    switch (activeTab) {
      case 'today': 
        list = list.filter((t: Task) => {
          if (!t.deadline) return false;
          // Используем нормализацию даты (отсекаем время) для корректного сравнения
          const taskDate = getMinskISODate(t.deadline);
          return taskDate === todayStr || taskDate === tomorrowStr;
        });
        break;
      case 'week': 
        list = list.filter((t: Task) => t.deadline && t.deadline >= todayStr && t.deadline <= nextWeekStr);
        break;
      case 'overdue': 
        list = list.filter((t: Task) => t.deadline && t.deadline < todayStr);
        break;
      case 'active':
        if (activeRange.start) {
          list = list.filter(t => {
            if (!t.deadline) return false;
            // Нормализуем дату дедлайна до YYYY-MM-DD для корректного сравнения
            return getMinskISODate(t.deadline) >= activeRange.start;
          });
        }
        if (activeRange.end) {
          list = list.filter(t => {
            if (!t.deadline) return false;
            // Нормализуем дату дедлайна до YYYY-MM-DD для корректного сравнения
            return getMinskISODate(t.deadline) <= activeRange.end;
          });
        }
        break;
    }
    return list;
  }, [baseVisibleTasks, archiveTasks, activeTab, filterMode, profile.id, activeRange]);

  const teamWorkload = useMemo(() => {
    return staff.map(member => {
      let memberTasks = tasks.filter((t: Task) => t.assigned_to === member.id);
      if (isManager && member.id !== profile.id) {
        const isTargetSpecialistOrManager = member.role === 'specialist' || member.role === 'manager';
        if (!isTargetSpecialistOrManager) {
          memberTasks = memberTasks.filter(t => t.created_by === profile.id);
        }
      }
      return { ...member, tasks: memberTasks };
    }).filter(m => m.tasks.length > 0 || m.role === 'specialist' || m.role === 'manager');
  }, [staff, tasks, isManager, profile.id]);

  const addChecklistItem = () => {
    setCreateForm(prev => ({
      ...prev,
      checklist: [...prev.checklist, { content: '' }]
    }));
  };

  const updateChecklistItem = (index: number, content: string) => {
    const newList = [...createForm.checklist];
    newList[index].content = content;
    setCreateForm({ ...createForm, checklist: newList });
  };

  const removeChecklistItem = (index: number) => {
    setCreateForm(prev => ({
      ...prev,
      checklist: prev.checklist.filter((_, i) => i !== index)
    }));
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Валидация
    if (!createForm.object_id) {
      setToast({ message: 'Выберите объект', type: 'error' });
      return;
    }
    if (!createForm.title.trim()) {
      setToast({ message: 'Введите название задачи', type: 'error' });
      return;
    }
    if (!createForm.assigned_to) {
      setToast({ message: 'Выберите исполнителя', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      let taskId = createForm.id;
      
      if (isEditMode) {
        const { error } = await supabase.from('tasks').update({
          object_id: createForm.object_id,
          title: createForm.title,
          assigned_to: createForm.assigned_to,
          start_date: createForm.start_date,
          deadline: createForm.deadline || null,
          comment: createForm.comment,
          doc_link: createForm.doc_link,
          doc_name: createForm.doc_name,
          last_edited_at: new Date().toISOString(),
          last_edited_by: profile.id
        }).eq('id', createForm.id);

        if (error) throw error;
      } else {
        // При создании удаляем ID из объекта, чтобы Supabase сгенерировал UUID автоматически
        const { id, checklist, ...insertData } = createForm;
        
        // FIX: Находим объект и его текущий этап
        const selectedObj = objects.find(o => o.id === createForm.object_id);
        const stageId = selectedObj?.current_stage || null;

        const { data, error } = await supabase.from('tasks').insert([{
          ...insertData,
          stage_id: stageId, // Присваиваем этап, чтобы задача появилась на доске объекта
          created_by: profile.id,
          status: 'pending'
        }]).select('id').single();

        if (error) throw error;
        if (data) taskId = data.id;
      }

      // Обработка чек-листа
      if (taskId) {
        if (isEditMode) {
          const currentIds = createForm.checklist.filter(c => c.id).map(c => c.id);
          if (currentIds.length > 0) {
            await supabase.from('task_checklists').delete().eq('task_id', taskId).not('id', 'in', `(${currentIds.join(',')})`);
          } else {
            await supabase.from('task_checklists').delete().eq('task_id', taskId);
          }
        }

        const itemsToUpsert = createForm.checklist
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
      }

      setToast({ message: isEditMode ? 'Задача обновлена' : 'Задача создана', type: 'success' });
      setIsCreateModalOpen(false);
      resetForm();
      // State updates automatically via Realtime
    } catch (err: any) {
      console.error('Save task error:', err);
      setToast({ message: `Ошибка: ${err.message || 'Не удалось сохранить'}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditInit = (task: any) => {
    setIsEditMode(true);
    setCreateForm({
      id: task.id,
      object_id: task.object_id,
      title: task.title,
      assigned_to: task.assigned_to,
      start_date: task.start_date ? getMinskISODate(task.start_date) : getMinskISODate(),
      deadline: task.deadline ? getMinskISODate(task.deadline) : '',
      comment: task.comment || '',
      doc_link: task.doc_link || '',
      doc_name: task.doc_name || '',
      checklist: task.checklist?.map((c: any) => ({ id: c.id, content: c.content, is_completed: c.is_completed })) || []
    });
    setIsTaskDetailsModalOpen(false);
    setIsCreateModalOpen(true);
  };

  const handleDeleteInit = (id: string) => {
    setDeleteConfirm({ open: true, id });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('tasks').update({ 
        is_deleted: true, 
        deleted_at: new Date().toISOString() 
      }).eq('id', deleteConfirm.id);
      
      if (!error) {
        setToast({ message: 'Задача удалена', type: 'success' });
        setIsTaskDetailsModalOpen(false);
        setDeleteConfirm({ open: false, id: null });
        // Realtime handles state removal
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleChecklistItem = async (itemId: string, currentStatus: boolean, taskId: string) => {
    const task = tasks.find((t: Task) => t.id === taskId) || archiveTasks.find((t: Task) => t.id === taskId);
    if (!task) return;
    const isExecutor = task.assigned_to === profile.id;
    if (!isExecutor && !isAdmin) return;

    // Optimistic Update
    const updater = (t: Task) => {
      if (t.id === taskId && t.checklist) {
        return {
          ...t,
          checklist: t.checklist.map((item: any) => 
            item.id === itemId ? { ...item, is_completed: !currentStatus } : item
          )
        };
      }
      return t;
    };

    setTasks(prev => prev.map(updater));
    setArchiveTasks(prev => prev.map(updater));

    if (selectedTask?.id === taskId) {
      setSelectedTask({
        ...selectedTask,
        checklist: selectedTask.checklist.map((item: any) => 
          item.id === itemId ? { ...item, is_completed: !currentStatus } : item
        )
      });
    }
    
    // DB Update (Realtime will confirm)
    await supabase.from('task_checklists').update({ is_completed: !currentStatus }).eq('id', itemId);
  };

  const canEditDelete = (task: any) => {
    if (!task) return false;
    if (isAdmin) return true;
    return task.created_by === profile?.id;
  };

  const showBlockingLoader = loading && (
    (activeTab === 'archive' && archiveTasks.length === 0) || 
    (activeTab !== 'archive' && activeTab !== 'team' && tasks.length === 0) ||
    (activeTab === 'team' && staff.length === 0)
  );

  return (
    <div className="animate-in fade-in duration-500">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f] flex items-center gap-3">
            Задачи
            {loading && !showBlockingLoader && (
              <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full animate-pulse">
                <span className="material-icons-round text-sm">sync</span>
                ОБНОВЛЕНИЕ...
              </div>
            )}
          </h2>
          <p className="text-slate-500 text-sm mt-1">Планирование и контроль выполнения</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="bg-[#eff1f8] p-1 rounded-2xl flex">
              <button onClick={() => setFilterMode('all')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${filterMode === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-50'}`}>Все</button>
              <button onClick={() => setFilterMode('mine')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${filterMode === 'mine' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Мои</button>
              <button onClick={() => setFilterMode('created')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${filterMode === 'created' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Поставленные</button>
           </div>
           <Button onClick={() => { setIsEditMode(false); resetForm(); setIsCreateModalOpen(true); }} icon="add_circle" className="h-12 px-6">Поставить задачу</Button>
        </div>
      </div>

      <div className="flex items-center border-b border-slate-200 mb-8 overflow-x-auto scrollbar-hide">
        {[
          { id: 'active', label: 'Активные', icon: 'assignment' },
          { id: 'today', label: 'Сегодня+', icon: 'today' },
          { id: 'week', label: 'Неделя', icon: 'date_range' },
          { id: 'overdue', label: 'Просрочено', icon: 'warning', badge: overdueCount },
          { id: 'team', label: 'Команда', icon: 'groups', hidden: isSpecialist },
          { id: 'archive', label: 'Архив', icon: 'history' }
        ].filter(t => !t.hidden).map(tab => (
          <button 
            key={tab.id} 
            onClick={() => { setActiveTab(tab.id as TaskTab); if(tab.id === 'archive') setArchivePage(0); }} 
            className={`flex items-center gap-2 px-6 py-4 text-xs font-bold uppercase transition-all relative shrink-0 ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <span className="material-icons-round text-sm">{tab.icon}</span>
            {tab.label}
            {tab.badge ? (
              <span className="w-5 h-5 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                {tab.badge}
              </span>
            ) : null}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></div>}
          </button>
        ))}
      </div>

      {(activeTab === 'archive' || activeTab === 'active') && (
        <div className="flex flex-col md:flex-row gap-4 mb-6 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm animate-in slide-in-from-top-2 duration-300">
           <div className="flex-grow flex items-center gap-3">
              <span className="material-icons-round text-slate-400">{activeTab === 'archive' ? 'history' : 'filter_alt'}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                {activeTab === 'archive' ? 'Архив за период:' : 'Фильтр дедлайнов:'}
              </span>
           </div>
           <div className="flex items-center gap-2">
              <Input 
                type="date" 
                value={activeTab === 'archive' ? archiveDates.start : activeRange.start} 
                onChange={(e:any) => activeTab === 'archive' 
                  ? setArchiveDates({...archiveDates, start: e.target.value}) 
                  : setActiveRange({...activeRange, start: e.target.value})} 
                className="h-10 !py-1 !text-xs !rounded-xl" 
              />
              <span className="text-slate-300 font-bold text-[10px]">ПО</span>
              <Input 
                type="date" 
                value={activeTab === 'archive' ? archiveDates.end : activeRange.end} 
                onChange={(e:any) => activeTab === 'archive' 
                  ? setArchiveDates({...archiveDates, end: e.target.value}) 
                  : setActiveRange({...activeRange, end: e.target.value})} 
                className="h-10 !py-1 !text-xs !rounded-xl" 
              />
              <Button 
                variant="tonal" 
                icon="refresh" 
                onClick={() => activeTab === 'archive' ? fetchArchive(0) : fetchData()} 
                className="h-10 w-10 !px-0 rounded-xl" 
              />
           </div>
        </div>
      )}

      {showBlockingLoader ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Загрузка данных...</p>
        </div>
      ) : activeTab === 'team' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teamWorkload.map((member: any) => (
            <div key={member.id} className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[380px]">
              <div className="p-6 pb-4 flex justify-between items-start shrink-0">
                <div>
                  <h4 className="text-base font-bold text-slate-900 leading-tight">{member.full_name}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{member.role}</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold shadow-inner">
                    {member.tasks.length}
                  </div>
                  <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Задач</span>
                </div>
              </div>
              
              <div className="px-4 pb-6 space-y-2 overflow-y-auto flex-grow scrollbar-hide">
                {member.tasks.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-30 italic">
                     <span className="material-icons-round text-3xl mb-1">done_all</span>
                     <p className="text-[10px] uppercase font-bold tracking-widest">Задач нет</p>
                  </div>
                ) : (
                  member.tasks.map((task: Task) => {
                    const isOverdue = task.deadline && task.deadline < getMinskISODate();
                    return (
                      <div 
                        key={task.id} 
                        onClick={() => { setSelectedTask(task); setIsTaskDetailsModalOpen(true); }}
                        className="bg-[#f8f9fa] p-3 rounded-2xl border border-transparent hover:border-blue-200 transition-all cursor-pointer group hover:bg-white hover:shadow-sm"
                      >
                        <p className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight">{task.title}</p>
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase truncate pr-2">{(task as any).objects?.name}</span>
                          <span className={`text-[10px] font-bold whitespace-nowrap ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                            {task.deadline ? formatDate(task.deadline) : '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4">
             {filteredTasks.length === 0 ? (
               <div className="py-32 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
                 <span className="material-icons-round text-5xl text-slate-200 mb-4">
                   {activeTab === 'archive' ? 'history_toggle_off' : 'assignment_turned_in'}
                 </span>
                 <p className="text-slate-400 font-medium italic">
                   {activeTab === 'archive' ? 'Архив пуст за выбранный период' : 'Задачи не найдены'}
                 </p>
               </div>
             ) : (
               filteredTasks.map((task: Task) => {
                 const isOverdue = task.deadline && task.deadline < getMinskISODate() && task.status !== 'completed';
                 const isCompleted = task.status === 'completed';
                 return (
                   <div key={task.id} onClick={() => { setSelectedTask(task); setIsTaskDetailsModalOpen(true); }} className={`bg-white p-5 rounded-[28px] border transition-all cursor-pointer group flex items-center justify-between ${isCompleted ? 'border-slate-100 opacity-75' : 'border-slate-200 hover:border-blue-400 hover:shadow-md'}`}>
                      <div className="flex items-center gap-5 min-w-0">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isCompleted ? 'bg-emerald-50 text-emerald-500' : isOverdue ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                          <span className="material-icons-round text-xl">
                            {isCompleted ? 'check_circle' : isOverdue ? 'priority_high' : 'more_horiz'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h4 className={`font-bold transition-colors truncate ${isCompleted ? 'text-slate-400' : 'text-slate-900 group-hover:text-blue-600'}`}>
                            {task.title}
                            {task.doc_link && <span className="material-icons-round text-sm ml-2 text-slate-300">attach_file</span>}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold uppercase rounded-lg tracking-tight">{(task as any).objects?.name || 'Объект'}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Исполнитель: {(task as any).executor?.full_name}</span>
                            {isCompleted && task.completed_at && (
                              <span className="text-[9px] font-bold text-emerald-500 uppercase ml-2 bg-emerald-50 px-2 py-0.5 rounded">Завершено {formatDate(task.completed_at)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 shrink-0 ml-4">
                        {!isCompleted && task.deadline && (
                          <div className="text-right">
                            <p className={`text-xs font-bold ${isOverdue ? 'text-red-500' : 'text-slate-700'}`}>
                              {formatDate(task.deadline)}
                            </p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Дедлайн</p>
                          </div>
                        )}
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (task.object_id) onNavigateToObject(task.object_id, (task as any).stage_id); 
                          }} 
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all group/btn ${isCompleted ? 'hover:bg-slate-100' : 'hover:bg-blue-50'}`}
                        >
                          <span className={`material-icons-round transition-all ${isCompleted ? 'text-slate-300 group-hover:text-slate-600' : 'text-slate-300 group-hover:text-blue-600 group-hover/btn:translate-x-1'}`}>chevron_right</span>
                        </button>
                      </div>
                   </div>
                 );
               })
             )}
          </div>

          {activeTab === 'archive' && archiveTotal > PAGE_SIZE && (
            <div className="mt-8 flex items-center justify-center gap-4">
               <button 
                 disabled={archivePage === 0 || loading}
                 onClick={() => fetchArchive(archivePage - 1)}
                 className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
               >
                 <span className="material-icons-round">chevron_left</span>
               </button>
               <div className="flex items-center gap-2">
                 <span className="text-xs font-bold text-slate-400 uppercase">Страница</span>
                 <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg">{archivePage + 1}</span>
                 <span className="text-xs font-bold text-slate-400 uppercase">из {Math.ceil(archiveTotal / PAGE_SIZE)}</span>
               </div>
               <button 
                 disabled={(archivePage + 1) * PAGE_SIZE >= archiveTotal || loading}
                 onClick={() => fetchArchive(archivePage + 1)}
                 className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
               >
                 <span className="material-icons-round">chevron_right</span>
               </button>
            </div>
          )}
        </>
      )}

      {/* Модальное окно создания/редактирования */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title={isEditMode ? "Редактирование задачи" : "Новая задача"}>
        <form onSubmit={handleSaveTask} className="space-y-4">
          <Input label="Что нужно сделать?" required value={createForm.title} onChange={(e:any) => setCreateForm({...createForm, title: e.target.value})} />
          <Select label="Объект" required value={createForm.object_id} onChange={(e:any) => setCreateForm({...createForm, object_id: e.target.value})} options={[{value: '', label: 'Выберите объект'}, ...objects.map(o => ({value: o.id, label: o.name}))]} />
          <Select label="Исполнитель" required value={createForm.assigned_to} onChange={(e:any) => setCreateForm({...createForm, assigned_to: e.target.value})} options={[{value: '', label: 'Выбрать исполнителя'}, ...staff.map(s => ({value: s.id, label: s.full_name}))]} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Начало" type="date" required value={createForm.start_date} onChange={(e:any) => setCreateForm({...createForm, start_date: e.target.value})} />
            <Input label="Дедлайн" type="date" value={createForm.deadline} onChange={(e:any) => setCreateForm({...createForm, deadline: e.target.value})} />
          </div>
          
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Документация (опц.)</p>
             <div className="grid grid-cols-2 gap-4">
               <Input label="Имя документа" value={createForm.doc_name} onChange={(e:any) => setCreateForm({ ...createForm, doc_name: e.target.value })} icon="description" />
               <Input label="Ссылка" value={createForm.doc_link} onChange={(e:any) => setCreateForm({ ...createForm, doc_link: e.target.value })} icon="link" />
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
                {createForm.checklist.map((item, idx) => (
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

          <div className="w-full">
            <label className="block text-xs font-medium text-[#444746] mb-1.5 ml-1">Описание / ТЗ</label>
            <textarea className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:border-blue-500" rows={3} placeholder="Описание / детали..." value={createForm.comment} onChange={(e) => setCreateForm({...createForm, comment: e.target.value})} />
          </div>
          <Button type="submit" className="w-full h-14" loading={loading}>{isEditMode ? 'Сохранить изменения' : 'Создать задачу'}</Button>
        </form>
      </Modal>

      <Modal isOpen={isTaskDetailsModalOpen} onClose={() => setIsTaskDetailsModalOpen(false)} title="Детали задачи">
        {selectedTask && (
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <h3 className="text-xl font-bold text-slate-900 leading-tight pr-4">{selectedTask.title}</h3>
              <Badge color={selectedTask.status === 'completed' ? 'emerald' : 'blue'}>
                {selectedTask.status === 'completed' ? 'ВЫПОЛНЕНО' : 'В РАБОТЕ'}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-100">
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Объект</p>
                 <p className="text-sm font-medium text-slate-700">{selectedTask.objects?.name || 'Не указан'}</p>
               </div>
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Срок</p>
                 <p className={`text-sm font-bold ${selectedTask.deadline && selectedTask.deadline < getMinskISODate() && selectedTask.status !== 'completed' ? 'text-red-500' : 'text-slate-700'}`}>
                   {selectedTask.deadline ? formatDate(selectedTask.deadline) : 'Бессрочно'}
                 </p>
               </div>
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Поставил задачу</p>
                 <p className="text-sm font-medium text-slate-700">{selectedTask.creator?.full_name || 'Система'}</p>
               </div>
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Создана</p>
                 <p className="text-sm font-medium text-slate-700">{formatDate(selectedTask.created_at, true)}</p>
               </div>
            </div>

            {selectedTask.checklist && selectedTask.checklist.length > 0 && (
              <div className="bg-slate-50 p-5 rounded-[24px] border border-slate-100">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Чек-лист выполнения</p>
                 <div className="space-y-3">
                    {selectedTask.checklist.map((item: any) => {
                      const canToggle = selectedTask.assigned_to === profile.id || isAdmin;
                      return (
                        <div key={item.id} className="flex items-start gap-3 group/item">
                          <button 
                            type="button"
                            disabled={!canToggle}
                            onClick={() => toggleChecklistItem(item.id, item.is_completed, selectedTask.id)}
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
                   {selectedTask.executor?.full_name?.charAt(0)}
                 </div>
                 <p className="text-sm font-bold text-slate-800">{selectedTask.executor?.full_name}</p>
               </div>
            </div>

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
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Описание / ТЗ</p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap italic leading-relaxed">{selectedTask.comment}</p>
              </div>
            )}

            <div className="flex gap-2">
               {canEditDelete(selectedTask) && (
                 <>
                   <Button variant="tonal" onClick={() => handleEditInit(selectedTask)} icon="edit" className="flex-1">Изменить</Button>
                   <Button variant="danger" onClick={() => handleDeleteInit(selectedTask.id)} icon="delete" className="flex-1">Удалить</Button>
                 </>
               )}
               {selectedTask.object_id && (
                 <Button 
                   onClick={() => { 
                     onNavigateToObject(selectedTask.object_id, selectedTask.stage_id); 
                     setIsTaskDetailsModalOpen(false); 
                   }} 
                   icon="open_in_new" 
                   className="flex-1"
                 >
                   К объекту
                 </Button>
               )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal 
        isOpen={deleteConfirm.open} 
        onClose={() => setDeleteConfirm({ open: false, id: null })} 
        onConfirm={handleDeleteConfirm} 
        title="Удаление задачи" 
        message="Вы уверены? Задача будет перенесена в корзину." 
        confirmVariant="danger" 
        loading={loading} 
      />
    </div>
  );
};

export default Tasks;
