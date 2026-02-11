
import React from 'react';
import { formatDate, getMinskISODate } from '../../../lib/dateUtils';

interface TeamWorkloadProps {
  teamWorkload: any[];
  onTaskClick: (task: any) => void;
}

export const TeamWorkload: React.FC<TeamWorkloadProps> = ({ teamWorkload, onTaskClick }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {teamWorkload.map((member: any) => (
        <div key={member.id} className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[380px]">
          <div className="p-6 pb-4 flex justify-between items-start shrink-0">
            <div className="min-w-0 pr-4">
              <h4 className="text-base font-bold text-slate-900 leading-tight truncate">{member.full_name}</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{member.role}</p>
            </div>
            <div className="flex flex-col items-center shrink-0">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold shadow-inner">
                {member.tasks.length}
              </div>
              <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Задач</span>
            </div>
          </div>
          
          <div className="px-4 pb-6 space-y-2 overflow-y-auto flex-grow scrollbar-hide">
            {member.tasks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-30 italic">
                 <span className="material-icons-round text-3xl mb-1">done_all</span>
                 <p className="text-[10px] uppercase font-bold tracking-widest">Задач нет</p>
              </div>
            ) : (
              member.tasks.map((task: any) => {
                const isOverdue = task.deadline && task.deadline < getMinskISODate();
                return (
                  <div 
                    key={task.id} 
                    onClick={() => onTaskClick(task)}
                    className="bg-[#f8f9fa] p-3 rounded-2xl border border-transparent hover:border-blue-200 transition-all cursor-pointer group hover:bg-white hover:shadow-sm"
                  >
                    <p className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight">{task.title}</p>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase truncate pr-2">{task.objects?.name}</span>
                      <span className={`text-[10px] font-bold whitespace-nowrap ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                        {task.deadline ? formatDate(task.deadline) : '—'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
