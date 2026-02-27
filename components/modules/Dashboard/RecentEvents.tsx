import React, { useMemo } from 'react';
import { formatDate } from '../../../lib/dateUtils';
import { formatCurrency } from '../../../lib/formatUtils';

interface RecentEventsProps {
  tasks: any[];
  transactions: any[];
  objects: any[];
  staff: any[];
}

export const RecentEvents: React.FC<RecentEventsProps> = ({ tasks, transactions, objects, staff }) => {
  const events = useMemo(() => {
    const allEvents: any[] = [];

    // Add Tasks
    tasks.forEach(t => {
      const assignee = staff.find(s => s.id === t.assigned_to)?.full_name || 'Неизвестно';
      const objectName = objects.find(o => o.id === t.object_id)?.name || 'Объект';
      
      allEvents.push({
        id: `task-${t.id}`,
        type: 'task',
        date: new Date(t.created_at),
        title: `Новая задача: ${t.title}`,
        description: `Назначена на ${assignee} (${objectName})`,
        icon: 'assignment',
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        link: '#tasks'
      });

      if (t.status === 'completed' && t.completed_at) {
        allEvents.push({
            id: `task-comp-${t.id}`,
            type: 'task_completed',
            date: new Date(t.completed_at),
            title: `Задача выполнена: ${t.title}`,
            description: `Исполнитель: ${assignee}`,
            icon: 'check_circle',
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-50',
            link: '#tasks'
        });
      }
    });

    // Add Transactions
    transactions.forEach(t => {
      const isIncome = t.type === 'income';
      const amount = isIncome ? (t.fact_amount || 0) : t.amount;
      const objectName = objects.find(o => o.id === t.object_id)?.name || 'Объект';
      
      allEvents.push({
        id: `trans-${t.id}`,
        type: 'transaction',
        date: new Date(t.created_at),
        title: isIncome ? 'Новый приход' : 'Новый расход',
        description: `${formatCurrency(amount)} (${objectName}) - ${t.category || 'Без категории'}`,
        icon: isIncome ? 'arrow_downward' : 'arrow_upward',
        color: isIncome ? 'text-emerald-600' : 'text-red-600',
        bgColor: isIncome ? 'bg-emerald-50' : 'bg-red-50',
        link: '#finances'
      });
    });

    // Add Objects
    objects.forEach(o => {
      allEvents.push({
        id: `obj-${o.id}`,
        type: 'object',
        date: new Date(o.created_at),
        title: `Новый объект: ${o.name}`,
        description: `Адрес: ${o.address || 'Не указан'}`,
        icon: 'business',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        link: '#objects'
      });
    });

    // Sort by date descending and take top 10
    return allEvents.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);
  }, [tasks, transactions, objects, staff]);

  return (
    <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span className="material-icons-round text-amber-500">history</span>
            Последние события
        </h4>
      </div>

      <div className="flex-grow overflow-y-auto pr-2 space-y-4">
        {events.length > 0 ? (
            events.map((event, idx) => (
                <div key={event.id} className="flex gap-4 group cursor-pointer" onClick={() => window.location.hash = event.link}>
                    <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${event.bgColor} ${event.color}`}>
                            <span className="material-icons-round text-xl">{event.icon}</span>
                        </div>
                        {idx !== events.length - 1 && (
                            <div className="w-[2px] h-full bg-slate-100 mt-2 rounded-full"></div>
                        )}
                    </div>
                    <div className="pb-4">
                        <p className="text-xs font-bold text-slate-400 mb-0.5">{formatDate(event.date.toISOString(), true)}</p>
                        <p className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{event.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{event.description}</p>
                    </div>
                </div>
            ))
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-50">
                <span className="material-icons-round text-4xl mb-2">inbox</span>
                <p className="text-sm">Событий пока нет</p>
            </div>
        )}
      </div>
    </div>
  );
};
