
import React, { useState, useEffect, useMemo } from 'react';
import { supabase, measureQuery } from '../../lib/supabase';
import { Badge, Input } from '../ui';

const getDefaultDates = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return { start: formatDate(firstDay), end: formatDate(lastDay) };
};

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('ru-BY', { style: 'currency', currency: 'BYN' }).format(val);

const Dashboard: React.FC<{ profile: any }> = ({ profile }) => {
  const defaults = useMemo(() => getDefaultDates(), []);
  const [dateRange, setDateRange] = useState({ start: defaults.start, end: defaults.end });
  const [loading, setLoading] = useState(true);
  
  // Performance States
  const [latency, setLatency] = useState<number | null>(null);
  const [queryStats, setQueryStats] = useState<{table: string, time: number}[]>([]);
  
  // Data States
  const [tasks, setTasks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [objects, setObjects] = useState<any[]>([]);

  const fetchData = async () => {
    if (!profile?.id) return;
    setLoading(true);
    
    const startTime = performance.now();
    
    // Замеряем каждый запрос отдельно для детального отчета
    const promises = [
      measureQuery(supabase.from('tasks').select('*, executor:profiles!assigned_to(full_name), objects(name)').is('is_deleted', false)),
      measureQuery(supabase.from('transactions').select('*, objects(name, responsible_id)').is('deleted_at', null)),
      measureQuery(supabase.from('objects').select('*, responsible:profiles!responsible_id(full_name)').is('is_deleted', false))
    ];

    const results = await Promise.all(promises);
    const endTime = performance.now();
    
    setLatency(Math.round(endTime - startTime));
    
    // Сохраняем статистику по таблицам
    const stats = [
      { table: 'Задачи', time: results[0].duration },
      { table: 'Финансы', time: results[1].duration },
      { table: 'Объекты', time: results[2].duration }
    ];
    setQueryStats(stats);

    setTasks(results[0].data || []);
    setTransactions(results[1].data || []);
    setObjects(results[2].data || []);
    
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile?.id]);

  const isWithinRange = (dateStr: string) => {
    if (!dateStr) return false;
    const d = dateStr.split('T')[0];
    return d >= dateRange.start && d <= dateRange.end;
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const specialistMetrics = useMemo(() => {
    const myTasks = tasks.filter(t => t.assigned_to === profile.id);
    const active = myTasks.filter(t => t.status === 'pending');
    return { 
      active: active.length, 
      today: active.filter(t => t.deadline === todayStr).length,
      overdue: active.filter(t => t.deadline && t.deadline < todayStr).length
    };
  }, [tasks, profile.id]);

  const directorMetrics = useMemo(() => {
    const periodTrans = transactions.filter(tr => isWithinRange(tr.created_at));
    const totalIncome = periodTrans.filter(tr => tr.type === 'income').reduce((sum, tr) => sum + (tr.fact_amount || 0), 0);
    const totalExpense = periodTrans.filter(tr => tr.type === 'expense' && tr.status === 'approved').reduce((sum, tr) => sum + tr.amount, 0);
    return { totalIncome, totalExpense };
  }, [transactions, dateRange]);

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f] flex items-center gap-3">
            Рабочая область
            {latency !== null && (
              <div 
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  latency < 200 ? 'bg-emerald-100 text-emerald-700' : 
                  latency < 500 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                }`}
                title="Среднее время ответа базы данных"
              >
                <span className="material-icons-round text-[14px]">speed</span>
                DB: {latency}ms
              </div>
            )}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {loading ? 'Синхронизация...' : `Данные актуальны на ${new Date().toLocaleTimeString()}`}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
           <span className="material-icons-round text-slate-400 ml-2">calendar_today</span>
           <Input 
             type="date" 
             value={dateRange.start} 
             onChange={(e:any) => setDateRange({...dateRange, start: e.target.value})}
             className="!border-0 !shadow-none !py-1 !px-2 h-8 !text-xs !bg-transparent min-w-[130px]"
           />
           <span className="text-slate-300 font-bold text-[10px] uppercase">по</span>
           <Input 
             type="date" 
             value={dateRange.end} 
             onChange={(e:any) => setDateRange({...dateRange, end: e.target.value})}
             className="!border-0 !shadow-none !py-1 !px-2 h-8 !text-xs !bg-transparent min-w-[130px]"
           />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40">
           <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
           <p className="text-slate-400 font-medium animate-pulse">Проверка скорости ответа БД...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {profile.role === 'specialist' ? (
              <>
                <StatCard label="Задачи" val={specialistMetrics.active} icon="assignment" color="blue" />
                <StatCard label="На сегодня" val={specialistMetrics.today} icon="today" color="blue" />
                <StatCard label="Просрочено" val={specialistMetrics.overdue} icon="warning" color="red" />
                <StatCard label="Объекты" val={objects.length} icon="business" color="slate" />
              </>
            ) : (
              <>
                <StatCard label="Приход (период)" val={formatCurrency(directorMetrics.totalIncome)} icon="payments" color="emerald" />
                <StatCard label="Расход (период)" val={formatCurrency(directorMetrics.totalExpense)} icon="shopping_cart" color="red" />
                <StatCard label="Объекты" val={objects.length} icon="home_work" color="blue" />
                <StatCard label="Задачи" val={tasks.length} icon="checklist" color="slate" />
              </>
            )}
          </div>

          {/* Performance Report Section */}
          <div className="bg-white p-8 rounded-[32px] border border-[#e1e2e1] shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
              <span className="material-icons-round text-9xl">analytics</span>
            </div>
            
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Отчет по запросам БД</h3>
                <p className="text-sm text-slate-500 mt-1">Детальный мониторинг задержек на текущем модуле</p>
              </div>
              <button 
                onClick={fetchData}
                className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-blue-600 hover:text-white transition-all"
                title="Перезапустить замер"
              >
                <span className="material-icons-round">refresh</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {queryStats.map((stat, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.table}</p>
                    <span className={`w-2 h-2 rounded-full ${stat.time < 150 ? 'bg-emerald-500' : stat.time < 400 ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-mono font-bold text-slate-800">{stat.time}</span>
                    <span className="text-xs text-slate-400 font-bold uppercase">ms</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col sm:flex-row gap-6">
               <div className="flex-1">
                 <p className="text-xs font-bold text-slate-900 mb-2 uppercase tracking-tight">Заключение инженера:</p>
                 <p className="text-sm text-slate-600 leading-relaxed">
                   {latency && latency < 300 
                    ? "База данных работает в оптимальном режиме. Задержки минимальны, индексы (если они есть) отрабатывают корректно." 
                    : "Наблюдаются повышенные задержки. Рекомендуется проверить стабильность сетевого соединения или оптимизировать SQL-запросы (избегать select *)."}
                 </p>
               </div>
               <div className="shrink-0 flex items-center px-6 py-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Status</p>
                    <p className="text-sm font-bold text-emerald-800">Operational</p>
                  </div>
               </div>
            </div>
          </div>
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
