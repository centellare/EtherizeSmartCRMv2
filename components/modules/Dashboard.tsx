import React, { useState, useEffect, useMemo } from 'react';
import { supabase, measureQuery } from '../../lib/supabase';
import { Badge, Input, Button } from '../ui';
import { formatDate, getMinskISODate } from '../../lib/dateUtils';

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('ru-BY', { style: 'currency', currency: 'BYN', maximumFractionDigits: 0 }).format(val);

// --- Sub-components for specific roles ---

// 1. SPECIALIST VIEW: Focus on personal Tasks & Deadlines
const SpecialistView: React.FC<{ tasks: any[], objects: any[], userId: string }> = ({ tasks, objects, userId }) => {
  const myTasks = tasks.filter(t => t.assigned_to === userId && t.status === 'pending');
  const todayStr = getMinskISODate();

  const groupedTasks = useMemo(() => {
    const groups: Record<string, any[]> = {};
    myTasks.forEach(t => {
      const objName = t.objects?.name || 'Без объекта';
      if (!groups[objName]) groups[objName] = [];
      groups[objName].push(t);
    });
    return groups;
  }, [myTasks]);

  const stats = {
    total: myTasks.length,
    overdue: myTasks.filter(t => t.deadline && t.deadline < todayStr).length,
    today: myTasks.filter(t => t.deadline === todayStr).length
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Мои задачи" val={stats.total} icon="assignment" color="blue" />
        <StatCard label="На сегодня" val={stats.today} icon="event" color="emerald" />
        <StatCard label="Просрочено" val={stats.overdue} icon="warning" color="red" />
      </div>

      <h3 className="text-lg font-bold text-slate-800 mt-6 mb-4">Задачи по объектам</h3>
      {Object.keys(groupedTasks).length === 0 ? (
        <div className="p-10 text-center bg-white rounded-[24px] border border-dashed border-slate-200 text-slate-400">
          Задач нет. Отличная работа!
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.entries(groupedTasks).map(([objName, objTasks]: [string, any[]]) => (
            <div key={objName} className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <span className="material-icons-round">home_work</span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{objName}</h4>
                  <p className="text-xs text-slate-500">{objTasks.length} активных задач</p>
                </div>
              </div>
              <div className="space-y-3">
                {[...objTasks].sort((a,b) => (a.deadline || '9999') > (b.deadline || '9999') ? 1 : -1).map(task => {
                  const isOverdue = task.deadline && task.deadline < todayStr;
                  const isToday = task.deadline === todayStr;
                  return (
                    <div key={task.id} className="flex justify-between items-start gap-3 group">
                      <div className="flex items-start gap-2 min-w-0">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isOverdue ? 'bg-red-500' : isToday ? 'bg-amber-500' : 'bg-blue-300'}`}></div>
                        <span className={`text-sm font-medium truncate ${isOverdue ? 'text-red-700' : 'text-slate-700'}`}>{task.title}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${isOverdue ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>
                        {task.deadline ? formatDate(task.deadline) : 'Нет срока'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// 2. MANAGER VIEW: Focus on Projects State, Timeline & Money
const ManagerView: React.FC<{ tasks: any[], objects: any[], transactions: any[], userId: string }> = ({ tasks, objects, transactions, userId }) => {
  // Calculate Object Stats
  const objectStats = useMemo(() => {
    return objects.map(obj => {
      const objTasks = tasks.filter(t => t.object_id === obj.id && t.status === 'pending');
      const objTrans = transactions.filter(t => t.object_id === obj.id);
      
      const income = objTrans.filter(t => t.type === 'income').reduce((acc, t) => acc + (t.fact_amount || 0), 0);
      const expense = objTrans.filter(t => t.type === 'expense' && t.status === 'approved').reduce((acc, t) => acc + t.amount, 0);
      
      return {
        ...obj,
        taskCount: objTasks.length,
        balance: income - expense,
        nextDeadline: objTasks.sort((a,b) => (a.deadline || '9999') > (b.deadline || '9999') ? 1 : -1)[0]?.deadline
      };
    });
  }, [objects, tasks, transactions]);

  const activeProjects = objectStats.filter(o => !['frozen', 'completed'].includes(o.current_status));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Активные объекты" val={activeProjects.length} icon="business_center" color="blue" />
        <StatCard label="Задач в работе" val={tasks.filter(t => t.status === 'pending').length} icon="checklist" color="slate" />
        <StatCard label="Требуют внимания" val={objects.filter(o => o.current_status === 'review_required').length} icon="priority_high" color="amber" />
        <StatCard label="Завершенные проекты" val={objects.filter(o => o.current_status === 'completed').length} icon="emoji_events" color="emerald" />
      </div>

      <div>
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          Состояние объектов
          <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{activeProjects.length} активных</span>
        </h3>
        <div className="bg-white rounded-[24px] border border-slate-200 overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase">Объект</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase">Стадия</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase">Баланс (Факт)</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase">Задачи</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase">Ближ. дедлайн</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {activeProjects.map(obj => (
                <tr key={obj.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <p className="font-bold text-slate-900 text-sm">{obj.name}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[200px]">{obj.address}</p>
                  </td>
                  <td className="p-4">
                    <Badge color={obj.current_status === 'review_required' ? 'amber' : 'blue'}>
                      {obj.current_stage}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <span className={`text-sm font-bold ${obj.balance < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {formatCurrency(obj.balance)}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${Math.min(obj.taskCount * 10, 100)}%` }}></div>
                      </div>
                      <span className="text-xs font-medium text-slate-600">{obj.taskCount}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    {obj.nextDeadline ? (
                      <span className={`text-xs font-bold ${obj.nextDeadline < getMinskISODate() ? 'text-red-500' : 'text-slate-600'}`}>
                        {formatDate(obj.nextDeadline)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// 3. DIRECTOR/ADMIN VIEW: Financials, Productivity, Pipeline
const DirectorView: React.FC<{ tasks: any[], objects: any[], transactions: any[], staff: any[] }> = ({ tasks, objects, transactions, staff }) => {
  
  const financials = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + (t.fact_amount || 0), 0);
    const expense = transactions.filter(t => t.type === 'expense' && t.status === 'approved').reduce((s, t) => s + t.amount, 0);
    const planned = transactions.filter(t => t.type === 'income' && t.status !== 'approved').reduce((s, t) => s + (t.amount - (t.fact_amount||0)), 0);
    return { income, expense, profit: income - expense, planned };
  }, [transactions]);

  const employeeStats = useMemo(() => {
    return staff.map(user => {
      const userTasks = tasks.filter(t => t.assigned_to === user.id);
      const completed = userTasks.filter(t => t.status === 'completed').length;
      const active = userTasks.filter(t => t.status === 'pending').length;
      return { ...user, completed, active };
    }).sort((a,b) => b.completed - a.completed);
  }, [staff, tasks]);

  const stagesData = useMemo(() => {
    const counts: Record<string, number> = {};
    objects.forEach(o => {
      if (!counts[o.current_stage]) counts[o.current_stage] = 0;
      counts[o.current_stage]++;
    });
    return counts;
  }, [objects]);

  return (
    <div className="space-y-8">
      {/* Financial Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Прибыль (Cashflow)" val={formatCurrency(financials.profit)} icon="account_balance" color={financials.profit >= 0 ? 'emerald' : 'red'} />
        <StatCard label="Выручка (Факт)" val={formatCurrency(financials.income)} icon="payments" color="blue" />
        <StatCard label="Расходы (Факт)" val={formatCurrency(financials.expense)} icon="trending_down" color="red" />
        <StatCard label="Ожидаемые поступления" val={formatCurrency(financials.planned)} icon="pending" color="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Project Pipeline */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Воронка проектов</h3>
          <div className="space-y-4">
            {Object.entries(stagesData).map(([stage, count]) => (
              <div key={stage} className="flex items-center gap-4">
                <div className="w-32 text-xs font-bold text-slate-500 uppercase truncate text-right">{stage}</div>
                <div className="flex-grow h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${(count / objects.length) * 100}%` }}></div>
                </div>
                <div className="w-8 text-sm font-bold text-slate-900">{count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Employee Leaderboard */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Продуктивность команды</h3>
          <div className="overflow-y-auto max-h-[300px] pr-2 scrollbar-hide">
            <table className="w-full text-left">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="p-3 text-[10px] font-bold text-slate-400 uppercase rounded-l-xl">Сотрудник</th>
                  <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-center">Выполнено</th>
                  <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-center rounded-r-xl">В работе</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {employeeStats.map(emp => (
                  <tr key={emp.id}>
                    <td className="p-3 text-sm font-bold text-slate-700 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px]">
                        {emp.full_name[0]}
                      </div>
                      {emp.full_name}
                    </td>
                    <td className="p-3 text-sm font-bold text-emerald-600 text-center">{emp.completed}</td>
                    <td className="p-3 text-sm text-slate-500 text-center">{emp.active}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main Dashboard Component ---

const Dashboard: React.FC<{ profile: any }> = ({ profile }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ tasks: any[], objects: any[], transactions: any[], staff: any[] }>({
    tasks: [], objects: [], transactions: [], staff: []
  });
  
  // Performance Monitor
  const [latency, setLatency] = useState<number | null>(null);
  const [showTechStats, setShowTechStats] = useState(false);

  const fetchData = async () => {
    if (!profile?.id) return;
    setLoading(true);
    const start = performance.now();

    try {
      // Fetching Logic based on Roles (Simplified for MVP: Fetch all, Filter in View)
      // In a real high-load app, we would filter in SQL
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

      setLatency(Math.round(performance.now() - start));
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
            {isAdmin || isDirector ? 'Обзор компании' : isManager ? 'Мои проекты' : 'Мои задачи'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {loading ? 'Обновление данных...' : `Данные на ${formatDate(new Date(), true)}`}
          </p>
        </div>
        
        {/* Admin Tech Toggle */}
        {isAdmin && (
          <button 
            onClick={() => setShowTechStats(!showTechStats)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-[10px] font-bold uppercase text-slate-500 transition-colors"
          >
            <span className="material-icons-round text-sm">dns</span>
            {showTechStats ? 'Скрыть статус' : 'Статус системы'}
          </button>
        )}
      </div>

      {/* Admin Compact Tech Stats */}
      {isAdmin && showTechStats && (
        <div className="mb-8 p-4 bg-[#1c1b1f] rounded-2xl text-white flex items-center justify-between animate-in slide-in-from-top-2">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-slate-400 uppercase">DB Latency</span>
              <span className={`font-mono font-bold ${latency && latency < 200 ? 'text-emerald-400' : 'text-amber-400'}`}>{latency}ms</span>
            </div>
            <div className="w-[1px] h-8 bg-white/10"></div>
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Records</span>
              <span className="font-mono font-bold text-blue-400">{(data.tasks?.length || 0) + (data.transactions?.length || 0) + (data.objects?.length || 0)} items</span>
            </div>
          </div>
          <Button variant="ghost" className="h-8 text-xs text-white hover:bg-white/10" onClick={fetchData} icon="refresh">Refresh</Button>
        </div>
      )}

      {loading && data.tasks.length === 0 ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {(isAdmin || isDirector) ? (
            <DirectorView tasks={data.tasks} objects={data.objects} transactions={data.transactions} staff={data.staff} />
          ) : isManager ? (
            <ManagerView tasks={data.tasks} objects={data.objects} transactions={data.transactions} userId={profile.id} />
          ) : (
            <SpecialistView tasks={data.tasks} objects={data.objects} userId={profile.id} />
          )}
        </>
      )}
    </div>
  );
};

const StatCard = ({ label, val, icon, color }: { label: string, val: any, icon: string, color: string }) => {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-50 text-slate-600'
  };
  return (
    <div className="bg-white p-6 rounded-[28px] border border-[#e1e2e1] shadow-sm flex items-center gap-4 transition-all hover:scale-[1.02]">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${colors[color]}`}>
        <span className="material-icons-round text-2xl">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 truncate">{label}</p>
        <p className="text-xl font-bold text-slate-900 truncate">{val}</p>
      </div>
    </div>
  );
};

export default Dashboard;