
import React, { useMemo } from 'react';
import { formatDate } from '../../../lib/dateUtils';

interface ArchiveTabProps {
  tasks: any[];
  profile: any;
}

export const ArchiveTab: React.FC<ArchiveTabProps> = ({ tasks, profile }) => {
  const isSpecialist = profile.role === 'specialist';

  // Фильтруем задачи, оставляя только те, которые содержат документы
  // И применяем права доступа для специалистов
  const docTasks = useMemo(() => {
    return tasks.filter(t => {
      // Проверка прав для специалиста: только свои задачи
      if (isSpecialist) {
        const isMyTask = t.assigned_to === profile.id || t.created_by === profile.id;
        if (!isMyTask) return false;
      }

      // Оставляем только если есть хотя бы один документ
      return !!t.doc_link || !!t.completion_doc_link;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [tasks, isSpecialist, profile.id]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h4 className="text-xl font-medium text-[#1c1b1f]">Архив документации по задачам</h4>
        {isSpecialist && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg uppercase font-bold">Только мои задачи</span>}
      </div>

      {docTasks.length === 0 ? (
        <div className="p-20 text-center bg-white border border-dashed border-slate-200 rounded-[32px]">
          <span className="material-icons-round text-4xl text-slate-200 mb-2">folder_off</span>
          <p className="text-slate-400 font-medium italic">Задач с документами не найдено</p>
        </div>
      ) : (
        <div className="space-y-4">
          {docTasks.map(task => {
            const hasInput = !!task.doc_link;
            const hasOutput = !!task.completion_doc_link;

            return (
              <div key={task.id} className="bg-white rounded-[24px] border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="material-icons-round text-slate-400 text-base">assignment</span>
                    <span className="font-bold text-slate-700 truncate text-sm">{task.title}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">{formatDate(task.created_at)}</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                  {/* Input Doc */}
                  <div className={`p-4 flex items-center gap-4 transition-colors ${hasInput ? 'hover:bg-blue-50/30' : 'bg-slate-50/30'}`}>
                    {hasInput ? (
                      <a href={task.doc_link} target="_blank" rel="noreferrer" className="flex items-center gap-4 flex-grow group">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                          <span className="material-icons-round">description</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-blue-600 uppercase mb-0.5">Входящий документ</p>
                          <p className="text-sm font-medium text-slate-900 truncate underline decoration-blue-200 underline-offset-2">{task.doc_name || 'ТЗ / Документ'}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">От: {task.creator?.full_name}</p>
                        </div>
                      </a>
                    ) : (
                      <div className="flex items-center gap-4 flex-grow opacity-50 select-none">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-300 flex items-center justify-center shrink-0">
                          <span className="material-icons-round">description</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Входящий документ</p>
                          <p className="text-sm font-medium text-slate-400 italic">Отсутствует</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Output Doc */}
                  <div className={`p-4 flex items-center gap-4 transition-colors ${hasOutput ? 'hover:bg-emerald-50/30' : 'bg-slate-50/30'}`}>
                    {hasOutput ? (
                      <a href={task.completion_doc_link} target="_blank" rel="noreferrer" className="flex items-center gap-4 flex-grow group">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                          <span className="material-icons-round">verified</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase mb-0.5">Результат выполнения</p>
                          <p className="text-sm font-medium text-slate-900 truncate underline decoration-emerald-200 underline-offset-2">{task.completion_doc_name || 'Акт / Отчет'}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Исп: {task.executor?.full_name}</p>
                        </div>
                      </a>
                    ) : (
                      <div className="flex items-center gap-4 flex-grow opacity-50 select-none">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-300 flex items-center justify-center shrink-0">
                          <span className="material-icons-round">rule</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Результат выполнения</p>
                          <p className="text-sm font-medium text-slate-400 italic">Не загружен</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
