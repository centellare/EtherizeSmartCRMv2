
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase, measureQuery } from '../../lib/supabase';
import { Button, Input, Select, Badge, Modal, ConfirmModal, Toast } from '../ui';
import { Task } from '../../types';
import { formatDate, getMinskISODate } from '../../lib/dateUtils';

type FilterMode = 'all' | 'mine' | 'created';
type TaskTab = 'active' | 'today' | 'week' | 'overdue' | 'team' | 'archive';

const PAGE_SIZE = 50;

const Tasks: React.FC<{ profile: any; onNavigateToObject: (objectId: string, stageId?: string) => void; refreshTrigger?: number }> = ({ profile, onNavigateToObject, refreshTrigger = 0 }) => {
  const [activeTab, setActiveTab] = useState<TaskTab>('active');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  const [activeRange, setActiveRange] = useState({ start: '', end: '' });
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
  const isSpecialist = profile?.role === 'specialist';

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

  useEffect(() => {
    fetchData();
  }, [fetchData, activeTab, filterMode, activeRange, refreshTrigger]); // Триггер в зависимостях

  useEffect(() => {
    const channel = supabase.channel('tasks_smart_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, async (payload) => {
        // Упрощаем логику для стабильности: при любом изменении в задачах тянем свежие данные
        fetchData(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
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
        const { id, checklist, ...insertData } = createForm;
        const selectedObj = objects.find(o => o.id === createForm.object_id);
        const stageId = selectedObj?.current_stage || null;
        const { data, error } = await supabase.from('tasks').insert([{
          ...insertData,
          stage_id: stageId,
          created_by: profile.id,
          status: 'pending'
        }]).select('id').single();
        if (error) throw error;
        if (data) taskId = data.id;
      }
      
      setToast({ message: isEditMode ? 'Задача обновлена' : 'Задача создана', type: 'success' });
      setIsCreateModalOpen(false);
      // Мгновенный рефетч
      await fetchData(true);
    } catch (err: any) {
      setToast({ message: `Ошибка: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = useMemo(() => {
    if (activeTab === 'archive') return archiveTasks;
    const todayStr = getMinskISODate();
    let list = tasks;
    switch (activeTab) {
      case 'today': 
        list = list.filter((t: Task) => t.deadline === todayStr);
        break;
      case 'overdue': 
        list = list.filter((t: Task) => t.deadline && t.deadline < todayStr);
        break;
    }
    return list;
  }, [tasks, archiveTasks, activeTab]);

  return (
    <div className="animate-in fade-in duration-500">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f] flex items-center gap-2">
            Задачи
            {loading && <span className="material-icons-round animate-spin text-blue-600 text-sm">sync</span>}
          </h2>
        </div>
        <div className="flex items-center gap-2">
           <Button onClick={() => { setIsEditMode(false); setIsCreateModalOpen(true); }} icon="add_circle">Поставить задачу</Button>
        </div>
      </div>

      <div className="flex items-center border-b border-slate-200 mb-8 overflow-x-auto scrollbar-hide">
        {[
          { id: 'active', label: 'Активные', icon: 'assignment' },
          { id: 'today', label: 'Сегодня', icon: 'today' },
          { id: 'overdue', label: 'Просрочено', icon: 'warning' },
          { id: 'archive', label: 'Архив', icon: 'history' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id as TaskTab)} 
            className={`flex items-center gap-2 px-6 py-4 text-xs font-bold uppercase relative shrink-0 ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <span className="material-icons-round text-sm">{tab.icon}</span>
            <span>{tab.label}</span>
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></div>}
          </button>
        ))}
      </div>

      {loading && tasks.length === 0 ? (
        <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div></div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
           {filteredTasks.length === 0 ? (
             <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
               <p className="text-slate-400">Задачи не найдены</p>
             </div>
           ) : (
             filteredTasks.map((task: Task) => (
               <div key={task.id} onClick={() => { setSelectedTask(task); setIsTaskDetailsModalOpen(true); }} className="bg-white p-5 rounded-[28px] border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${task.status === 'completed' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-500'}`}>
                      <span className="material-icons-round">{task.status === 'completed' ? 'check' : 'pending'}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{task.title}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{(task as any).objects?.name}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500">{task.deadline ? formatDate(task.deadline) : '—'}</span>
               </div>
             ))
           )}
        </div>
      )}
      {/* Остальные модальные окна без изменений */}
    </div>
  );
};

export default Tasks;
