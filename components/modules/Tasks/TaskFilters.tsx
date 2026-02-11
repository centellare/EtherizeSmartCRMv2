
import React from 'react';
import { Button, Input } from '../../ui';

interface TaskFiltersProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  filterMode: string;
  setFilterMode: (mode: any) => void;
  overdueCount: number;
  isSpecialist: boolean;
  onOpenCreate: () => void;
  archiveDates: { start: string; end: string };
  setArchiveDates: (dates: { start: string; end: string }) => void;
  activeRange: { start: string; end: string };
  setActiveRange: (range: { start: string; end: string }) => void;
  onRefresh: () => void;
}

export const TaskFilters: React.FC<TaskFiltersProps> = ({
  activeTab, setActiveTab, filterMode, setFilterMode, overdueCount, isSpecialist,
  onOpenCreate, archiveDates, setArchiveDates, activeRange, setActiveRange, onRefresh
}) => {
  
  const tabs = [
    { id: 'active', label: 'Активные', icon: 'assignment' },
    { id: 'today', label: 'Сегодня+', icon: 'today' },
    { id: 'week', label: 'Неделя', icon: 'date_range' },
    { id: 'overdue', label: 'Просрочено', icon: 'warning', badge: overdueCount },
    { id: 'team', label: 'Команда', icon: 'groups', hidden: isSpecialist },
    { id: 'archive', label: 'Архив', icon: 'history' }
  ].filter(t => !t.hidden);

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="min-w-0 flex-grow pr-4">
          <h2 className="text-3xl font-medium text-[#1c1b1f] flex flex-wrap items-center gap-3">
            Задачи
          </h2>
          <p className="text-slate-500 text-sm mt-1">Планирование и контроль выполнения</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
           <div className="bg-[#eff1f8] p-1 rounded-2xl flex flex-grow md:flex-initial">
              <button onClick={() => setFilterMode('all')} className={`flex-1 px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${filterMode === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Все</button>
              <button onClick={() => setFilterMode('mine')} className={`flex-1 px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${filterMode === 'mine' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Мои</button>
              <button onClick={() => setFilterMode('created')} className={`flex-1 px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${filterMode === 'created' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Поставленные</button>
           </div>
           <Button onClick={onOpenCreate} icon="add_circle" className="h-12 px-6 hidden sm:flex">Поставить задачу</Button>
           <Button onClick={onOpenCreate} icon="add" className="h-12 w-12 !px-0 flex sm:hidden rounded-2xl"></Button>
        </div>
      </div>

      <div className="flex items-center border-b border-slate-200 mb-8 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)} 
            className={`flex items-center gap-2 px-6 py-4 text-xs font-bold uppercase transition-all relative shrink-0 ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <span className="material-icons-round text-sm">{tab.icon}</span>
            <span className="whitespace-nowrap">{tab.label}</span>
            {tab.badge ? (
              <span className="w-5 h-5 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                {tab.badge}
              </span>
            ) : null}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></div>}
          </button>
        ))}
      </div>

      {(activeTab === 'archive' || activeTab === 'active') && (
        <div className="flex flex-col md:flex-row gap-4 mb-6 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm animate-in slide-in-from-top-2 duration-300">
           <div className="flex-grow flex items-center gap-3">
              <span className="material-icons-round text-slate-400">{activeTab === 'archive' ? 'history' : 'filter_alt'}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                {activeTab === 'archive' ? 'Архив за период:' : 'Фильтр дедлайнов:'}
              </span>
           </div>
           <div className="flex items-center gap-2">
              <Input 
                type="date" 
                value={activeTab === 'archive' ? archiveDates.start : activeRange.start} 
                onChange={(e:any) => activeTab === 'archive' 
                  ? setArchiveDates({...archiveDates, start: e.target.value}) 
                  : setActiveRange({...activeRange, start: e.target.value})} 
                className="h-10 !py-1 !text-xs !rounded-xl" 
              />
              <span className="text-slate-300 font-bold text-[10px]">ПО</span>
              <Input 
                type="date" 
                value={activeTab === 'archive' ? archiveDates.end : activeRange.end} 
                onChange={(e:any) => activeTab === 'archive' 
                  ? setArchiveDates({...archiveDates, end: e.target.value}) 
                  : setActiveRange({...activeRange, end: e.target.value})} 
                className="h-10 !py-1 !text-xs !rounded-xl" 
              />
              <Button 
                variant="tonal" 
                icon="refresh" 
                onClick={onRefresh} 
                className="h-10 w-10 !px-0 rounded-xl shrink-0" 
              />
           </div>
        </div>
      )}
    </>
  );
};
