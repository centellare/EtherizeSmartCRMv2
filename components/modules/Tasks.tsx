
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, measureQuery } from '../../lib/supabase';
import { Modal, ConfirmModal, Button, Drawer, useToast } from '../ui';
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
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TaskTab>('active');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const toast = useToast();
  
  // Временной фильтр для активных задач
  const [activeRange, setActiveRange] = useState({ start: '', end: '' });

  // Состояния для архива
  const [archivePage, setArchivePage] = useState(0);
  const [archiveDates, setArchiveDates] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: getMinskISODate()
  });
  
  // Modals state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'details' | 'completion' | 'none'>('none');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const isAdmin = profile?.role === 'admin' || profile?.role === 'director';
  const isManager = profile?.role === 'manager';
  const isSpecialist = profile?.role === 'specialist';

  // --- QUERIES ---

  // 1. Staff
  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, role').is('deleted_at', null).neq('role', 'client');
      return data || [];
    },
    staleTime: 1000 * 60 * 5 // 5 minutes
  });

  // 2. Objects
  const { data: objects = [] } = useQuery({
    queryKey: ['objects'],
    queryFn: async () => {
      const { data } = await supabase.from('objects').select('id, name, current_stage').is('is_deleted', false);
      return data || [];
    },
    staleTime: 1000 * 60 * 5
  });

  // 3. Active Tasks
  const { data: activeTasks = [], isLoading: isActiveLoading } = useQuery({
    queryKey: ['tasks', 'active', { userId: profile?.id, filterMode }],
    queryFn: async () => {
      let query = supabase.from('tasks')
        .select('*, checklist:task_checklists(*), questions:task_questions(*), executor:profiles!assigned_to(id, full_name, role), objects(id, name, responsible_id), creator:profiles!created_by(id, full_name)')
        .is('is_deleted', false)
        .in('status', ['pending', 'in_progress']);

      if (filterMode === 'mine') {
        query = query.eq('assigned_to', profile.id);
      } else if (filterMode === 'created') {
        query = query.eq('created_by', profile.id);
      }

      const { data } = await measureQuery(query.order('deadline', { ascending: true }));
      return (data || []) as unknown as Task[];
    },
    enabled: !!profile?.id,
    refetchInterval: 5000, // Poll every 5 seconds
    staleTime: 1000 // Consider data stale after 1 second to allow polling to fetch new data
  });

  // 4. Archive Tasks
  const { data: archiveData, isLoading: isArchiveLoading } = useQuery({
    queryKey: ['tasks', 'archive', { userId: profile?.id, filterMode, page: archivePage, dates: archiveDates }],
    queryFn: async () => {
      let query = supabase.from('tasks')
        .select('*, checklist:task_checklists(*), questions:task_questions(*), executor:profiles!assigned_to(id, full_name, role), objects(id, name, responsible_id), creator:profiles!created_by(id, full_name)', { count: 'exact' })
        .is('is_deleted', false)
        .eq('status', 'completed')
        .gte('completed_at', `${archiveDates.start}T00:00:00`)
        .lte('completed_at', `${archiveDates.end}T23:59:59`);

      if (filterMode === 'mine') {
        query = query.eq('assigned_to', profile.id);
      } else if (filterMode === 'created') {
        query = query.eq('created_by', profile.id);
      }

      const { data, count } = await query
        .order('completed_at', { ascending: false })
        .range(archivePage * PAGE_SIZE, (archivePage + 1) * PAGE_SIZE - 1);
      
      return { tasks: (data || []) as unknown as Task[], total: count || 0 };
    },
    enabled: !!profile?.id && activeTab === 'archive',
    placeholderData: (previousData) => previousData, // Keep previous data while fetching new page
    refetchInterval: 30000 // Poll archive less frequently
  });

  const archiveTasks = archiveData?.tasks || [];
  const archiveTotal = archiveData?.total || 0;

  // --- REALTIME ---
  useEffect(() => {
    const channel = supabase.channel('tasks_rq_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_checklists' }, () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_questions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // --- DEEP LINKING ---
  useEffect(() => {
    const handleInitialTask = async () => {
      if (initialTaskId) {
        // Check in active tasks first
        let found = activeTasks.find(t => t.id === initialTaskId);
        
        // If not found, try fetching directly
        if (!found) {
          const { data } = await supabase
            .from('tasks')
            .select('*, checklist:task_checklists(*), questions:task_questions(*), executor:profiles!assigned_to(id, full_name, role), objects(id, name, responsible_id), creator:profiles!created_by(id, full_name)')
            .eq('id', initialTaskId)
            .single();
          if (data) found = data as unknown as Task;
        }
        
        if (found) {
          setSelectedTask(found);
          setModalMode('details');
        }
      }
    };
    if (initialTaskId && !isActiveLoading) {
        handleInitialTask();
    }
  }, [initialTaskId, activeTasks, isActiveLoading]);

  // Sync selectedTask with activeTasks updates
  useEffect(() => {
    if (selectedTask && activeTasks.length > 0) {
      const updated = activeTasks.find(t => t.id === selectedTask.id);
      if (updated && updated.status !== selectedTask.status) {
        setSelectedTask(updated);
      }
    }
  }, [activeTasks, selectedTask]);

  // --- FILTER LOGIC ---
  const baseVisibleTasks = useMemo(() => activeTasks, [activeTasks]);

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
      let memberTasks = activeTasks.filter((t: Task) => t.assigned_to === member.id);
      return { ...member, tasks: memberTasks };
    }).filter(m => m.tasks.length > 0 || m.role === 'specialist' || m.role === 'manager');
  }, [staff, activeTasks]);

  // --- ACTIONS ---
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    try {
      const { error } = await supabase.from('tasks').update({ 
        is_deleted: true, 
        deleted_at: new Date().toISOString() 
      }).eq('id', deleteConfirm.id);
      
      if (!error) {
        toast.success('Задача удалена');
        setModalMode('none');
        setDeleteConfirm({ open: false, id: null });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }
    } catch (e) {
        console.error(e);
    }
  };

  const handleCloseModal = () => {
    setModalMode('none');
    if (initialTaskId) {
      window.location.hash = 'tasks';
    }
  };

  const loading = isActiveLoading || (activeTab === 'archive' && isArchiveLoading);

  const showBlockingLoader = loading && (
    (activeTab === 'archive' && archiveTasks.length === 0) || 
    (activeTab !== 'archive' && activeTab !== 'team' && activeTasks.length === 0) ||
    (activeTab === 'team' && staff.length === 0)
  );

  return (
    <div className="animate-in fade-in duration-500">
      
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
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['tasks'] })}
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
            currentUserId={profile.id}
            isAdmin={isAdmin}
            onPageChange={setArchivePage}
            onTaskClick={(t) => { setSelectedTask(t); setModalMode('details'); }}
            onNavigateToObject={onNavigateToObject}
            onRequestComplete={(t) => { setSelectedTask(t); setModalMode('completion'); }}
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
                toast.success('Успешно сохранено'); 
                queryClient.invalidateQueries({ queryKey: ['tasks'] });
            }}
        />
      </Modal>

      <Drawer isOpen={modalMode === 'details'} onClose={handleCloseModal} title="Карточка задачи">
        {selectedTask && (
            <div className="pb-20"> 
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
                    onStatusChange={() => {
                        queryClient.invalidateQueries({ queryKey: ['tasks'] });
                    }}
                />
                
                {(selectedTask?.assigned_to === profile.id || isAdmin) && selectedTask?.status === 'in_progress' && (
                    <div className="mt-8 pt-4 border-t border-slate-100">
                        <Button variant="primary" className="w-full h-12" onClick={() => setModalMode('completion')}>Завершить задачу</Button>
                    </div>
                )}
            </div>
        )}
      </Drawer>

      <Modal isOpen={modalMode === 'completion'} onClose={handleCloseModal} title="Отчет о выполнении">
        <TaskCompletionModal 
            task={selectedTask} 
            onSuccess={() => {
                handleCloseModal();
                toast.success('Задача завершена');
                queryClient.invalidateQueries({ queryKey: ['tasks'] });
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
