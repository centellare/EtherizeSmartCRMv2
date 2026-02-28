import React, { useMemo } from 'react';
import { formatDate } from '../../../lib/dateUtils';
import { Task, Transaction, Object as CRMObject } from '../../../types';
import { Profile } from '../../../hooks/useAuth';
import { generateRecentEvents } from './eventUtils';

interface RecentEventsProps {
  tasks: Task[];
  transactions: Transaction[];
  objects: CRMObject[];
  staff: Profile[];
}

export const RecentEvents: React.FC<RecentEventsProps> = ({ tasks, transactions, objects, staff }) => {
  const events = useMemo(() => {
    return generateRecentEvents(tasks, transactions, objects, staff);
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
