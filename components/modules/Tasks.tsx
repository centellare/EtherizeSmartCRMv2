
import React, { useState, useEffect, useMemo } from 'react';
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
  
  // Task Details & Create State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const [createForm, setCreateForm] = useState({
    object_id: '',
    title: '',
    assigned_to: '',
    start_date: new Date().toISOString().split('T')[0],
    deadline: '',
    comment: '',
    doc_link: '',
    doc_name: ''
  });

  // Filters for Archive/Closed
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [employeeFilter, setEmployeeFilter] = useState('all');

  const isAdmin = profile?.role === 'admin' || profile?.role === 'director';
  const isDirector = profile?.role === 'director';
  const isManager = profile?.role === 'manager';
  const isSpecialist = profile?.role === 'specialist';

  // Fetch initial data (Active tasks + Meta)
  const fetchData = async () => {
    setLoading(true);
    const { data: activeTasks } = await measureQuery(
      supabase.from('tasks')
        .select('*, executor:profiles!assigned_to(id, full_name, role), objects(id, name, responsible_id), creator:profiles!created_by(full_name)')
        .is('is_deleted', false)
        .eq('status', 'pending')
        .order('deadline', { ascending: true })
    );

    const { data: staffData } = await supabase.from('profiles').select('id, full_name, role').is('deleted_at', null);
    const { data: objectsData } = await supabase.from('objects').select('id, name, current_stage').is('is_deleted', false);

    setTasks(activeTasks || []);
    setStaff(staffData || []);
    setObjects(objectsData || []);
    setLoading(false);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.object_id) return;
    
    if (new Date(createForm.deadline) < new Date(createForm.start_date)) {
      alert("Ошибка: Дата дедлайна не может быть раньше даты начала.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.rpc('create_task_safe', {
      p_object_id: createForm.object_id,
      p_title: createForm.title,
      p_assigned_to: createForm.assigned_to,
      p_start_date: createForm.start_date,
      p_deadline: createForm.deadline,
      p_comment: createForm.comment,
      p_doc_link: createForm.doc_link || null,
      p_doc_name: createForm.doc_name || null,
      p_user_id: profile.id
    });

    if (!error) {
      setIsCreateModalOpen(false);
      setCreateForm({
        object_id: '',
        title: '',
        assigned_to: '',
        start_date: new Date().toISOString().split('T')[0],
        deadline: '',
        comment: '',
        doc_link: '',
        doc_name: ''
      });
      await fetchData();
    } else {
      alert(error.message);
    }
    setLoading(false);
  };

  const fetchArchive = async () => {
    setLoading(true);
    let query = supabase.from('tasks')
      .select('*, executor:profiles!assigned_to(id, full_name, role), objects(id, name), creator:profiles!created_by(full_name)')
      .is('is_deleted', false)
      .eq('status', 'completed')
      .gte('completed_at', dateRange.start + 'T00:00:00')
      .lte('completed_at', dateRange.end + 'T23:59:59');

    if (employeeFilter !== 'all') {
      query = query.eq('assigned_to', employeeFilter);
    }

    const { data: archived } = await measureQuery(query.order('completed_at', { ascending: false }));
    setArchiveTasks(archived || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile?.id]);
  useEffect(() => { 
    if (activeTab === 'archive' || activeTab === 'closed') {
      fetchArchive();
    }
  }, [activeTab, dateRange, employeeFilter]);

  const filteredTasks = useMemo(() => {
    let list = tasks;

    if (filterMode === 'mine') {
      list = list.filter(t => t.assigned_to === profile.id);
    } else if (filterMode === 'created') {
      list = list.filter(t => t.created_by === profile.id);
    } else if (filterMode === 'responsible' && isManager) {
      list = list.filter(t => t.objects?.responsible_id === profile.id);
    } else if (isSpecialist || isManager) {
      list = list.filter(t => 
        t.assigned_to === profile.id || 
        t.created_by === profile.id || 
        (isManager && t.objects?.responsible_id === profile.id)
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const now = new Date();
    const dayOfWeek = now.getDay() || 7;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek + 1);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    if (activeTab === 'today') {
      list = list.filter(t => {
        if (!t.deadline) return false;
        const d = new Date(t.deadline);
        return d >= today && d <= tomorrow;
      });
    } else if (activeTab === 'week') {
      list = list.filter(t => {
        if (!t.deadline) return false;
        const d = new Date(t.deadline);
        return d >= weekStart && d <= weekEnd;
      });
    } else if (activeTab === 'month') {
      list = list.filter(t => {
        if (!t.deadline) return false;
        const d = new Date(t.deadline);
        return d >= monthStart && d <= monthEnd;
      });
    } else if (activeTab === 'overdue') {
      list = list.filter(t => t.deadline && new Date(t.deadline) < today);
    } else if (activeTab === 'deadlines') {
      list = [...list].sort((a, b) => new Date(a.deadline || 0).getTime() - new Date(b.deadline || 0).getTime());
    }

    return list;
  }, [tasks, filterMode, activeTab, profile?.id]);

  const groupedByEmployee = useMemo(() => {
    if (activeTab !== 'employees' && activeTab !== 'overdue') return [];
    const groups: { [key: string]: { name: string, role: string, tasks: any[] } } = {};
    
    filteredTasks.forEach(t => {
      const eid = t.assigned_to;
      if (!groups[eid]) {
        groups[eid] = { 
          name: t.executor?.full_name || 'Не назначен', 
          role: t.executor?.role || '', 
          tasks: [] 
        };
      }
      groups[eid].tasks.push(t);
    });
    
    return Object.entries(groups).sort((a, b) => b[1].tasks.length - a[1].tasks.length);
  }, [filteredTasks, activeTab]);

  const renderTaskList = (list: any[]) => (
    <div className="space-y-3">
      {list.map(task => {
        const isOverdue = task.status === 'pending' && task.deadline && new Date(task.deadline) < new Date(new Date().setHours(0,0,0,0));
        const hasFiles = !!task.doc_link || !!task.completion_doc_link;
        return (
          <div 
            key={task.id} 
            onClick={() => { setSelectedTask(task); setIsDetailsModalOpen(true); }}
            className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group flex items-center justify-between"
          >
            <div className="flex items-center gap-4 min-w-0 flex-grow">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${task.status === 'completed' ? 'bg-emerald-50 text-emerald-500' : isOverdue ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                <span className="material-icons-round text-xl">{task.status === 'completed' ? 'verified' : isOverdue ? 'priority_high' : 'pending'}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-900 group-hover:text-blue-600 truncate">{task.title}</p>
                  {hasFiles && <span className="material-icons-round text-slate-300 text-sm">attach_file</span>}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                  <Badge color="slate">{task.objects?.name || 'Без объекта'}</Badge>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Исполнитель: {task.executor?.full_name}</span>
                  <span className="text-[10px] font-bold text-slate-300 uppercase">Создана: {new Date(task.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0 pl-4">
               <div className="text-right">
                 <p className={`text-xs font-bold ${isOverdue ? 'text-red-500' : 'text-slate-600'}`}>
                   {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'Без срока'}
                 </p>
                 <p className="text-[9px] text-slate-400 uppercase font-bold">Дедлайн</p>
               </div>
               <button 
                onClick={(e) => { e.stopPropagation(); onNavigateToObject(task.object_id, task.stage_id); }}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-blue-50 text-slate-300 group-hover:text-blue-600 transition-all"
                title="Перейти к объекту"
               >
                 <span className="material-icons-round">chevron_right</span>
               </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      {/* Header & Switching */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f]">Задачи</h2>
          <p className="text-slate-500 text-sm mt-1">
            {isDirector ? 'Операционное управление всей командой' : 'Планирование и контроль выполнения'}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
          {/* Logic Switcher */}
          <div className="flex p-1 bg-slate-100 rounded-2xl w-full sm:w-auto">
             <button 
               onClick={() => setFilterMode('all')}
               className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${filterMode === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               {isAdmin ? 'Все задачи' : 'Все доступные'}
             </button>
             <button 
               onClick={() => setFilterMode('mine')}
               className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${filterMode === 'mine' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               Мои
             </button>
             <button 
               onClick={() => setFilterMode('created')}
               className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${filterMode === 'created' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               Поставленные
             </button>
             {isManager && (
                <button 
                  onClick={() => setFilterMode('responsible')}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${filterMode === 'responsible' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Мои объекты
                </button>
             )}
          </div>
          {isAdmin && (
            <Button variant="primary" icon="add_task" className="h-12 rounded-2xl" onClick={() => setIsCreateModalOpen(true)}>Поставить задачу</Button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
        {(isSpecialist || isManager) && (
          <>
            <TabBtn active={activeTab === 'today'} onClick={() => setActiveTab('today')} label="На сегодня" icon="today" />
            <TabBtn active={activeTab === 'week'} onClick={() => setActiveTab('week')} label="На неделю" icon="date_range" />
            <TabBtn active={activeTab === 'month'} onClick={() => setActiveTab('month')} label="На месяц" icon="calendar_month" />
            <TabBtn active={activeTab === 'active'} onClick={() => setActiveTab('active')} label="Активные" icon="pending_actions" />
            <TabBtn active={activeTab === 'archive'} onClick={() => setActiveTab('archive')} label="Архив" icon="history" />
          </>
        )}
        {(isAdmin || isDirector) && (
          <>
            <TabBtn active={activeTab === 'active'} onClick={() => setActiveTab('active')} label="Активные" icon="account_tree" />
            <TabBtn active={activeTab === 'today'} onClick={() => setActiveTab('today')} label="Сегодня+" icon="bolt" />
            <TabBtn active={activeTab === 'week'} onClick={() => setActiveTab('week')} label="Неделя" icon="event" />
            <TabBtn active={activeTab === 'deadlines'} onClick={() => setActiveTab('deadlines')} label="Дедлайны" icon="timer" />
            <TabBtn active={activeTab === 'employees'} onClick={() => setActiveTab('employees')} label="По сотрудникам" icon="groups" />
            <TabBtn active={activeTab === 'closed'} onClick={() => setActiveTab('closed')} label="Закрытые" icon="task_alt" />
            <TabBtn active={activeTab === 'overdue'} onClick={() => setActiveTab('overdue')} label="Просрочено" icon="warning" count={tasks.filter(t => t.deadline && new Date(t.deadline) < new Date(new Date().setHours(0,0,0,0))).length} />
          </>
        )}
      </div>

      {/* Content Area */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
             <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
             <p className="text-slate-400 font-medium">Загрузка данных...</p>
          </div>
        ) : (
          <>
            {(activeTab === 'archive' || activeTab === 'closed') && (
              <div className="flex flex-wrap items-center gap-4 mb-6 bg-white p-4 rounded-[28px] border border-slate-200 shadow-sm">
                 <div className="flex items-center gap-2">
                   <Input type="date" label="От" value={dateRange.start} onChange={(e:any) => setDateRange({...dateRange, start: e.target.value})} className="h-10 !py-1 !text-xs" />
                   <Input type="date" label="До" value={dateRange.end} onChange={(e:any) => setDateRange({...dateRange, end: e.target.value})} className="h-10 !py-1 !text-xs" />
                 </div>
                 {isAdmin && (
                   <div className="min-w-[200px]">
                      <Select 
                        label="Сотрудник"
                        value={employeeFilter}
                        onChange={(e:any) => setEmployeeFilter(e.target.value)}
                        options={[{value: 'all', label: 'Все'}, ...staff.map(s => ({value: s.id, label: s.full_name}))]}
                        className="h-10 !py-1 !text-xs"
                      />
                   </div>
                 )}
                 <div className="ml-auto">
                    <Button variant="ghost" icon="download" className="text-xs">Экспорт отчета</Button>
                 </div>
              </div>
            )}

            {activeTab === 'employees' || activeTab === 'overdue' ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {groupedByEmployee.map(([id, data]) => (
                   <div key={id} className="bg-white rounded-[32px] border border-slate-200 overflow-hidden flex flex-col">
                      <div className="p-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{data.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{data.role}</p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${activeTab === 'overdue' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                          {data.tasks.length}
                        </div>
                      </div>
                      <div className="p-4 space-y-2 flex-grow max-h-[400px] overflow-y-auto scrollbar-hide">
                         {data.tasks.map(t => (
                           <div key={t.id} onClick={() => { setSelectedTask(t); setIsDetailsModalOpen(true); }} className="p-3 bg-slate-50/50 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 transition-all cursor-pointer group">
                             <p className="text-sm font-medium text-slate-800 line-clamp-1 group-hover:text-blue-600">{t.title}</p>
                             <div className="flex items-center justify-between mt-1">
                                <span className="text-[9px] text-slate-400 font-bold uppercase truncate max-w-[100px]">{t.objects?.name}</span>
                                <span className={`text-[9px] font-bold ${activeTab === 'overdue' ? 'text-red-500' : 'text-slate-500'}`}>
                                  {t.deadline ? new Date(t.deadline).toLocaleDateString() : '—'}
                                </span>
                             </div>
                           </div>
                         ))}
                      </div>
                   </div>
                 ))}
               </div>
            ) : (
              <>
                {activeTab === 'archive' || activeTab === 'closed' 
                  ? renderTaskList(archiveTasks) 
                  : renderTaskList(filteredTasks)
                }
                
                {((activeTab === 'archive' && archiveTasks.length === 0) || (activeTab !== 'archive' && filteredTasks.length === 0)) && (
                   <div className="flex flex-col items-center justify-center py-40 text-slate-300">
                      <span className="material-icons-round text-6xl mb-4 opacity-20">assignment_turned_in</span>
                      <p className="text-lg font-medium opacity-50">Задач не найдено</p>
                      <p className="text-sm opacity-30">Попробуйте сменить фильтры или период</p>
                   </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Модальное окно деталей задачи */}
      <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title="Карточка задачи">
        {selectedTask && (
          <div className="space-y-6">
            <h4 className="text-xl font-medium text-[#1c1b1f] leading-snug">{selectedTask.title}</h4>
            <div className="grid grid-cols-2 gap-4 py-5 border-y border-[#f2f3f5]">
               <div className="space-y-1">
                 <p className="text-[10px] uppercase font-bold text-slate-400">Поставил / Срок</p>
                 <p className="text-sm font-medium">{selectedTask.creator?.full_name || 'Система'} — {selectedTask.deadline ? new Date(selectedTask.deadline).toLocaleDateString() : '—'}</p>
                 <p className="text-[9px] text-slate-300 uppercase font-bold">Создана: {new Date(selectedTask.created_at).toLocaleDateString()}</p>
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
              </div>
            )}
            
            <div className="flex gap-2 pt-4">
              <Button variant="tonal" className="flex-1" onClick={() => setIsDetailsModalOpen(false)}>Закрыть</Button>
              <Button variant="primary" className="flex-1" icon="chevron_right" onClick={() => { setIsDetailsModalOpen(false); onNavigateToObject(selectedTask.object_id, selectedTask.stage_id); }}>Перейти к объекту</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Модальное окно создания задачи */}
      <Modal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        title="Постановка новой задачи"
      >
        <form onSubmit={handleCreateTask} className="space-y-5 px-1 pb-4">
          <Select 
            label="Выберите объект" 
            required 
            value={createForm.object_id} 
            onChange={(e:any) => setCreateForm({...createForm, object_id: e.target.value})} 
            options={[
              {value: '', label: 'Выберите объект из списка'},
              ...objects.map(obj => ({ value: obj.id, label: obj.name }))
            ]}
            icon="business"
          />
          <Input 
            label="Что нужно сделать?" 
            required 
            value={createForm.title} 
            onChange={(e:any) => setCreateForm({...createForm, title: e.target.value})} 
            icon="edit_note" 
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Дата старта" type="date" required value={createForm.start_date} onChange={(e:any) => setCreateForm({...createForm, start_date: e.target.value})} icon="calendar_today" />
            <Input label="Дедлайн" type="date" required value={createForm.deadline} onChange={(e:any) => setCreateForm({...createForm, deadline: e.target.value})} icon="event" />
          </div>
          <Select 
            label="Исполнитель" 
            required 
            value={createForm.assigned_to} 
            onChange={(e:any) => setCreateForm({...createForm, assigned_to: e.target.value})} 
            options={[
              {value:'', label:'Выберите сотрудника'}, 
              ...staff.map(s => ({value: s.id, label: s.full_name}))
            ]} 
            icon="person_search" 
          />
          
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
             <p className="text-[10px] font-bold text-slate-400 uppercase ml-1">Входящая документация (опц.)</p>
             <Input label="Название документа" value={createForm.doc_name} onChange={(e:any) => setCreateForm({...createForm, doc_name: e.target.value})} icon="description" />
             <Input label="URL-ссылка" value={createForm.doc_link} onChange={(e:any) => setCreateForm({...createForm, doc_link: e.target.value})} icon="link" />
          </div>

          <div className="w-full">
            <label className="block text-xs font-medium text-[#444746] mb-1.5 ml-1">Описание / ТЗ</label>
            <textarea 
              className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm outline-none focus:border-blue-500 shadow-inner" 
              rows={3} 
              value={createForm.comment} 
              onChange={(e) => setCreateForm({...createForm, comment: e.target.value})} 
            />
          </div>
          <Button type="submit" className="w-full h-14" icon="save" loading={loading} disabled={!createForm.object_id}>
            Создать и привязать к этапу
          </Button>
        </form>
      </Modal>
    </div>
  );
};

const TabBtn = ({ active, onClick, label, icon, count }: { active: boolean, onClick: () => void, label: string, icon: string, count?: number }) => (
  <button 
    onClick={onClick}
    className={`px-4 py-3 flex items-center gap-2 border-b-2 transition-all relative ${active ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
  >
    <span className="material-icons-round text-[18px]">{icon}</span>
    <span className="text-sm font-medium whitespace-nowrap">{label}</span>
    {count !== undefined && count > 0 && (
      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full border-2 border-[#f7f9fc]">
        {count}
      </span>
    )}
  </button>
);

export default Tasks;
