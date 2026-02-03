
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase, measureQuery } from '../../lib/supabase';
import { Button, Input, Select, Badge, Modal } from '../ui';
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
  
  // Archive States
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
  const [isTaskDetailsModalOpen, setIsTaskDetailsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const isFetching = useRef(false);

  const [createForm, setCreateForm] = useState({
    object_id: '', title: '', assigned_to: '', start_date: getMinskISODate(), deadline: '', comment: '', doc_link: '', doc_name: ''
  });

  const isAdmin = profile?.role === 'admin' || profile?.role === 'director';

  const fetchData = useCallback(async (silent = false) => {
    if (!profile?.id || isFetching.current) return;
    
    isFetching.current = true;
    const isInitial = tasks.length === 0 && !silent;
    if (isInitial) setLoading(true);
    
    try {
      const [activeResult, staffResult, objectsResult] = await Promise.all([
        measureQuery(
          supabase.from('tasks')
            .select('*, checklist:task_checklists(*), executor:profiles!assigned_to(id, full_name, role), objects(id, name, responsible_id), creator:profiles!created_by(id, full_name)')
            .is('is_deleted', false)
            .eq('status', 'pending')
            .order('deadline', { ascending: true })
        ),
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
  }, [profile?.id, tasks.length]);

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
  }, [profile?.id, archiveDates, filterMode, archiveTasks.length]);

  useEffect(() => {
    if (activeTab === 'archive') {
      fetchArchive(0);
    } else {
      fetchData();
    }
  }, [activeTab, fetchData, fetchArchive]);

  const overdueCount = useMemo(() => {
    const todayStr = getMinskISODate();
    return tasks.filter((t: Task) => t.deadline && t.deadline < todayStr).length;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (activeTab === 'archive') return archiveTasks;

    const todayStr = getMinskISODate();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = getMinskISODate(nextWeek);

    let list = tasks;

    if (filterMode === 'mine') {
      list = list.filter((t: Task) => t.assigned_to === profile.id);
    } else if (filterMode === 'created') {
      list = list.filter((t: Task) => t.created_by === profile.id);
    }

    switch (activeTab) {
      case 'today': return list.filter((t: Task) => t.deadline === todayStr);
      case 'week': return list.filter((t: Task) => t.deadline && t.deadline >= todayStr && t.deadline <= nextWeekStr);
      case 'overdue': return list.filter((t: Task) => t.deadline && t.deadline < todayStr);
      default: return list;
    }
  }, [tasks, archiveTasks, activeTab, filterMode, profile.id]);

  const teamWorkload = useMemo(() => {
    return staff.map(member => {
      const memberTasks = tasks.filter((t: Task) => t.assigned_to === member.id);
      return { ...member, tasks: memberTasks };
    }).filter(m => m.tasks.length > 0 || m.role === 'specialist' || m.role === 'manager');
  }, [staff, tasks]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.object_id) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('tasks').insert([{
        ...createForm,
        created_by: profile.id,
        status: 'pending'
      }]);
      if (!error) {
        setIsCreateModalOpen(false);
        setCreateForm({ object_id: '', title: '', assigned_to: '', start_date: getMinskISODate(), deadline: '', comment: '', doc_link: '', doc_name: '' });
        await fetchData(true);
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

    await supabase.from('task_checklists').update({ is_completed: !currentStatus }).eq('id', itemId);
  };

  const showBlockingLoader = loading && (
    (activeTab === 'archive' && archiveTasks.length === 0) || 
    (activeTab !== 'archive' && activeTab !== 'team' && tasks.length === 0) ||
    (activeTab === 'team' && staff.length === 0)
  );

  return (
    <div className="animate-in fade-in duration-500">
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
              <button onClick={() => setFilterMode('all')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${filterMode === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Все</button>
              <button onClick={() => setFilterMode('mine')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${filterMode === 'mine' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Мои</button>
              <button onClick={() => setFilterMode('created')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${filterMode === 'created' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Поставленные</button>
           </div>
           <Button onClick={() => setIsCreateModalOpen(true)} icon="add_circle" className="h-12 px-6">Поставить задачу</Button>
        </div>
      </div>

      <div className="flex items-center border-b border-slate-200 mb-8 overflow-x-auto scrollbar-hide">
        {[
          { id: 'active', label: 'Активные', icon: 'assignment' },
          { id: 'today', label: 'Сегодня', icon: 'today' },
          { id: 'week', label: 'Неделя', icon: 'date_range' },
          { id: 'overdue', label: 'Просрочено', icon: 'warning', badge: overdueCount },
          { id: 'team', label: 'Команда', icon: 'groups' },
          { id: 'archive', label: 'Архив', icon: 'history' }
        ].map(tab => (
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

      {activeTab === 'archive' && (
        <div className="flex flex-col md:flex-row gap-4 mb-6 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm animate-in slide-in-from-top-2 duration-300">
           <div className="flex-grow flex items-center gap-3">
              <span className="material-icons-round text-slate-400">event_note</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Фильтр архива за период:</span>
           </div>
           <div className="flex items-center gap-2">
              <Input type="date" value={archiveDates.start} onChange={(e:any) => setArchiveDates({...archiveDates, start: e.target.value})} className="h-10 !py-1 !text-xs !rounded-xl" />
              <span className="text-slate-300 font-bold text-[10px]">ПО</span>
              <Input type="date" value={archiveDates.end} onChange={(e:any) => setArchiveDates({...archiveDates, end: e.target.value})} className="h-10 !py-1 !text-xs !rounded-xl" />
              <Button variant="tonal" icon="refresh" onClick={() => fetchArchive(0)} className="h-10 w-10 !px-0 rounded-xl" />
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
            <div key={member.id} className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm flex flex-col">
              <div className="p-6 pb-4 flex justify-between items-start">
                <div>
                  <h4 className="text-base font-bold text-slate-900 leading-tight">{member.full_name}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{member.role}</p>
                </div>
                <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                  {member.tasks.length}
                </div>
              </div>
              <div className="px-4 pb-6 space-y-2 flex-grow">
                {member.tasks.map((task: Task) => {
                  const isOverdue = task.deadline && task.deadline < getMinskISODate();
                  return (
                    <div 
                      key={task.id} 
                      onClick={() => { setSelectedTask(task); setIsTaskDetailsModalOpen(true); }}
                      className="bg-[#f8f9fa] p-3 rounded-2xl border border-transparent hover:border-blue-200 transition-all cursor-pointer group"
                    >
                      <p className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors">{task.title}</p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{(task as any).objects?.name}</span>
                        <span className={`text-[10px] font-bold ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                          {task.deadline ? formatDate(task.deadline) : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
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

      {/* Модальные окна */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Новая задача">
        <form onSubmit={handleCreateTask} className="space-y-4">
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

          <textarea className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:border-blue-500" rows={3} placeholder="Описание / детали..." value={createForm.comment} onChange={(e) => setCreateForm({...createForm, comment: e.target.value})} />
          <Button type="submit" className="w-full h-14" loading={loading}>Создать задачу</Button>
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
               <Button variant="tonal" onClick={() => setIsTaskDetailsModalOpen(false)} className="flex-1">Закрыть</Button>
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
    </div>
  );
};

export default Tasks;
