
import React, { useMemo } from 'react';
import { Badge, Button } from '../ui';
import { formatDate, getMinskISODate } from '../../lib/dateUtils';
import { TeamGantt } from './Dashboard/TeamGantt';
import { useTasks } from '../../hooks/useTasks';
import { useObjects } from '../../hooks/useObjects';
import { useTransactions } from '../../hooks/useTransactions';
import { useStaff } from '../../hooks/useStaff';

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('ru-BY', { style: 'currency', currency: 'BYN', maximumFractionDigits: 0 }).format(val);

// --- NEW WIDGETS ---

// 1. Cash Flow Forecast (Weekly)
const CashFlowForecast: React.FC<{ transactions: any[] }> = ({ transactions }) => {
  const data = useMemo(() => {
    const today = new Date();
    // Generate next 4 weeks buckets
    const weeks = Array.from({ length: 4 }, (_, i) => {
      const start = new Date(today);
      start.setDate(today.getDate() + (i * 7));
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { 
        label: `${formatDate(start).slice(0, 5)} - ${formatDate(end).slice(0, 5)}`,
        startStr: getMinskISODate(start),
        endStr: getMinskISODate(end),
        incomeFact: 0,
        incomePlan: 0,
        expenseFact: 0,
        expensePlan: 0
      };
    });

    transactions.forEach(t => {
      // 1. FACT (Actual Payments)
      let factAdded = false;
      if (t.payments && t.payments.length > 0) {
          t.payments.forEach((p: any) => {
              const pDate = p.payment_date ? p.payment_date.split('T')[0] : '';
              const targetWeek = weeks.find(w => pDate >= w.startStr && pDate <= w.endStr);
              if (targetWeek) {
                  if (t.type === 'income') targetWeek.incomeFact += (p.amount || 0);
                  else targetWeek.expenseFact += (p.amount || 0);
                  factAdded = true;
              }
          });
      } 
      
      // Fallback for legacy transactions without payments array but with fact_amount
      if (!factAdded && t.fact_amount > 0) {
           const rawDate = t.planned_date || t.created_at;
           const tDate = rawDate ? (rawDate.includes('T') ? rawDate.split('T')[0] : rawDate) : '';
           const targetWeek = weeks.find(w => tDate >= w.startStr && tDate <= w.endStr);
           if (targetWeek) {
               if (t.type === 'income') targetWeek.incomeFact += t.fact_amount;
               else targetWeek.expenseFact += t.fact_amount;
           }
      }

      // 2. PLAN (Expected/Remaining)
      if (t.status !== 'rejected') {
          const targetAmount = t.type === 'expense' 
              ? (t.status === 'approved' ? t.amount : (t.requested_amount || t.amount))
              : t.amount;
          
          // Calculate Fact Total for this transaction (to subtract from plan)
          const factTotal = t.fact_amount || 0;
          const remaining = Math.max(0, targetAmount - factTotal);

          if (remaining > 1) { // Filter out small dust
              const tDate = t.planned_date;
              if (tDate) {
                  const targetWeek = weeks.find(w => tDate >= w.startStr && tDate <= w.endStr);
                  if (targetWeek) {
                      if (t.type === 'income') targetWeek.incomePlan += remaining;
                      else targetWeek.expensePlan += remaining;
                  }
              }
          }
      }
    });

    return weeks;
  }, [transactions]);

  const maxVal = Math.max(
      ...data.map(d => Math.max(d.incomeFact + d.incomePlan, d.expenseFact + d.expensePlan)), 
      1000
  );

  return (
    <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-start mb-6">
        <div>
            <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="material-icons-round text-blue-600">query_stats</span>
                Прогноз потоков (Месяц)
            </h4>
            <p className="text-xs text-slate-500 mt-1">План/Факт по неделям</p>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px] font-bold uppercase">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-emerald-500"></div>Приход (Факт)</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-blue-400"></div>Приход (План)</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-rose-500"></div>Расход (Факт)</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-amber-400"></div>Расход (План)</div>
        </div>
      </div>

      <div className="flex-grow flex items-end justify-between gap-4 h-[180px] pb-2">
        {data.map((week, idx) => {
            const totalIncome = week.incomeFact + week.incomePlan;
            const totalExpense = week.expenseFact + week.expensePlan;
            const net = totalIncome - totalExpense;

            return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group cursor-pointer relative">
                    {/* Tooltip */}
                    <div className="absolute -top-16 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] p-2 rounded-lg whitespace-nowrap z-10 pointer-events-none">
                        <div className="font-bold mb-1">{week.label}</div>
                        <div>Приход: {formatCurrency(totalIncome)} (Ф: {formatCurrency(week.incomeFact)})</div>
                        <div>Расход: {formatCurrency(totalExpense)} (Ф: {formatCurrency(week.expenseFact)})</div>
                        <div className="mt-1 pt-1 border-t border-slate-600">Баланс: {formatCurrency(net)}</div>
                    </div>

                    <div className="w-full flex gap-1 items-end h-full justify-center">
                        {/* Income Bar (Stacked) */}
                        <div 
                            className="w-1/2 flex flex-col justify-end rounded-t-lg overflow-hidden relative min-h-[4px] bg-slate-100"
                            style={{ height: `${(totalIncome / maxVal) * 100}%` }}
                        >
                            {/* Plan (Top) */}
                            <div className="w-full bg-blue-400 transition-all hover:bg-blue-500" style={{ height: `${(week.incomePlan / totalIncome) * 100}%` }}></div>
                            {/* Fact (Bottom) */}
                            <div className="w-full bg-emerald-500 transition-all hover:bg-emerald-600" style={{ height: `${(week.incomeFact / totalIncome) * 100}%` }}></div>
                            
                            {totalIncome > 0 && <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-slate-600">{formatCurrency(totalIncome)}</span>}
                        </div>

                        {/* Expense Bar (Stacked) */}
                        <div 
                            className="w-1/2 flex flex-col justify-end rounded-t-lg overflow-hidden relative min-h-[4px] bg-slate-100"
                            style={{ height: `${(totalExpense / maxVal) * 100}%` }}
                        >
                            {/* Plan (Top) */}
                            <div className="w-full bg-amber-400 transition-all hover:bg-amber-500" style={{ height: `${(week.expensePlan / totalExpense) * 100}%` }}></div>
                            {/* Fact (Bottom) */}
                            <div className="w-full bg-rose-500 transition-all hover:bg-rose-600" style={{ height: `${(week.expenseFact / totalExpense) * 100}%` }}></div>
                            
                            {totalExpense > 0 && <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-slate-600">{formatCurrency(totalExpense)}</span>}
                        </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{week.label}</span>
                </div>
            );
        })}
      </div>
    </div>
  );
};

// 2. Critical Projects (Top Risks)
const CriticalProjects: React.FC<{ objects: any[], tasks: any[] }> = ({ objects, tasks }) => {
    const risks = useMemo(() => {
        return objects
            .filter(o => o.current_status !== 'completed' && o.current_status !== 'frozen')
            .map(o => {
                const overdueTasks = tasks.filter(t => t.object_id === o.id && t.status !== 'completed' && t.deadline && t.deadline < getMinskISODate()).length;
                const isStuck = o.current_status === 'on_pause' || o.current_status === 'review_required';
                
                let score = 0;
                if (o.current_status === 'review_required') score += 10;
                if (o.current_status === 'on_pause') score += 5;
                score += overdueTasks * 2;

                return { ...o, score, overdueTasks };
            })
            .filter(o => o.score > 0)
            .sort((a,b) => b.score - a.score)
            .slice(0, 5);
    }, [objects, tasks]);

    return (
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm h-full">
            <h4 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="material-icons-round text-amber-500">warning</span>
                Требуют внимания
            </h4>
            <div className="space-y-3">
                {risks.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">Все проекты идут по плану</p>
                ) : (
                    risks.map(o => (
                        <div key={o.id} onClick={() => window.location.hash = `objects/${o.id}`} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-amber-300 cursor-pointer transition-colors group">
                            <div className="min-w-0 pr-2">
                                <p className="text-sm font-bold text-slate-800 truncate group-hover:text-blue-600">{o.name}</p>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{o.current_stage}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                {o.current_status === 'review_required' && <Badge color="red">ПРОВЕРКА</Badge>}
                                {o.current_status === 'on_pause' && <Badge color="amber">ПАУЗА</Badge>}
                                {o.overdueTasks > 0 && (
                                    <span className="text-[10px] font-bold text-red-500 flex items-center">
                                        <span className="material-icons-round text-[12px] mr-1">alarm_off</span>
                                        {o.overdueTasks} задач
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

// 3. Sales Funnel Value
const PipelineValue: React.FC<{ objects: any[], proposals: any[] }> = ({ objects, proposals }) => {
    // We assume proposals (CPs) are linked to objects via client or object logic. 
    // Simplified: Just showing active objects count per stage for now, but imagining value.
    // In a real scenario, you'd join `commercial_proposals` to `objects` to get BYN value.
    
    const funnel = useMemo(() => {
        const stages = [
            { id: 'negotiation', label: 'Переговоры' },
            { id: 'design', label: 'Проектирование' },
            { id: 'mounting', label: 'Монтаж' }
        ];
        
        return stages.map(s => {
            const count = objects.filter(o => o.current_stage === s.id && o.current_status !== 'frozen').length;
            // Mock value logic: Assuming average project is 20k BYN for viz purposes, or sum actual CPs if available
            // Let's create a visual bar
            return { ...s, count };
        });
    }, [objects]);

    return (
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm h-full flex flex-col justify-between">
             <h4 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                <span className="material-icons-round text-emerald-600">filter_alt</span>
                Воронка (Активные)
            </h4>
            <div className="space-y-4">
                {funnel.map((step, idx) => (
                    <div key={step.id} className="relative">
                        <div className="flex justify-between text-xs font-bold mb-1 z-10 relative">
                            <span className="text-slate-600 uppercase">{step.label}</span>
                            <span className="text-slate-900">{step.count} пр.</span>
                        </div>
                        <div className="h-8 bg-slate-100 rounded-lg overflow-hidden relative">
                            <div 
                                className={`h-full opacity-80 ${idx === 0 ? 'bg-blue-300' : idx === 1 ? 'bg-indigo-400' : 'bg-violet-500'}`} 
                                style={{ width: `${Math.min(100, step.count * 15)}%`, minWidth: step.count > 0 ? '4px' : '0' }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
            <Button variant="ghost" onClick={() => window.location.hash = 'proposals'} className="w-full mt-4 text-xs">Перейти к КП</Button>
        </div>
    );
};

// --- DIRECTOR VIEW (Aggregated) ---

const DirectorView: React.FC<{ tasks: any[], objects: any[], transactions: any[], staff: any[] }> = ({ tasks, objects, transactions, staff }) => {
  // Financial Summary (Top Cards)
  const financials = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + (t.fact_amount || 0), 0);
    const expense = transactions.filter(t => t.type === 'expense' && t.status === 'approved').reduce((s, t) => s + t.amount, 0);
    const pendingIncome = transactions.filter(t => t.type === 'income' && t.status !== 'approved').reduce((s, t) => s + (t.amount - (t.fact_amount || 0)), 0);
    return { income, expense, profit: income - expense, pendingIncome };
  }, [transactions]);

  return (
    <div className="space-y-6">
      {/* 1. High-Level KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <div className="bg-slate-900 text-white p-6 rounded-[28px] relative overflow-hidden group">
            <div className="relative z-10">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Чистая прибыль (Факт)</p>
                <p className="text-3xl font-bold">{formatCurrency(financials.profit)}</p>
                <div className="mt-4 flex items-center gap-2 text-xs opacity-80">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    +{formatCurrency(financials.income)}
                    <span className="w-2 h-2 rounded-full bg-rose-400 ml-2"></span>
                    -{formatCurrency(financials.expense)}
                </div>
            </div>
            <span className="material-icons-round absolute top-4 right-4 text-6xl opacity-10 group-hover:scale-110 transition-transform">account_balance</span>
         </div>

         <div className="bg-white border border-slate-200 p-6 rounded-[28px] relative overflow-hidden group hover:border-blue-300 transition-colors">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ожидаем поступлений</p>
            <p className="text-3xl font-bold text-blue-600">{formatCurrency(financials.pendingIncome)}</p>
            <p className="text-xs text-slate-500 mt-2">По выставленным счетам</p>
            <span className="material-icons-round absolute top-4 right-4 text-6xl text-blue-100 opacity-50 group-hover:text-blue-200 transition-colors">pending</span>
         </div>

         <div className="bg-white border border-slate-200 p-6 rounded-[28px] relative overflow-hidden group hover:border-amber-300 transition-colors cursor-pointer" onClick={() => window.location.hash = 'objects'}>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Активных проектов</p>
            <p className="text-3xl font-bold text-slate-800">{objects.filter(o => o.current_status === 'in_work').length}</p>
            <p className="text-xs text-amber-600 mt-2 font-bold">{objects.filter(o => o.current_status === 'review_required').length} требуют проверки</p>
            <span className="material-icons-round absolute top-4 right-4 text-6xl text-slate-100 group-hover:text-amber-100 transition-colors">business</span>
         </div>

         <div className="bg-white border border-slate-200 p-6 rounded-[28px] relative overflow-hidden group hover:border-emerald-300 transition-colors cursor-pointer" onClick={() => window.location.hash = 'team'}>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Сотрудники</p>
            <p className="text-3xl font-bold text-slate-800">{staff.length}</p>
            <p className="text-xs text-slate-500 mt-2">Загрузка команды</p>
            <span className="material-icons-round absolute top-4 right-4 text-6xl text-slate-100 group-hover:text-emerald-100 transition-colors">groups</span>
         </div>
      </div>

      {/* 2. Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-[400px]">
         <div className="lg:col-span-2 h-full">
            <CashFlowForecast transactions={transactions} />
         </div>
         <div className="h-full">
            <CriticalProjects objects={objects} tasks={tasks} />
         </div>
      </div>

      {/* 3. Team Workload Gantt (NEW) */}
      <div className="w-full">
         <TeamGantt staff={staff} tasks={tasks} />
      </div>

      {/* 4. Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <div>
            <PipelineValue objects={objects} proposals={[]} />
         </div>
         {/* Removed redundant efficiency table since we have Gantt now */}
         <div className="lg:col-span-2 bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-center opacity-50">
            <p className="text-sm text-slate-400">Здесь можно добавить виджет "Последние события" или "Логи"</p>
         </div>
      </div>
    </div>
  );
};

// --- REST OF THE FILE REMAINS (SpecialistView, ManagerView, Dashboard Main Component) ---

const SpecialistView: React.FC<{ tasks: any[], objects: any[], userId: string }> = ({ tasks, objects, userId }) => {
  const myTasks = tasks.filter(t => t.assigned_to === userId && t.status !== 'completed');
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

// 2. CSS Grid Gantt Chart (Reused for Manager)
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

  if (timelineData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 opacity-30 italic text-center">
        <span className="material-icons-round text-4xl mb-2">work_outline</span>
        <p className="text-xs font-bold uppercase">Активных проектов нет</p>
      </div>
    );
  }

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

const ManagerView: React.FC<{ tasks: any[], objects: any[], userId: string, staff: any[] }> = ({ tasks, objects, userId, staff }) => {
  const activeObjects = objects.filter(o => !['completed', 'frozen'].includes(o.current_status));
  const blockedObjects = activeObjects.filter(o => o.current_status === 'on_pause' || o.current_status === 'review_required');
  const myObjects = activeObjects.filter(o => o.responsible_id === userId);

  // Filter staff: Me + Specialists
  const ganttStaff = useMemo(() => {
      return staff.filter(s => s.id === userId || s.role === 'specialist');
  }, [staff, userId]);

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
            <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Задач в работе</p><p className="text-2xl font-bold">{tasks.filter(t=>t.status !== 'completed').length}</p></div>
         </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
         {/* Top 5 Projects Timeline */}
         <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
               <h4 className="text-lg font-bold text-slate-900">Таймлайн проектов</h4>
               <Badge color="blue">Топ-5 срочных</Badge>
            </div>
            <ProjectTimeline objects={activeObjects} />
         </div>

         {/* Workload Gantt - Replaced Chart */}
         <div className="w-full">
            <TeamGantt staff={ganttStaff} tasks={tasks} />
         </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

const Dashboard: React.FC<{ profile: any }> = ({ profile }) => {
  const role = profile?.role || 'specialist';
  const isAdmin = role === 'admin';
  const isDirector = role === 'director';
  const isManager = role === 'manager';

  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const { data: objects = [], isLoading: objectsLoading } = useObjects();
  const { data: transactions = [], isLoading: transLoading } = useTransactions();
  const { data: staff = [], isLoading: staffLoading } = useStaff();

  const loading = tasksLoading || objectsLoading || transLoading || staffLoading;

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

      {loading && tasks.length === 0 ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {(isAdmin || isDirector) ? (
            <DirectorView tasks={tasks} objects={objects} transactions={transactions} staff={staff} />
          ) : isManager ? (
            <ManagerView tasks={tasks} objects={objects} userId={profile.id} staff={staff} />
          ) : (
            <SpecialistView tasks={tasks} objects={objects} userId={profile.id} />
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
