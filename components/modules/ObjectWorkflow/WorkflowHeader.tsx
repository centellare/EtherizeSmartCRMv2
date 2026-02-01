
import React from 'react';
import { Button, Badge } from '../../ui';

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

interface WorkflowHeaderProps {
  object: any;
  allStagesData: any[];
  profile: any;
  onBack: () => void;
  onUpdateStatus: (status: string) => void;
  canManage: boolean;
}

export const WorkflowHeader: React.FC<WorkflowHeaderProps> = ({ 
  object, 
  allStagesData,
  profile, 
  onBack, 
  onUpdateStatus, 
  canManage 
}) => {
  const isSpecialist = profile.role === 'specialist';
  
  /**
   * СТРОГАЯ ЛОГИКА ПО ТЗ:
   * Ищем запись в object_stages, где статус именно 'active'.
   * stage_name должен соответствовать текущему этапу объекта.
   */
  const activeStageRecord = allStagesData.find(s => s.status === 'active');

  // Если статус active не найден или он не совпадает с текущим этапом объекта (рассинхрон),
  // данные не отображаем, чтобы не вводить в заблуждение.
  const startDate = activeStageRecord?.stage_name === object.current_stage ? activeStageRecord?.started_at : null;
  const deadlineDate = activeStageRecord?.stage_name === object.current_stage ? activeStageRecord?.deadline : null;

  const mapUrl = object.address 
    ? `https://yandex.ru/maps/?text=${encodeURIComponent(object.address)}`
    : '#';

  return (
    <div className="flex flex-col space-y-8 mb-10">
      {/* Upper row: Navigation and Status controls */}
      <div className="flex flex-col xl:flex-row justify-between items-start gap-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-12 h-12 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0">
            <span className="material-icons-round text-2xl">arrow_back</span>
          </button>
          <div>
            <h2 className="text-3xl font-medium leading-tight text-slate-900">{object.name}</h2>
            <div className="flex items-center gap-3 mt-1.5">
               <Badge color="blue">{STAGES_MAP[object.current_stage] || object.current_stage}</Badge>
               <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
               <a 
                 href={mapUrl} 
                 target="_blank" 
                 rel="noreferrer" 
                 className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 group"
               >
                 <span className="material-icons-round text-sm group-hover:scale-110 transition-transform">place</span>
                 <span className="border-b border-blue-600/30 group-hover:border-blue-800">{object.address || 'Адрес не указан'}</span>
               </a>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full xl:w-auto">
          {STATUSES.map(s => {
            const isRestrictedForSpec = isSpecialist && s.id === 'frozen';
            const isDisabled = !canManage && !['review_required', 'in_work', 'on_pause'].includes(s.id);
            
            return (
              <button 
                key={s.id} 
                disabled={isDisabled || isRestrictedForSpec} 
                onClick={() => onUpdateStatus(s.id)}
                className={`flex-grow xl:flex-initial px-5 py-3 rounded-2xl border transition-all flex items-center justify-center gap-2 text-xs font-bold ${
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
      </div>

      {/* Info Grid: Metadata */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 bg-slate-50/50 p-6 rounded-[28px] border border-slate-100">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Клиент</p>
          <div className="flex items-center gap-2">
            <span className="material-icons-round text-slate-400 text-lg">person</span>
            <p className="text-sm font-bold text-slate-700">{object.client?.name || '—'}</p>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ответственный</p>
          <div className="flex items-center gap-2">
            <span className="material-icons-round text-blue-500 text-lg">support_agent</span>
            <p className="text-sm font-bold text-slate-700">{object.responsible?.full_name || 'Не назначен'}</p>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Создан</p>
          <div className="flex items-center gap-2">
            <span className="material-icons-round text-slate-400 text-lg">calendar_today</span>
            <p className="text-sm font-bold text-slate-700">{new Date(object.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center">
          <div className="flex justify-between items-center mb-1">
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Сроки этапа</p>
            {deadlineDate && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${new Date(deadlineDate) < new Date() ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {new Date(deadlineDate) < new Date() ? 'Просрочено' : 'В срок'}
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-slate-600">
            {startDate ? new Date(startDate).toLocaleDateString() : '—'} 
            <span className="mx-1 text-slate-300">→</span>
            <span className="font-bold text-slate-900">{deadlineDate ? new Date(deadlineDate).toLocaleDateString() : 'Не задан'}</span>
          </p>
        </div>
      </div>
    </div>
  );
};
