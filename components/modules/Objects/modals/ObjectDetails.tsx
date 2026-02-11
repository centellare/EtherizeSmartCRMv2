
import React from 'react';
import { Badge, Button } from '../../../ui';

const STAGES_MAP: Record<string, string> = {
  'negotiation': 'Переговоры', 'design': 'Проектирование', 'logistics': 'Логистика', 'assembly': 'Сборка', 'mounting': 'Монтаж', 'commissioning': 'Пусконаладка', 'programming': 'Программирование', 'support': 'Поддержка'
};

const STATUS_MAP: Record<string, string> = {
  'in_work': 'В работе', 'on_pause': 'На паузе', 'review_required': 'На проверку', 'frozen': 'Заморожен', 'completed': 'Завершен'
};

interface ObjectDetailsProps {
  object: any;
  onClose: () => void;
}

export const ObjectDetails: React.FC<ObjectDetailsProps> = ({ object, onClose }) => {
  if (!object) return null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Название объекта</p>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
          <span className="material-icons-round text-blue-500">business</span>
          <span className="text-lg font-medium text-slate-900">{object.name}</span>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Адрес</p>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
          <span className="material-icons-round text-slate-400">place</span>
          <span className="text-sm text-slate-700">{object.address || 'Не указан'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Клиент</p>
          <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
            <span className="material-icons-round text-slate-400">person</span>
            <span className="text-sm text-slate-700 font-medium">{object.client?.name || '—'}</span>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Ответственный</p>
          <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
            <span className="material-icons-round text-slate-400">support_agent</span>
            <span className="text-sm text-slate-700 font-medium">{object.responsible?.full_name || 'Не назначен'}</span>
          </div>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Статус и этап</p>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge color="blue">{STATUS_MAP[object.current_status]}</Badge>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Этап</p>
            <p className="text-sm font-medium">{STAGES_MAP[object.current_stage]}</p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Комментарий / Заметки</p>
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 min-h-[100px]">
          <p className="text-sm text-slate-600 italic leading-relaxed whitespace-pre-wrap">
            {object.comment || 'Комментарии отсутствуют'}
          </p>
        </div>
      </div>

      <Button onClick={onClose} className="w-full h-12" variant="tonal">Закрыть</Button>
    </div>
  );
};
