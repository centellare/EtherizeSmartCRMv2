
import React, { useState } from 'react';
import { Button } from '../../../ui';

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button 
      onClick={handleCopy} 
      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors flex items-center justify-center shrink-0"
      title="Копировать"
    >
      <span className="material-icons-round text-sm">{copied ? 'check' : 'content_copy'}</span>
    </button>
  );
};

interface ClientDetailsProps {
  client: any;
  onClose: () => void;
  onNavigateToObject: (id: string) => void;
  onAddObject: (clientId: string) => void;
}

export const ClientDetails: React.FC<ClientDetailsProps> = ({ client, onClose, onNavigateToObject, onAddObject }) => {
  if (!client) return null;

  return (
    <div className="space-y-6">
        <div className="min-w-0">
            <h3 className="text-2xl font-medium text-[#1c1b1f] leading-tight break-words">{client.name}</h3>
            <p className="text-sm text-[#444746] mt-1">{client.type === 'company' ? 'Юридическое лицо' : 'Частное лицо'}</p>
        </div>

        {client.type === 'company' && (client.contact_person || client.contact_position) && (
            <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100/50 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-sm">
                <span className="material-icons-round text-2xl">account_circle</span>
            </div>
            <div className="min-w-0 flex-grow">
                <p className="text-[10px] font-bold text-blue-400 uppercase mb-0.5 tracking-widest">Контактное лицо</p>
                <p className="text-sm font-bold text-blue-900 leading-tight">{client.contact_person || 'Не указано'}</p>
                {client.contact_position && (
                <p className="text-xs font-medium text-blue-700 mt-0.5">{client.contact_position}</p>
                )}
            </div>
            </div>
        )}

        <div className="grid grid-cols-1 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-[#e1e2e1] flex justify-between items-center group/field">
            <div className="min-w-0 flex-grow">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Телефон</p>
                <p className="text-sm font-medium">{client.phone || '—'}</p>
            </div>
            {client.phone && <CopyButton text={client.phone} />}
            </div>
            <div className="p-4 bg-white rounded-2xl border border-[#e1e2e1] flex justify-between items-center group/field">
            <div className="min-w-0 flex-grow pr-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Email</p>
                <p className="text-sm font-medium truncate">{client.email || '—'}</p>
            </div>
            {client.email && <CopyButton text={client.email} />}
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Ответственный менеджер</p>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                <span className="material-icons-round text-slate-400">support_agent</span>
                <span className="text-sm text-slate-700 font-medium">{client.manager?.full_name || 'Не назначен'}</span>
            </div>
            </div>
        </div>

        {client.requisites && (
            <div className="p-4 bg-white rounded-2xl border border-[#e1e2e1]">
            <div className="flex justify-between items-center mb-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Реквизиты</p>
                <CopyButton text={client.requisites} />
            </div>
            <div className="p-3 bg-[#f7f9fc] rounded-xl border border-slate-100">
                <p className="text-sm text-[#444746] whitespace-pre-wrap leading-relaxed select-all">
                {client.requisites}
                </p>
            </div>
            </div>
        )}

        <div>
            <div className="flex justify-between items-center mb-3 ml-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Объекты в работе</p>
                <Button 
                    variant="tonal" 
                    className="h-8 px-3 text-[10px]" 
                    icon="add_business"
                    onClick={() => {
                        onClose(); // Закрываем детали клиента
                        onAddObject(client.id); // Переходим к созданию объекта
                    }}
                >
                    Создать объект
                </Button>
            </div>
            <div className="space-y-2">
                {client.objects && client.objects.filter((o:any) => !o.is_deleted).length > 0 ? (
                    client.objects.filter((o:any) => !o.is_deleted).map((obj: any) => (
                    <div 
                        key={obj.id}
                        onClick={() => onNavigateToObject(obj.id)}
                        className="flex items-center justify-between p-4 bg-[#f7f9fc] rounded-2xl hover:bg-[#d3e4ff] cursor-pointer transition-colors border border-transparent hover:border-[#005ac1] group/obj"
                    >
                        <div className="flex items-center gap-3">
                        <span className="material-icons-round text-slate-400 group-hover/obj:text-[#005ac1]">home_work</span>
                        <span className="text-sm font-medium">{obj.name}</span>
                        </div>
                        <span className="material-icons-round text-[#005ac1] opacity-0 group-hover/obj:opacity-100 transition-opacity">arrow_forward</span>
                    </div>
                    ))
                ) : (
                    <div className="p-4 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400 text-xs italic">
                        Нет активных объектов
                    </div>
                )}
            </div>
        </div>
        
        {client.comment && (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <p className="text-[10px] font-bold text-amber-700 uppercase mb-1">Заметка</p>
            <p className="text-sm text-amber-900 italic break-words">{client.comment}</p>
            </div>
        )}

        <Button onClick={onClose} className="w-full h-12" variant="tonal">Закрыть</Button>
    </div>
  );
};
