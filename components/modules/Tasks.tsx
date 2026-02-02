
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase, measureQuery } from '../../lib/supabase';
import { Button, Input, Select, Badge, Modal } from '../ui';

type FilterMode = 'all' | 'mine' | 'created' | 'responsible';
type TaskTab = 'today' | 'week' | 'month' | 'active' | 'archive' | 'deadlines' | 'employees' | 'closed' | 'overdue';

const Tasks: React.FC<{ profile: any; onNavigateToObject: (objectId: string, stageId?: string) => void }> = ({ profile, onNavigateToObject }) => {
  const [activeTab, setActiveTab] = useState<TaskTab>('active');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [archiveTasks, setArchiveTasks] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [objects, setObjects] = useState<any[]>([]);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTaskDetailsModalOpen, setIsTaskDetailsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const isFetching = useRef(false);

  const [createForm, setCreateForm] = useState({
    object_id: '', title: '', assigned_to: '', start_date: new Date().toISOString().split('T')[0], deadline: '', comment: '', doc_link: '', doc_name: ''
  });

  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [employeeFilter, setEmployeeFilter] = useState('all');

  const isAdmin = profile?.role === 'admin' || profile?.role === 'director';
  const isDirector = profile?.role === 'director';
  const isManager = profile?.role === 'manager';
  const isSpecialist = profile?.role === 'specialist';

  const fetchData = useCallback(async (silent = false) => {
    if (!profile?.id || isFetching.current) return;
    
    isFetching.current = true;
    if (!silent) setLoading(true);
    
    try {
      const [activeResult, staffResult, objectsResult] = await Promise.all([
        measureQuery(
          supabase.from('tasks')
            .select('*, executor:profiles!assigned_to(id, full_name, role), objects(id, name, responsible_id), creator:profiles!created_by(id, full_name)')
            .is('is_deleted', false)
            .eq('status', 'pending')
            .order('deadline', { ascending: true })
        ),
        supabase.from('profiles').select('id, full_name, role').is('deleted_at', null),
        supabase.from('objects').select('id, name, current_stage').is('is_deleted', false)
      ]);

      // Проверяем, не был ли запрос отменен
      if (!activeResult.cancelled) {
        setTasks(activeResult.data || []);
      }
      setStaff(staffResult.data || []);
      setObjects(objectsResult.data || []);
    } catch (err) {
      console.error('Fetch tasks error:', err);
    } finally {
      isFetching.current = false;
      setLoading(false);
    }
  }, [profile?.id]);

  const fetchArchive = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      let query = supabase.from('tasks')
        .select('*, executor:profiles!assigned_to(id, full_name, role), objects(id, name), creator:profiles!created_by(full_name)')
        .is('is_deleted', false)
        .eq('status', 'completed')
        .gte('completed_at', dateRange.start + 'T00:00:00')
        .lte('completed_at', dateRange.end + 'T23:59:59');

      if (employeeFilter !== 'all') query = query.eq('assigned_to', employeeFilter);

      const result = await measureQuery(query.order('completed_at', { ascending: false }));
      if (!result.cancelled) {
        setArchiveTasks(result.data || []);
      }
    } catch (err) {
      console.error('Archive fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, dateRange, employeeFilter]);

  useEffect(() => {
    if (profile?.id) {
      fetchData();
    }
  }, [profile?.id, fetchData]);

  useEffect(() => {
    if (activeTab === 'archive' || activeTab === 'closed') {
      fetchArchive();
    }
  }, [activeTab, fetchArchive]);

  useEffect(() => {
    const handleFocus = () => { 
      if (document.visibilityState === 'visible' && profile?.id && !isFetching.current) {
        fetchData(true); 
      }
    };
    window.addEventListener('visibilitychange', handleFocus);
    return () => window.removeEventListener('visibilitychange', handleFocus);
  }, [fetchData, profile?.id]);

  const availableExecutors = useMemo(() => {
    if (!profile) return [];
    if (isAdmin || isDirector) return staff;
    if (isManager) return staff.filter(s => ['specialist', 'manager', 'director'].includes(s.role));
    if (isSpecialist) return staff.filter(s => s.id === profile.id || s.role === 'manager');
    return [];
  }, [staff, profile, isAdmin, isDirector, isManager, isSpecialist]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.object_id) return;
    if (createForm.deadline && new Date(createForm.deadline) < new Date(createForm.start_date)) {
      alert("Ошибка: Дата дедлайна не может быть раньше даты начала."); return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.rpc('create_task_safe', {
        p_object_id: createForm.object_id, p_title: createForm.title, p_assigned_to: createForm.assigned_to, p_start_date: createForm.start_date, p_deadline: createForm.deadline || null, p_comment: createForm.comment, p_doc_link: createForm.doc_link || null, p_doc_name: createForm.doc_name || null, p_user_id: profile.id
      });
      if (!error) {
        setIsCreateModalOpen(false);
        setCreateForm({ object_id: '', title: '', assigned_to: '', start_date: new Date().toISOString().split('T')[0], deadline: '', comment: '', doc_link: '', doc_name: '' });
        await fetchData();
      } else alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (filterMode === 'mine') list = list.filter(t => t.assigned_to === profile.id);
    else if (filterMode === 'created') list = list.filter(t => t.created_by === profile.id);
    return list;
  }, [tasks, filterMode, profile?.id]);

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f]">Задачи</h2>
          <p className="text-slate-500 text-sm mt-1">Планирование и контроль выполнения</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="bg-white p-1 rounded-full border border-slate-200 flex">
              <button onClick={() => setFilterMode('all')} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all ${filterMode === 'all' ? 'bg-[#d3e4ff] text-[#001d3d]' : 'text-slate-400'}`}>Все</button>
              <button onClick={() => setFilterMode('mine')} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all ${filterMode === 'mine' ? 'bg-[#d3e4ff] text-[#001d3d]' : 'text-slate-400'}`}>Мои</button>
              <button onClick={() => setFilterMode('created')} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all ${filterMode === 'created' ? 'bg-[#d3e4ff] text-[#001d3d]' : 'text-slate-400'}`}>Поставленные</button>
           </div>
           <Button onClick={() => setIsCreateModalOpen(true)} icon="add_task">Поставить задачу</Button>
        </div>
      </div>

      <div className="flex gap-2 mb-8 bg-slate-100 p-1 rounded-full w-fit">
        {(['active', 'today', 'week', 'archive'] as TaskTab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2 rounded-full text-xs font-bold uppercase transition-all ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {tab === 'active' ? 'Активные' : tab === 'today' ? 'Сегодня' : tab === 'week' ? 'Неделя' : 'Архив'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Загрузка данных...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
           {filteredTasks.length === 0 ? (
             <div className="py-32 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
               <span className="material-icons-round text-5xl text-slate-200 mb-4">assignment_turned_in</span>
               <p className="text-slate-400 font-medium italic">Задачи не найдены</p>
             </div>
           ) : (
             filteredTasks.map(task => (
               <div key={task.id} onClick={() => { setSelectedTask(task); setIsTaskDetailsModalOpen(true); }} className="bg-white p-6 rounded-[28px] border border-[#e1e2e1] hover:border-[#005ac1] hover:shadow-lg transition-all cursor-pointer group flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <span className="material-icons-round text-2xl">pending_actions</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 group-hover:text-[#005ac1] transition-colors">{task.title}</h4>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <span className="font-bold uppercase tracking-tight">{task.objects?.name}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span>{task.executor?.full_name}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-16 md:ml-0">
                    {task.deadline && (
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Срок</p>
                        <p className={`text-xs font-bold ${new Date(task.deadline) < new Date() ? 'text-red-500' : 'text-slate-700'}`}>
                          {new Date(task.deadline).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    <span className="material-icons-round text-[#c4c7c5] group-hover:text-[#005ac1] group-hover:translate-x-1 transition-all">chevron_right</span>
                  </div>
               </div>
             ))
           )}
        </div>
      )}

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Новая задача">
        <form onSubmit={handleCreateTask} className="space-y-4">
          <Input label="Что нужно сделать?" required value={createForm.title} onChange={(e:any) => setCreateForm({...createForm, title: e.target.value})} />
          <Select label="Объект" required value={createForm.object_id} onChange={(e:any) => setCreateForm({...createForm, object_id: e.target.value})} options={[{value: '', label: 'Выберите объект'}, ...objects.map(o => ({value: o.id, label: o.name}))]} />
          <Select label="Исполнитель" required value={createForm.assigned_to} onChange={(e:any) => setCreateForm({...createForm, assigned_to: e.target.value})} options={[{value: '', label: 'Выбрать исполнителя'}, ...availableExecutors.map(s => ({value: s.id, label: s.full_name}))]} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Начало" type="date" required value={createForm.start_date} onChange={(e:any) => setCreateForm({...createForm, start_date: e.target.value})} />
            <Input label="Дедлайн" type="date" value={createForm.deadline} onChange={(e:any) => setCreateForm({...createForm, deadline: e.target.value})} />
          </div>
          <textarea className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:border-blue-500" rows={3} placeholder="Описание / детали..." value={createForm.comment} onChange={(e) => setCreateForm({...createForm, comment: e.target.value})} />
          <Button type="submit" className="w-full h-14" loading={loading}>Создать задачу</Button>
        </form>
      </Modal>

      <Modal isOpen={isTaskDetailsModalOpen} onClose={() => setIsTaskDetailsModalOpen(false)} title="Детали задачи">
        {selectedTask && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold">{selectedTask.title}</h3>
            <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-100">
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase">Объект</p>
                 <p className="text-sm font-medium">{selectedTask.objects?.name}</p>
               </div>
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase">Срок</p>
                 <p className="text-sm font-medium">{selectedTask.deadline ? new Date(selectedTask.deadline).toLocaleDateString() : 'Бессрочно'}</p>
               </div>
            </div>
            {selectedTask.comment && (
              <div className="bg-slate-50 p-4 rounded-2xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Описание</p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap italic">{selectedTask.comment}</p>
              </div>
            )}
            <Button variant="tonal" onClick={() => setIsTaskDetailsModalOpen(false)} className="w-full">Закрыть</Button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Tasks;
