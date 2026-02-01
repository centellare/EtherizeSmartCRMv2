import React from 'react';

const STAGES = [
  { id: 'negotiation', label: 'Переговоры' },
  { id: 'design', label: 'Проектирование' },
  { id: 'logistics', label: 'Логистика' },
  { id: 'assembly', label: 'Сборка' },
  { id: 'mounting', label: 'Монтаж' },
  { id: 'commissioning', label: 'Пусконаладка' },
  { id: 'programming', label: 'Программирование' },
  { id: 'support', label: 'Поддержка' }
];

interface StageTimelineProps {
  object: any;
  allStagesData: any[];
  viewedStageId: string;
  setViewedStageId: (id: string) => void;
}

export const StageTimeline: React.FC<StageTimelineProps> = ({ 
  object, 
  allStagesData, 
  viewedStageId, 
  setViewedStageId 
}) => {
  const currentStageIndex = STAGES.findIndex(s => s.id === object.current_stage);

  return (
    <div className="relative pt-6 pb-2 px-2">
       <div className="absolute top-[42px] left-0 w-full h-[2px] bg-slate-100"></div>
       <div className="relative flex justify-between gap-2 overflow-x-auto scrollbar-hide">
         {STAGES.map((s, idx) => {
           const stageRecord = allStagesData.find(record => record.stage_name === s.id);
           const isRealCurrent = s.id === object.current_stage;
           const isViewed = s.id === viewedStageId;
           const isPast = idx < currentStageIndex;
           
           const isRolledBack = stageRecord?.status === 'rolled_back';
           const isCompleted = isPast || (stageRecord && stageRecord.status === 'completed');
           const isClickable = isRealCurrent || isPast || !!stageRecord;

           return (
             <button 
              key={s.id} 
              type="button"
              onClick={() => isClickable && setViewedStageId(s.id)}
              className={`flex flex-col items-center z-10 group outline-none transition-all relative shrink-0 min-w-[70px] ${!isClickable ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
             >
               <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all duration-300 relative ${
                 isViewed ? 'ring-[6px] ring-blue-50 shadow-md scale-110' : ''
               } ${
                 isRealCurrent ? 'bg-blue-600 border-white text-white shadow-lg' : 
                 isRolledBack ? 'bg-amber-500 border-white text-white' :
                 isCompleted ? 'bg-emerald-500 border-white text-white' : 
                 'bg-white border-slate-200 text-slate-400'
               }`}>
                 {isRolledBack ? <span className="material-icons-round text-sm">priority_high</span> : 
                  isCompleted ? <span className="material-icons-round text-sm">check</span> : idx + 1}
                 {isRealCurrent && !isViewed && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-bounce"></div>
                 )}
               </div>
               <span className={`text-[9px] mt-3 uppercase font-bold tracking-tight transition-colors text-center leading-tight max-w-[80px] ${isViewed ? 'text-blue-600' : 'text-slate-400'}`}>
                {s.label}
               </span>
               {isRealCurrent && (
                 <div className="absolute -top-6 px-2 py-0.5 bg-blue-600 text-white text-[8px] font-bold rounded uppercase tracking-tighter shadow-sm animate-in fade-in slide-in-from-top-1">
                   Сейчас
                 </div>
               )}
             </button>
           );
         })}
       </div>
    </div>
  );
};