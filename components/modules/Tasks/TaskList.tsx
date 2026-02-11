
import React from 'react';
import { formatDate, getMinskISODate } from '../../../lib/dateUtils';

interface TaskListProps {
  tasks: any[];
  activeTab: string;
  archivePage: number;
  archiveTotal: number;
  onPageChange: (page: number) => void;
  onTaskClick: (task: any) => void;
  onNavigateToObject: (objectId: string, stageId?: string) => void;
}

const PAGE_SIZE = 50;

export const TaskList: React.FC<TaskListProps> = ({ 
  tasks, activeTab, archivePage, archiveTotal, onPageChange, onTaskClick, onNavigateToObject 
}) => {
  
  if (tasks.length === 0) {
    return (
       <div className="py-32 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
         <span className="material-icons-round text-5xl text-slate-200 mb-4">
           {activeTab === 'archive' ? 'history_toggle_off' : 'assignment_turned_in'}
         </span>
         <p className="text-slate-400 font-medium italic">
           {activeTab === 'archive' ? 'Архив пуст за выбранный период' : 'Задачи не найдены'}
         </p>
       </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4">
        {tasks.map((task) => {
          const isOverdue = task.deadline && task.deadline < getMinskISODate() && task.status !== 'completed';
          const isCompleted = task.status === 'completed';
          
          return (
            <div 
              key={task.id} 
              onClick={() => onTaskClick(task)} 
              className={`bg-white p-4 sm:p-5 rounded-[28px] border transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isCompleted ? 'border-slate-100 opacity-75' : 'border-slate-200 hover:border-blue-400 hover:shadow-md'}`}
            >
              <div className="flex items-start sm:items-center gap-4 sm:gap-5 min-w-0 flex-grow">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isCompleted ? 'bg-emerald-50 text-emerald-500' : isOverdue ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                  <span className="material-icons-round text-xl">
                    {isCompleted ? 'check_circle' : isOverdue ? 'priority_high' : 'more_horiz'}
                  </span>
                </div>
                <div className="min-w-0 flex-grow">
                  <h4 className={`font-bold transition-colors truncate text-sm sm:text-base ${isCompleted ? 'text-slate-400' : 'text-slate-900 group-hover:text-blue-600'}`}>
                    {task.title}
                    {task.doc_link && <span className="material-icons-round text-sm ml-2 text-slate-300 align-middle">attach_file</span>}
                  </h4>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold uppercase rounded-lg tracking-tight whitespace-nowrap">{task.objects?.name || 'Объект'}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Исп: {task.executor?.full_name}</span>
                    {isCompleted && task.completed_at && (
                      <span className="text-[9px] font-bold text-emerald-500 uppercase bg-emerald-50 px-2 py-0.5 rounded whitespace-nowrap">Завершено {formatDate(task.completed_at)}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-50 sm:ml-4">
                {!isCompleted && task.deadline && (
                  <div className="text-left sm:text-right">
                    <p className={`text-xs font-bold ${isOverdue ? 'text-red-500' : 'text-slate-700'}`}>
                      {formatDate(task.deadline)}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Дедлайн</p>
                  </div>
                )}
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (task.object_id) onNavigateToObject(task.object_id, task.stage_id); 
                  }} 
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all group/btn ${isCompleted ? 'hover:bg-slate-100' : 'hover:bg-blue-50'}`}
                >
                  <span className={`material-icons-round transition-all ${isCompleted ? 'text-slate-300 group-hover:text-slate-600' : 'text-slate-300 group-hover:text-blue-600 group-hover/btn:translate-x-1'}`}>chevron_right</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {activeTab === 'archive' && archiveTotal > PAGE_SIZE && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
           <button 
             disabled={archivePage === 0}
             onClick={() => onPageChange(archivePage - 1)}
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
             disabled={(archivePage + 1) * PAGE_SIZE >= archiveTotal}
             onClick={() => onPageChange(archivePage + 1)}
             className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
           >
             <span className="material-icons-round">chevron_right</span>
           </button>
        </div>
      )}
    </>
  );
};
