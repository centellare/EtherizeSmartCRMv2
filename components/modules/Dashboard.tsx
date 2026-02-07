
import React, { useState, useEffect, useMemo } from 'react';
import { supabase, measureQuery } from '../../lib/supabase';
import { Badge, Button } from '../ui';
import { formatDate, getMinskISODate } from '../../lib/dateUtils';

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('ru-BY', { style: 'currency', currency: 'BYN', maximumFractionDigits: 0 }).format(val);

// --- VISUALIZATION COMPONENTS ---

// 1. Simple SVG Line Chart for Finances
const FinancialTrendChart: React.FC<{ transactions: any[] }> = ({ transactions }) => {
  const data = useMemo(() => {
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      return { 
        month: d.toLocaleString('ru', { month: 'short' }), 
        monthIdx: d.getMonth(), 
        year: d.getFullYear(),
        income: 0, 
        expense: 0 
      };
    });

    transactions.forEach(t => {
      const d = new Date(t.created_at);
      const item = last6Months.find(m => m.monthIdx === d.getMonth() && m.year === d.getFullYear());
      if (item) {
        if (t.type === 'income') item.income += (t.fact_amount || 0);
        if (t.type === 'expense' && t.status === 'approved') item.expense += t.amount;
      }
    });
    return last6Months;
  }, [transactions]);

  const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expense)), 1000);
  const height = 120;
  const width = 100; // percent

  const getPoints = (key: 'income' | 'expense') => 
    data.map((d, i) => `${(i / (data.length - 1)) * 100},${height - (d[key] / maxVal) * height}`).join(' ');

  return (
    <div 
      className="w-full h-[160px] relative mt-4 select-none cursor-pointer group"
      onClick={() => window.location.hash = 'finances'}
      title="Перейти в финансы"
    >
      <div className="absolute inset-0 flex items-end justify-between px-2 pb-6 opacity-20">
        {data.map((d, i) => <div key={i} className="h-full w-[1px] bg-slate-400 border-l border-dashed"></div>)}
      </div>
      <svg className="w-full h-[140px] overflow-visible" preserveAspectRatio="none" viewBox={`0 0 100 ${height}`}>
        {/* Income Line */}
        <polyline points={getPoints('income')} fill="none" stroke="#10b981" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <path d={`M0,${height} L${getPoints('income').replace(/ /g, ' L')} L100,${height} Z`} fill="url(#incomeGradient)" opacity="0.2" />
        
        {/* Expense Line */}
        <polyline points={getPoints('expense')} fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="4" vectorEffect="non-scaling-stroke" />
        
        <defs>
          <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-bold uppercase px-1">
        {data.map((d, i) => <span key={i}>{d.month}</span>)}
      </div>
      {/* Legend */}
      <div className="absolute top-0 right-0 flex gap-4 text-[10px] font-bold bg-white/80 p-1 rounded-lg backdrop-blur-sm group-hover:bg-white transition-colors">
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div>Доход</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div>Расход</div>
      </div>
    </div>
  );
};

// 2. CSS Grid Gantt Chart
const ProjectTimeline: React.FC<{ objects: any[] }> = ({ objects }) => {
  const timelineData = useMemo(() => {
    return objects
      .filter(o => o.current_status === 'in_work' || o.current_status === 'review_required')
      .map(o => {
        // Mock start dates for visualization if not present (in real app, use stages history)
        const start = new Date(o.updated_at); 
        start.setDate(start.getDate() - 14); // Mock: Started 2 weeks ago
        const end = new Date(start);
        end.setDate(end.getDate() + 30); // Mock: Ends in 2 weeks

        const today = new Date();
        const totalDuration = end.getTime() - start.getTime();
        const elapsed = today.getTime() - start.getTime();
        const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
        
        return { ...o, progress, daysLeft: Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) };
      })
      .sort((a,b) => a.daysLeft - b.daysLeft)
      .slice(0, 5); // Show top 5 urgent
  }, [objects]);

  if (timelineData.length === 0) return <div className="text-slate-400 text-sm italic p-4">Нет активных проектов для отображения таймлайна</div>;

  return (
    <div className="space-y-4 mt-2">
      {timelineData.map(obj => (
        <div 
          key={obj.id} 
          className="relative group cursor-pointer hover:bg-slate-50 p-2 rounded-xl transition-all active:scale-[0.99]"
          onClick={() => window.location.hash = `objects/${obj.id}`}
          title="Открыть карточку объекта"
        >
          <div className="flex justify-between text-xs mb-1">
            <span className="font-bold text-slate-700 truncate max-w-[150px] group-hover:text-blue-600 transition-colors">{obj.name}</span>
            <span className={`font-bold ${obj.daysLeft < 0 ? 'text-red-500' : obj.daysLeft < 7 ? 'text-amber-500' : 'text-slate-400'}`}>
              {obj.daysLeft < 0 ? `Просрочено на ${Math.abs(obj.daysLeft)} дн` : `${obj.daysLeft} дн. осталось`}
            </span>
          </div>
          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden relative">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${
                obj.daysLeft < 0 ? 'bg-red-500' : 
                obj.progress > 80 ? 'bg-emerald-500' : 'bg-blue-500'
              }`} 
              style={{ width: `${obj.progress}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{obj.current_stage}</p>
        </div>
      ))}
    </div>
  );
};

// 3. Workload Bar Chart
const TeamWorkloadChart: React.FC<{ staff: any[], tasks: any[] }> = ({ staff, tasks }) => {
  const workload = useMemo(() => {
    return staff.map(s => {
      const active = tasks.filter(t => t.assigned_to === s.id && t.status === 'pending').length;
      return { name: s.full_name.split(' ')[0], count: active, role: s.role };
    })
    .filter(s => s.role !== 'admin' && s.role !== 'director') // Only executors
    .sort((a,b) => b.count - a.count);
  }, [staff, tasks]);

  const maxTasks = Math.max(...workload.map(w => w.count), 5);

  return (
    <div 
      className="flex items-end gap-3 h-[140px] mt-4 pb-2 px-2 overflow-x-auto scrollbar-hide cursor-pointer"
      onClick={() => window.location.hash = 'team'}
      title="Перейти к команде"
    >
      {workload.map(w => (
        <div key={w.name} className="flex flex-col items-center gap-2 group min-w-[40px] flex-1">
          <span className="text-xs font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{w.count}</span>
          <div className="w-full bg-slate-100 rounded-t-lg relative overflow-hidden flex-grow flex items-end">
            <div 
              className="w-full bg-blue-500 rounded-t-lg transition-all duration-700 group-hover:bg-blue-600"
              style={{ height: `${(w.count / maxTasks) * 100}%`, minHeight: '4px' }}
            ></div>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter truncate w-full text-center">{w.name}</span>
        </div>
      ))}
    </div>
  );
};

// --- ROLE-SPECIFIC VIEWS ---

const SpecialistView: React.FC<{ tasks: any[], objects: any[], userId: string }> = ({ tasks, objects, userId }) => {
  const myTasks = tasks.filter(t => t.assigned_to === userId && t.status === 'pending');
  const todayStr = getMinskISODate();
  
  const priorities = {
    overdue: myTasks.filter(t => t.deadline && t.deadline < todayStr),
    today: myTasks.filter(t => t.deadline === todayStr),
    upcoming: myTasks.filter(t => !t.deadline || t.deadline > todayStr)
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Column 1: Focus Now */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-gradient-to-br from-[#005ac1] to-[#003d82] rounded-[32px] p-8 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/4"></div>
          <h3 className="text-2xl font-bold relative z-10 mb-2">Привет! Сегодня у тебя {priorities.today.length} задач.</h3>
          <p className="opacity-80 relative z-10 text-sm">
            {priorities.overdue.length > 0 ? `🔥 Обрати внимание: ${priorities.overdue.length} просроченных задач!` : 'Все идет по плану. Хорошего дня!'}
          </p>
          
          <div className="flex gap-4 mt-8 relative z-10">
             <div 
                className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex-1 cursor-pointer hover:bg-white/20 transition-colors"
                onClick={() => window.location.hash = 'tasks'}
             >
                <span className="block text-3xl font-bold">{priorities.today.length}</span>
                <span className="text-[10px] uppercase tracking-widest opacity-70">На сегодня</span>
             </div>
             <div 
                className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex-1 cursor-pointer hover:bg-white/20 transition-colors"
                onClick={() => window.location.hash = 'tasks'}
             >
                <span className="block text-3xl font-bold">{myTasks.length}</span>
                <span className="text-[10px] uppercase tracking-widest opacity-70">Всего в работе</span>
             </div>
          </div>
        </div>

        <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="material-icons-round text-blue-600">assignment</span>
          Задачи на сегодня
        </h4>
        
        <div className="space-y-3">
          {[...priorities.overdue, ...priorities.today].length === 0 ? (
             <div className="p-8 bg-white border border-dashed border-slate-200 rounded-3xl text-center text-slate-400">
               <span className="material-icons-round text-4xl mb-2">check_circle</span>
               <p>На сегодня задач нет</p>
             </div>
          ) : (
             [...priorities.overdue, ...priorities.today].map(task => (
                <div 
                  key={task.id} 
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center group hover:border-blue-300 transition-all cursor-pointer hover:shadow-md"
                  onClick={() => window.location.hash = task.object_id ? `objects/${task.object_id}` : 'tasks'}
                >
                   <div>
                      <p className={`text-xs font-bold uppercase mb-1 ${task.deadline < todayStr ? 'text-red-500' : 'text-blue-600'}`}>
                        {task.deadline < todayStr ? 'Просрочено' : 'Сегодня'}
                      </p>
                      <p className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{task.title}</p>
                      <p className="text-xs text-slate-500 mt-1">{task.objects?.name}</p>
                   </div>
                   <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <span className="material-icons-round text-lg">arrow_forward</span>
                   </div>
                </div>
             ))
          )}
        </div>
      </div>

      {/* Column 2: Upcoming & Stats */}
      <div className="space-y-6">
         <div className="bg-white p-6 rounded-[32px] border border-slate-200">
            <h4 className="font-bold text-slate-800 mb-4">Ближайшие дедлайны</h4>
            <div className="space-y-4">
               {priorities.upcoming.slice(0, 5).map(task => (
                 <div key={task.id} onClick={() => window.location.hash = 'tasks'} className="flex items-start gap-3 pb-3 border-b border-slate-50 last:border-0 last:pb-0 cursor-pointer hover:bg-slate-50 transition-colors rounded-lg p-1">
                    <div className="mt-1 w-2 h-2 rounded-full bg-slate-300 shrink-0"></div>
                    <div>
                       <p className="text-sm font-medium text-slate-700 line-clamp-2">{task.title}</p>
                       <p className="text-[10px] text-slate-400 font-bold mt-1">{task.deadline ? formatDate(task.deadline) : 'Без срока'}</p>
                    </div>
                 </div>
               ))}
               {priorities.upcoming.length === 0 && <p className="text-sm text-slate-400 italic">Задач на будущее нет</p>}
            </div>
         </div>
      </div>
    </div>
  );
};

const ManagerView: React.FC<{ tasks: any[], objects: any[], userId: string, staff: any[] }> = ({ tasks, objects, userId, staff }) => {
  const activeObjects = objects.filter(o => !['completed', 'frozen'].includes(o.current_status));
  const blockedObjects = activeObjects.filter(o => o.current_status === 'on_pause' || o.current_status === 'review_required');
  const myObjects = activeObjects.filter(o => o.responsible_id === userId);

  return (
    <div className="space-y-8">
      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <div 
            onClick={() => window.location.hash = 'objects'}
            className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-4 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all group"
         >
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors"><span className="material-icons-round">business_center</span></div>
            <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Всего проектов</p><p className="text-2xl font-bold">{activeObjects.length}</p></div>
         </div>
         
         <div 
            onClick={() => window.location.hash = 'objects'}
            className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-4 cursor-pointer hover:border-emerald-400 hover:shadow-md transition-all group"
         >
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors"><span className="material-icons-round">person</span></div>
            <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Мои проекты</p><p className="text-2xl font-bold">{myObjects.length}</p></div>
         </div>
         
         <div 
            onClick={() => window.location.hash = 'objects'}
            className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-4 cursor-pointer hover:border-amber-400 hover:shadow-md transition-all group"
         >
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors"><span className="material-icons-round">warning</span></div>
            <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Внимание</p><p className="text-2xl font-bold">{blockedObjects.length}</p></div>
         </div>
         
         <div 
            onClick={() => window.location.hash = 'tasks'}
            className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-4 cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group"
         >
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors"><span className="material-icons-round">assignment</span></div>
            <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Задач в работе</p><p className="text-2xl font-bold">{tasks.filter(t=>t.status==='pending').length}</p></div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Gantt Chart Area */}
         <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
               <h4 className="text-lg font-bold text-slate-900">Таймлайн проектов</h4>
               <Badge color="blue">Топ-5 срочных</Badge>
            </div>
            <ProjectTimeline objects={activeObjects} />
         </div>

         {/* Workload Area */}
         <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-2">
               <h4 className="text-lg font-bold text-slate-900">Загрузка команды</h4>
               <span className="text-xs text-slate-400">Активные задачи</span>
            </div>
            <TeamWorkloadChart staff={staff} tasks={tasks} />
         </div>
      </div>
    </div>
  );
};

const DirectorView: React.FC<{ tasks: any[], objects: any[], transactions: any[], staff: any[] }> = ({ tasks, objects, transactions, staff }) => {
  // Financial Summary
  const financials = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + (t.fact_amount || 0), 0);
    const expense = transactions.filter(t => t.type === 'expense' && t.status === 'approved').reduce((s, t) => s + t.amount, 0);
    return { income, expense, profit: income - expense };
  }, [transactions]);

  // Pipeline Data
  const stagesData = useMemo(() => {
    const counts: Record<string, number> = {};
    objects.forEach(o => {
      if (!counts[o.current_stage]) counts[o.current_stage] = 0;
      counts[o.current_stage]++;
    });
    return counts;
  }, [objects]);

  const PIPELINE_ORDER = ['negotiation', 'design', 'mounting', 'commissioning', 'support'];
  const PIPELINE_LABELS: Record<string, string> = { 'negotiation': 'Лиды', 'design': 'Проект', 'mounting': 'Стройка', 'commissioning': 'Запуск', 'support': 'Сервис' };

  return (
    <div className="space-y-8">
      {/* Financial Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start">
               <div>
                  <h4 className="text-2xl font-bold text-slate-900 mb-1">Финансовый пульс</h4>
                  <p className="text-sm text-slate-500">Динамика приходов и расходов за 6 месяцев</p>
               </div>
               <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Баланс (Cashflow)</p>
                  <p className={`text-3xl font-bold ${financials.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(financials.profit)}</p>
               </div>
            </div>
            <FinancialTrendChart transactions={transactions} />
         </div>

         {/* Quick KPIs */}
         <div className="flex flex-col gap-4">
            <div 
                className="flex-1 bg-emerald-50 rounded-[32px] p-6 border border-emerald-100 flex flex-col justify-center cursor-pointer hover:bg-emerald-100 transition-colors group"
                onClick={() => window.location.hash = 'finances'}
            >
               <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-emerald-600 shadow-sm group-hover:scale-110 transition-transform"><span className="material-icons-round">trending_up</span></div>
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest">Выручка (Факт)</span>
               </div>
               <p className="text-2xl font-bold text-emerald-900">{formatCurrency(financials.income)}</p>
            </div>
            <div 
                className="flex-1 bg-red-50 rounded-[32px] p-6 border border-red-100 flex flex-col justify-center cursor-pointer hover:bg-red-100 transition-colors group"
                onClick={() => window.location.hash = 'finances'}
            >
               <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-red-600 shadow-sm group-hover:scale-110 transition-transform"><span className="material-icons-round">trending_down</span></div>
                  <span className="text-xs font-bold text-red-800 uppercase tracking-widest">Расходы (Факт)</span>
               </div>
               <p className="text-2xl font-bold text-red-900">{formatCurrency(financials.expense)}</p>
            </div>
         </div>
      </div>

      {/* Visual Pipeline */}
      <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm overflow-x-auto">
         <h4 className="text-lg font-bold text-slate-900 mb-6">Воронка проектов</h4>
         <div className="flex items-center justify-between min-w-[600px] relative">
            {/* Connection Line */}
            <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -z-10 rounded-full"></div>
            
            {PIPELINE_ORDER.map((stage, idx) => {
               const count = stagesData[stage] || 0;
               return (
                  <div key={stage} className="flex flex-col items-center gap-3 bg-white px-2 cursor-pointer group" onClick={() => window.location.hash = 'objects'}>
                     <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold border-4 transition-all group-hover:scale-110 shadow-sm ${count > 0 ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                        {count}
                     </div>
                     <div className="text-center">
                        <p className="text-xs font-bold text-slate-700 uppercase group-hover:text-blue-600">{PIPELINE_LABELS[stage]}</p>
                     </div>
                  </div>
               );
            })}
         </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

const Dashboard: React.FC<{ profile: any }> = ({ profile }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ tasks: any[], objects: any[], transactions: any[], staff: any[] }>({
    tasks: [], objects: [], transactions: [], staff: []
  });
  
  const fetchData = async () => {
    if (!profile?.id) return;
    setLoading(true);

    try {
      const [tasksRes, objectsRes, transRes, staffRes] = await Promise.all([
        measureQuery(supabase.from('tasks').select('*, objects(name)').is('is_deleted', false)),
        measureQuery(supabase.from('objects').select('*').is('is_deleted', false)),
        measureQuery(supabase.from('transactions').select('*').is('deleted_at', null)),
        measureQuery(supabase.from('profiles').select('id, full_name, role').is('deleted_at', null))
      ]);

      setData({
        tasks: tasksRes.data || [],
        objects: objectsRes.data || [],
        transactions: transRes.data || [],
        staff: staffRes.data || []
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [profile?.id]);

  const role = profile?.role || 'specialist';
  const isAdmin = role === 'admin';
  const isDirector = role === 'director';
  const isManager = role === 'manager';

  return (
    <div className="animate-in fade-in duration-500 pb-10">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f]">
            {isAdmin || isDirector ? 'Обзор компании' : isManager ? 'Управление проектами' : 'Мой дашборд'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {loading ? 'Синхронизация данных...' : `Актуально на ${formatDate(new Date(), true)}`}
          </p>
        </div>
      </div>

      {loading && data.tasks.length === 0 ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {(isAdmin || isDirector) ? (
            <DirectorView tasks={data.tasks} objects={data.objects} transactions={data.transactions} staff={data.staff} />
          ) : isManager ? (
            <ManagerView tasks={data.tasks} objects={data.objects} userId={profile.id} staff={data.staff} />
          ) : (
            <SpecialistView tasks={data.tasks} objects={data.objects} userId={profile.id} />
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
