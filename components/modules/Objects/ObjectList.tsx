
import React from 'react';
import { Badge } from '../../ui';

const STAGES_MAP: Record<string, string> = {
  'negotiation': 'Переговоры', 'design': 'Проектирование', 'logistics': 'Логистика', 'assembly': 'Сборка', 'mounting': 'Монтаж', 'commissioning': 'Пусконаладка', 'programming': 'Программирование', 'support': 'Поддержка'
};

const STATUS_MAP: Record<string, string> = {
  'in_work': 'В работе', 'on_pause': 'На паузе', 'review_required': 'На проверку', 'frozen': 'Заморожен', 'completed': 'Завершен'
};

interface ObjectListProps {
  objects: any[];
  profile: any;
  onSelect: (id: string) => void;
  onView: (obj: any) => void;
  onEdit: (obj: any) => void;
  onDelete: (id: string) => void;
}

export const ObjectList: React.FC<ObjectListProps> = ({ 
  objects, profile, onSelect, onView, onEdit, onDelete 
}) => {
  const isAdminOrDirector = profile.role === 'admin' || profile.role === 'director';
  const isManager = profile.role === 'manager';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {objects.map(obj => {
        const isCritical = obj.current_status === 'review_required';
        const isResponsible = obj.responsible_id === profile.id;
        const canEdit = isAdminOrDirector || (isManager && isResponsible);
        const canDelete = isAdminOrDirector;

        return (
          <div 
            key={obj.id} 
            onClick={() => onSelect(obj.id)} 
            className={`bg-white rounded-[28px] border p-6 cursor-pointer hover:shadow-lg transition-all group flex flex-col justify-between min-h-[250px] relative overflow-hidden ${
              isCritical ? 'border-red-400 ring-2 ring-red-50' : 'border-[#e1e2e1] hover:border-[#005ac1]'
            }`}
          >
            {isCritical && (
              <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500 animate-pulse"></div>
            )}
            
            <div>
              <div className="flex justify-between items-start mb-4">
                <Badge color={
                  obj.current_status === 'completed' ? 'emerald' : 
                  obj.current_status === 'on_pause' ? 'amber' : 
                  obj.current_status === 'review_required' ? 'red' : 'blue'
                }>
                  {STATUS_MAP[obj.current_status] || obj.current_status?.toUpperCase()}
                </Badge>
                
                <div className="flex items-center gap-1">
                  {isCritical && (
                    <span className="material-icons-round text-red-500 animate-bounce text-xl">priority_high</span>
                  )}

                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); onView(obj); }} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-all" title="Просмотр">
                      <span className="material-icons-round text-lg">visibility</span>
                    </button>
                    {canEdit && (
                      <button onClick={(e) => { e.stopPropagation(); onEdit(obj); }} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-all" title="Редактировать">
                        <span className="material-icons-round text-lg">edit</span>
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={(e) => { e.stopPropagation(); onDelete(obj.id); }} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-red-600 flex items-center justify-center transition-all" title="Удалить">
                        <span className="material-icons-round text-lg">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              <h4 className="text-xl font-medium text-[#1c1b1f] mb-1 group-hover:text-[#005ac1] transition-colors leading-tight">
                {obj.name}
              </h4>
              
              {obj.client?.name && (
                <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-slate-600">
                    <span className="material-icons-round text-sm text-slate-400">person</span>
                    {obj.client.name}
                </div>
              )}

              <p className="text-sm text-slate-500 mb-4 flex items-start gap-1">
                <span className="material-icons-round text-base text-slate-400 mt-0.5">location_on</span>
                {obj.address || 'Адрес не указан'}
              </p>
            </div>

            <div className="pt-4 border-t border-[#f2f3f5] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Текущий этап</p>
                  <p className="text-sm font-medium text-slate-700">{STAGES_MAP[obj.current_stage] || obj.current_stage}</p>
                </div>
                <span className="material-icons-round text-[#c4c7c5] group-hover:text-[#005ac1] group-hover:translate-x-1 transition-all">arrow_forward</span>
              </div>
              
              <div className="flex items-center gap-2 pt-1">
                <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-[10px] font-bold text-blue-600 border border-blue-100">
                  {obj.responsible?.full_name?.charAt(0) || '?'}
                </div>
                <p className="text-xs text-slate-500 font-medium truncate">
                  <span className="text-slate-400">Отв:</span> {obj.responsible?.full_name || 'Не назначен'}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
