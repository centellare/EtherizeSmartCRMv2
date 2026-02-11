
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase, measureQuery } from '../../lib/supabase';
import { Modal, ConfirmModal, Toast, Button } from '../ui';
import { Task } from '../../types';
import { getMinskISODate } from '../../lib/dateUtils';

// Sub-components
import { TaskFilters } from './Tasks/TaskFilters';
import { TeamWorkload } from './Tasks/TeamWorkload';
import { TaskList } from './Tasks/TaskList';
import { TaskModal } from './Tasks/modals/TaskModal';
import { TaskDetails } from './Tasks/modals/TaskDetails';
import { TaskCompletionModal } from './Tasks/modals/TaskCompletionModal';

type FilterMode = 'all' | 'mine' | 'created';
type TaskTab = 'active' | 'today' | 'week' | 'overdue' | 'team' | 'archive';

const PAGE_SIZE = 50;

interface TasksProps {
  profile: any;
  onNavigateToObject: (objectId: string, stageId?: string) => void;
  initialTaskId?: string | null;
}

const Tasks: React.FC<TasksProps> = ({ profile, onNavigateToObject, initialTaskId }) => {
  const [activeTab, setActiveTab] = useState<TaskTab>('active');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Временной фильтр для активных задач
  const [activeRange, setActiveRange] = useState({ start: '', end: '' });

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
  
  // Modals state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'details' | 'completion' | 'none'>('none');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const isFetching = useRef(false);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'director';
  const isManager = profile?.role === 'manager';
  const isSpecialist = profile?.role === 'specialist';

  // --- DATA FETCHING ---

  const fetchSingleTask = async (id: string) => {
    const { data } = await supabase
      .from('tasks')
      .select('*, checklist:task_checklists(*), executor:profiles!assigned_to(id, full_name, role), objects(id, name, responsible_id), creator:profiles!created_by(id, full_name)')
      .eq('id', id)
      .single();
    return data;
  };

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

      if (filterMode === 'mine') {
        tasksQuery = tasksQuery.eq('assigned_to', profile.id);
      } else if (filterMode === 'created') {
        tasksQuery = tasksQuery.eq('created_by', profile.id);
      } else if (isSpecialist) {
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
  }, [profile?.id, isSpecialist, tasks.length, filterMode]);

  useEffect(() => { fetchData(); }, [fetchData, activeTab, filterMode, activeRange]);

  // Deep Linking: Open specific task
  useEffect(() => {
    const handleInitialTask = async () => {
      if (initialTaskId) {
        // Проверяем в уже загруженных
        let found = tasks.find(t => t.id === initialTaskId);
        // Если нет, пробуем загрузить отдельно (может быть в архиве или у другого юзера)
        if (!found) {
          found = await fetchSingleTask(initialTaskId);
        }
        
        if (found) {
          setSelectedTask(found);
          setModalMode('details');
        }
      }
    };
    handleInitialTask();
  }, [initialTaskId, tasks]);

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
  }, [profile?.id, isSpecialist, isManager, archiveDates, filterMode]);

  useEffect(() => {
    if (activeTab === 'archive') {
      fetchArchive(0);
    }
  }, [activeTab, fetchArchive, archiveDates, filterMode]);

  // Realtime Logic
  useEffect(() => {
    const channel = supabase.channel('tasks_smart_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          if (payload.new.status === 'pending' && !payload.new.is_deleted) {
             const newTask = await fetchSingleTask(payload.new.id);
             if (newTask) setTasks(prev => [newTask, ...prev]);
          }
        } else if (payload.eventType === 'UPDATE') {
          if (payload.new.is_deleted || payload.new.status === 'completed') {
             setTasks(prev => prev.filter(t => t.id !== payload.new.id));
          } else {
             const updatedTask = await fetchSingleTask(payload.new.id);
             if (updatedTask) setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
          }
        } else if (payload.eventType === 'DELETE') {
           setTasks(prev => prev.filter(t => t.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_checklists' }, async (payload) => {
        const newRecord = payload.new as any;
        const oldRecord = payload.old as any;
        const taskId = newRecord.task_id || oldRecord.task_id;
        
        if (taskId) {
           const updatedTask = await fetchSingleTask(taskId);
           if (updatedTask && updatedTask.status === 'pending') {
             setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
           }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // --- FILTER LOGIC ---

  const baseVisibleTasks = useMemo(() => tasks, [tasks]);

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
    
    switch (activeTab) {
      case 'today': 
        list = list.filter((t: Task) => {
          if (!t.deadline) return false;
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
          list = list.filter(t => t.deadline && getMinskISODate(t.deadline) >= activeRange.start);
        }
        if (activeRange.end) {
          list = list.filter(t => t.deadline && getMinskISODate(t.deadline) <= activeRange.end);
        }
        break;
    }
    return list;
  }, [baseVisibleTasks, archiveTasks, activeTab, activeRange]);

  const teamWorkload = useMemo(() => {
    return staff.map(member => {
      let memberTasks = tasks.filter((t: Task) => t.assigned_to === member.id);
      return { ...member, tasks: memberTasks };
    }).filter(m => m.tasks.length > 0 || m.role === 'specialist' || m.role === 'manager');
  }, [staff, tasks]);

  // --- ACTIONS ---

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
        setModalMode('none');
        setDeleteConfirm({ open: false, id: null });
        await fetchData(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModalMode('none');
    if (initialTaskId) {
      window.location.hash = 'tasks';
    }
  };

  const showBlockingLoader = loading && (
    (activeTab === 'archive' && archiveTasks.length === 0) || 
    (activeTab !== 'archive' && activeTab !== 'team' && tasks.length === 0) ||
    (activeTab === 'team' && staff.length === 0)
  );

  return (
    <div className="animate-in fade-in duration-500">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <TaskFilters 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        filterMode={filterMode} 
        setFilterMode={setFilterMode}
        overdueCount={overdueCount}
        isSpecialist={isSpecialist}
        onOpenCreate={() => { setSelectedTask(null); setModalMode('create'); }}
        archiveDates={archiveDates}
        setArchiveDates={setArchiveDates}
        activeRange={activeRange}
        setActiveRange={setActiveRange}
        onRefresh={() => activeTab === 'archive' ? fetchArchive(0) : fetchData()}
      />

      {showBlockingLoader ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Загрузка данных...</p>
        </div>
      ) : activeTab === 'team' ? (
        <TeamWorkload 
            teamWorkload={teamWorkload} 
            onTaskClick={(t) => { setSelectedTask(t); setModalMode('details'); }} 
        />
      ) : (
        <TaskList 
            tasks={filteredTasks}
            activeTab={activeTab}
            archivePage={archivePage}
            archiveTotal={archiveTotal}
            onPageChange={fetchArchive}
            onTaskClick={(t) => { setSelectedTask(t); setModalMode('details'); }}
            onNavigateToObject={onNavigateToObject}
        />
      )}

      {/* --- MODALS --- */}

      <Modal isOpen={modalMode === 'create' || modalMode === 'edit'} onClose={handleCloseModal} title={modalMode === 'edit' ? "Редактирование задачи" : "Новая задача"}>
        <TaskModal 
            mode={modalMode as 'create' | 'edit'}
            initialData={selectedTask}
            profile={profile}
            staff={staff}
            objects={objects}
            onSuccess={() => {
                handleCloseModal(); 
                setToast({message: 'Успешно сохранено', type: 'success'}); 
                fetchData(true);
            }}
        />
      </Modal>

      <Modal isOpen={modalMode === 'details'} onClose={handleCloseModal} title="Детали задачи">
        <TaskDetails 
            task={selectedTask}
            profile={profile}
            isAdmin={isAdmin}
            onEdit={() => setModalMode('edit')}
            onDelete={() => setDeleteConfirm({ open: true, id: selectedTask.id })}
            onClose={handleCloseModal}
            onNavigateToObject={(objId, stageId) => {
                onNavigateToObject(objId, stageId);
                setModalMode('none');
            }}
        />
        {(selectedTask?.assigned_to === profile.id || isAdmin) && selectedTask?.status !== 'completed' && (
             <div className="px-6 pb-6 pt-2">
                 <Button variant="tonal" className="w-full" onClick={() => setModalMode('completion')}>Завершить задачу</Button>
             </div>
        )}
      </Modal>

      <Modal isOpen={modalMode === 'completion'} onClose={handleCloseModal} title="Отчет о выполнении">
        <TaskCompletionModal 
            task={selectedTask} 
            onSuccess={() => {
                handleCloseModal();
                setToast({message: 'Задача завершена', type: 'success'});
                fetchData(true);
            }} 
        />
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
