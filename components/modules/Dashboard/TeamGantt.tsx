
import React, { useMemo } from 'react';
import { formatDate } from '../../../lib/dateUtils';

interface TeamGanttProps {
  staff: any[];
  tasks: any[];
}

export const TeamGantt: React.FC<TeamGanttProps> = ({ staff, tasks }) => {
  // Настройки диапазона (сегодня - 2 дня ... сегодня + 14 дней)
  const rangeConfig = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - 2); // Показываем немного прошлого
    const end = new Date();
    end.setDate(end.getDate() + 14); // Показываем 2 недели вперед
    
    const days = [];
    let curr = new Date(start);
    while (curr <= end) {
      days.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return { start, end, days };
  }, []);

  // Фильтруем сотрудников (исключаем админов без задач, если нужно, или показываем всех кроме удаленных)
  const activeStaff = useMemo(() => {
    return staff.filter(s => s.role !== 'admin' && s.role !== 'director');
  }, [staff]);

  // Хелпер для позиционирования
  const getTaskStyle = (task: any) => {
    const taskStart = task.start_date ? new Date(task.start_date) : new Date();
    const taskEnd = task.deadline ? new Date(task.deadline) : new Date(taskStart);
    
    // Если дедлайн не указан, даем задаче длину 1 день
    if (!task.deadline) taskEnd.setDate(taskEnd.getDate() + 1);

    // Обрезаем по границам вьюпорта
    const viewStart = rangeConfig.start.getTime();
    const viewEnd = rangeConfig.end.getTime();
    const tStart = taskStart.getTime();
    const tEnd = taskEnd.getTime();

    // Если задача полностью вне диапазона
    if (tEnd < viewStart || tStart > viewEnd) return null;

    const effectiveStart = Math.max(tStart, viewStart);
    const effectiveEnd = Math.min(tEnd, viewEnd);
    
    const totalDuration = viewEnd - viewStart;
    const taskDuration = effectiveEnd - effectiveStart;
    
    // Вычисляем проценты для CSS
    const left = ((effectiveStart - viewStart) / totalDuration) * 100;
    const width = Math.max(((taskDuration) / totalDuration) * 100, 2); // Мин ширина 2%

    let colorClass = 'bg-blue-500';
    const now = new Date().getTime();
    
    if (taskEnd.getTime() < now) colorClass = 'bg-red-500'; // Просрочено
    else if (taskStart.getTime() > now) colorClass = 'bg-slate-300'; // Будущее
    
    return {
      left: `${left}%`,
      width: `${width}%`,
      className: colorClass
    };
  };

  return (
    <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="material-icons-round text-indigo-600">calendar_month</span>
                Загрузка команды
            </h4>
            <p className="text-xs text-slate-500 mt-1">График выполнения задач на ближайшие 2 недели</p>
        </div>
        <div className="flex gap-4 text-[10px] font-bold uppercase">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div>Просрочено</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div>В работе</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-300"></div>План</div>
        </div>
      </div>

      <div className="flex-grow overflow-x-auto pb-2 scrollbar-hide">
        <div className="min-w-[800px]">
            {/* Header Dates */}
            <div className="flex border-b border-slate-100 pb-2 mb-2">
                <div className="w-48 shrink-0 font-bold text-xs text-slate-400 uppercase tracking-widest pl-2">Сотрудник</div>
                <div className="flex-grow flex relative h-6">
                    {rangeConfig.days.map((day, idx) => {
                        const isToday = day.toDateString() === new Date().toDateString();
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                        return (
                            <div key={idx} className="flex-1 text-center border-l border-slate-100 last:border-r relative group">
                                <span className={`text-[10px] font-bold block ${isToday ? 'text-blue-600' : isWeekend ? 'text-red-300' : 'text-slate-400'}`}>
                                    {day.getDate()}
                                </span>
                                <span className={`text-[8px] uppercase ${isToday ? 'text-blue-600' : 'text-slate-300'}`}>
                                    {day.toLocaleString('ru', { weekday: 'short' })}
                                </span>
                                {isToday && (
                                    <div className="absolute top-8 bottom-[-500px] left-1/2 w-[2px] bg-blue-500/10 pointer-events-none z-0"></div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Rows */}
            <div className="space-y-4 relative z-10">
                {activeStaff.map(member => {
                    const memberTasks = tasks.filter(t => t.assigned_to === member.id && t.status === 'pending');
                    
                    return (
                        <div key={member.id} className="flex items-center group hover:bg-slate-50 rounded-xl transition-colors py-2">
                            {/* User Info */}
                            <div className="w-48 shrink-0 flex items-center gap-3 pl-2">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                    {member.full_name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-800 truncate">{member.full_name}</p>
                                    <p className="text-[9px] text-slate-400 truncate">{memberTasks.length} активных задач</p>
                                </div>
                            </div>

                            {/* Timeline Lane */}
                            <div className="flex-grow relative h-8 bg-slate-50/50 rounded-lg mr-2">
                                {/* Grid Lines Background */}
                                <div className="absolute inset-0 flex pointer-events-none">
                                    {rangeConfig.days.map((_, i) => (
                                        <div key={i} className="flex-1 border-l border-slate-200/50 h-full last:border-r"></div>
                                    ))}
                                </div>

                                {/* Task Bars */}
                                {memberTasks.map((task: any) => {
                                    const style = getTaskStyle(task);
                                    if (!style) return null;

                                    return (
                                        <div
                                            key={task.id}
                                            className={`absolute top-1.5 h-5 rounded-md shadow-sm border border-white/20 cursor-pointer hover:brightness-110 hover:z-20 transition-all group/task ${style.className}`}
                                            style={{ left: style.left, width: style.width }}
                                            onClick={() => window.location.hash = task.object_id ? `objects/${task.object_id}` : 'tasks'}
                                        >
                                            {/* Tooltip */}
                                            <div className="opacity-0 group-hover/task:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-800 text-white text-[10px] p-2 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none transition-opacity">
                                                <p className="font-bold">{task.title}</p>
                                                <p className="text-slate-300">{task.objects?.name}</p>
                                                <p className="text-slate-400 mt-1">{formatDate(task.deadline)}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
    </div>
  );
};
