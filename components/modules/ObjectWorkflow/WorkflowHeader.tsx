
import React from 'react';
import { Button, Badge } from '../../ui';
import { formatDate } from '../../../lib/dateUtils';

const STATUSES = [
  { id: 'in_work', label: 'В работе', icon: 'play_arrow' },
  { id: 'on_pause', label: 'На паузе', icon: 'pause' },
  { id: 'frozen', label: 'Заморожен', icon: 'ac_unit' },
  { id: 'review_required', label: 'На проверку', icon: 'visibility' }
];

const STAGES_MAP: Record<string, string> = {
  'negotiation': 'Переговоры',
  'design': 'Проектирование',
  'logistics': 'Логистика',
  'assembly': 'Сборка',
  'mounting': 'Монтаж',
  'commissioning': 'Пусконаладка',
  'programming': 'Программирование',
  'support': 'Поддержка'
};

const STATUS_MAP: Record<string, string> = {
  'in_work': 'В работе', 'on_pause': 'На паузе', 'review_required': 'На проверку', 'frozen': 'Заморожен', 'completed': 'Завершен'
};

interface WorkflowHeaderProps {
  object: any;
  allStagesData: any[];
  profile: any;
  onBack: () => void;
  onUpdateStatus: (status: string) => void;
  canManage: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

export const WorkflowHeader: React.FC<WorkflowHeaderProps> = ({ 
  object, 
  allStagesData,
  profile, 
  onBack, 
  onUpdateStatus, 
  canManage,
  isExpanded,
  onToggle
}) => {
  const isSpecialist = profile.role === 'specialist';
  
  const activeStageRecord = allStagesData.find(s => s.status === 'active');
  const startDate = activeStageRecord?.stage_name === object.current_stage ? activeStageRecord?.started_at : null;
  const deadlineDate = activeStageRecord?.stage_name === object.current_stage ? activeStageRecord?.deadline : null;

  const mapUrl = object.address 
    ? `https://yandex.ru/maps/?text=${encodeURIComponent(object.address)}`
    : '#';

  const isOverdue = deadlineDate && new Date(deadlineDate) < new Date();

  return (
    <div className="flex flex-col space-y-6 transition-all">
      <div className="flex flex-col xl:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4 flex-grow min-w-0">
          <button onClick={onBack} className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0 text-slate-500">
            <span className="material-icons-round text-xl">arrow_back</span>
          </button>
          
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-2xl font-medium leading-tight text-slate-900 truncate">{object.name}</h2>
              
              {/* Collapsed Compact Info */}
              {!isExpanded && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="h-4 w-[1px] bg-slate-300 mx-1 hidden md:block"></div>
                  
                  {/* Client name in compact view */}
                  <span className="text-sm font-bold text-slate-400 truncate max-w-[150px]">
                    {object.client?.name || 'Без клиента'}
                  </span>
                  
                  <span className="text-slate-200 hidden md:block">|</span>

                  <Badge color="blue">{STAGES_MAP[object.current_stage] || object.current_stage}</Badge>
                  <Badge color={
                      object.current_status === 'completed' ? 'emerald' : 
                      object.current_status === 'on_pause' ? 'amber' : 
                      object.current_status === 'review_required' ? 'red' : 'slate'
                  }>
                    {STATUS_MAP[object.current_status] || object.current_status}
                  </Badge>
                  {deadlineDate && (
                    <span className={`hidden lg:inline text-xs font-bold ml-2 ${isOverdue ? 'text-red-500' : 'text-emerald-600'}`}>
                      {isOverdue ? '🔥 Срок: ' : '📅 Срок: '} {formatDate(deadlineDate)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Address only shown when expanded */}
            {isExpanded && (
              <div className="flex items-center gap-3 mt-1.5 animate-in fade-in slide-in-from-top-1">
                 <Badge color="blue">{STAGES_MAP[object.current_stage] || object.current_stage}</Badge>
                 <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                 <a 
                   href={mapUrl} 
                   target="_blank" 
                   rel="noreferrer" 
                   className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 group"
                 >
                   <span className="material-icons-round text-sm group-hover:scale-110 transition-transform">place</span>
                   <span className="border-b border-blue-600/30 group-hover:border-blue-800 truncate max-w-[300px]">{object.address || 'Адрес не указан'}</span>
                 </a>
              </div>
            )}
            
            {/* Mobile/Small Screens Compact Info (Visible when collapsed) */}
            {!isExpanded && deadlineDate && (
              <div className="lg:hidden flex flex-wrap gap-2 mt-1 animate-in fade-in duration-300">
                 <span className={`text-[10px] font-bold ${isOverdue ? 'text-red-500' : 'text-slate-500 uppercase'}`}>
                   {isOverdue ? '🔥 ПРОСРОЧЕНО: ' : 'СРОК: '} {formatDate(deadlineDate)}
                 </span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-start gap-2 shrink-0 self-end xl:self-start">
          {isExpanded && (
            <div className="flex flex-wrap justify-end gap-2 animate-in fade-in zoom-in-95 duration-200">
              {STATUSES.map(s => {
                const isRestrictedForSpec = isSpecialist && s.id === 'frozen';
                const isDisabled = !canManage && !['review_required', 'in_work', 'on_pause'].includes(s.id);
                
                return (
                  <button 
                    key={s.id} 
                    disabled={isDisabled || isRestrictedForSpec} 
                    onClick={() => onUpdateStatus(s.id)}
                    className={`px-4 py-2 rounded-xl border transition-all flex items-center justify-center gap-1.5 text-[11px] font-bold ${
                      object.current_status === s.id 
                        ? `bg-[#d3e4ff] border-[#005ac1] text-[#001d3d] shadow-sm` 
                        : `bg-white border-slate-200 text-slate-500 hover:border-slate-400 disabled:opacity-30`
                    }`}
                  >
                    <span className="material-icons-round text-sm">{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          )}
          
          <button 
            onClick={onToggle}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isExpanded ? 'bg-slate-100 text-slate-600' : 'bg-white border border-slate-200 text-slate-400 hover:border-slate-300'}`}
            title={isExpanded ? "Свернуть шапку" : "Развернуть подробности и workflow"}
          >
            <span className={`material-icons-round text-xl transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
          </button>
        </div>
      </div>

      {/* Expanded Metadata Grid */}
      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/50 p-5 rounded-[24px] border border-slate-100 animate-in slide-in-from-top-4 duration-300">
          <div className="space-y-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Клиент</p>
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="material-icons-round text-slate-400 text-lg shrink-0">person</span>
              <p className="text-sm font-bold text-slate-700 truncate">{object.client?.name || '—'}</p>
            </div>
          </div>

          <div className="space-y-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ответственный</p>
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="material-icons-round text-blue-500 text-lg shrink-0">support_agent</span>
              <p className="text-sm font-bold text-slate-700 truncate">{object.responsible?.full_name || 'Не назначен'}</p>
            </div>
          </div>

          <div className="space-y-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Создан</p>
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="material-icons-round text-slate-400 text-lg shrink-0">calendar_today</span>
              <p className="text-sm font-bold text-slate-700">{formatDate(object.created_at)}</p>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center min-w-0">
            <div className="flex justify-between items-center mb-1 gap-2">
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest truncate">Сроки этапа</p>
              {deadlineDate && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${new Date(deadlineDate) < new Date() ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  {new Date(deadlineDate) < new Date() ? 'Просрочено' : 'В срок'}
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-slate-600 truncate">
              {startDate ? formatDate(startDate) : '—'} 
              <span className="mx-1 text-slate-300">→</span>
              <span className="font-bold text-slate-900">{deadlineDate ? formatDate(deadlineDate) : 'Не задан'}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
