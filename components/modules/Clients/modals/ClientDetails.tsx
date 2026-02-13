
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Button, Badge, Select } from '../../../ui';

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

const SOURCES_MAP: Record<string, string> = {
    'instagram': 'Instagram',
    'website': 'Веб-сайт',
    'referral': 'Рекомендация',
    'partner': 'Партнер',
    'cold_call': 'Холодный звонок',
    'exhibition': 'Выставка',
    'other': 'Другое'
};

const CONNECTION_TYPES = [
    { value: 'neighbor', label: 'Сосед' },
    { value: 'friend', label: 'Друг / Знакомый' },
    { value: 'relative', label: 'Родственник' },
    { value: 'partner', label: 'Деловой партнер' },
    { value: 'colleague', label: 'Коллега' },
    { value: 'other', label: 'Другое' }
];

const CONN_LABELS: Record<string, string> = {
    'neighbor': 'Сосед', 'friend': 'Друг', 'relative': 'Родственник', 
    'partner': 'Партнер', 'colleague': 'Коллега', 'other': 'Связь'
};

export const ClientDetails: React.FC<ClientDetailsProps> = ({ client, onClose, onNavigateToObject, onAddObject }) => {
  const [referrals, setReferrals] = useState<any[]>([]);
  const [referrer, setReferrer] = useState<any>(null);
  const [connections, setConnections] = useState<any[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]); // For adding new connection
  
  // Add Connection State
  const [isAddingConnection, setIsAddingConnection] = useState(false);
  const [newConnData, setNewConnData] = useState({ target_id: '', type: 'neighbor' });
  const [loadingConn, setLoadingConn] = useState(false);

  useEffect(() => {
      if (client?.id) {
          fetchConnections();
      }
  }, [client]);

  const fetchConnections = async () => {
      // 1. Referral Logic
      if (client.referred_by) {
          const { data: ref } = await supabase.from('clients').select('id, name').eq('id', client.referred_by).single();
          setReferrer(ref);
      } else {
          setReferrer(null);
      }
      const { data: downline } = await supabase.from('clients').select('id, name, created_at').eq('referred_by', client.id);
      setReferrals(downline || []);

      // 2. Horizontal Connections Logic
      // We need to find rows where client_a is ME or client_b is ME
      const { data: conns } = await supabase
        .from('client_connections')
        .select(`
            id, type, comment,
            client_a_data:clients!client_a(id, name),
            client_b_data:clients!client_b(id, name)
        `)
        .or(`client_a.eq.${client.id},client_b.eq.${client.id}`);
      
      const formattedConns = (conns || []).map((c: any) => {
          // Determine who is the "other" person
          const other = c.client_a_data.id === client.id ? c.client_b_data : c.client_a_data;
          return {
              id: c.id,
              type: c.type,
              comment: c.comment,
              other_client: other
          };
      });
      setConnections(formattedConns);
  };

  const loadAllClients = async () => {
      const { data } = await supabase.from('clients').select('id, name').neq('id', client.id).is('deleted_at', null).order('name');
      setAllClients(data || []);
  };

  const handleAddConnection = async () => {
      if (!newConnData.target_id) return;
      setLoadingConn(true);
      
      const { error } = await supabase.from('client_connections').insert([{
          client_a: client.id,
          client_b: newConnData.target_id,
          type: newConnData.type
      }]);

      if (!error) {
          await fetchConnections();
          setIsAddingConnection(false);
          setNewConnData({ target_id: '', type: 'neighbor' });
      } else {
          alert('Ошибка при создании связи');
      }
      setLoadingConn(false);
  };

  const handleDeleteConnection = async (id: string) => {
      if(!window.confirm('Удалить эту связь?')) return;
      await supabase.from('client_connections').delete().eq('id', id);
      fetchConnections();
  };

  if (!client) return null;

  return (
    <div className="space-y-6 pb-10">
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

        {/* CONNECTIONS & SOCIAL GRAPH */}
        <div className="bg-gradient-to-br from-indigo-50 to-white p-4 rounded-2xl border border-indigo-100 shadow-sm">
            <div className="flex justify-between items-center mb-3 ml-1">
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                    <span className="material-icons-round text-sm">groups</span> Круг общения
                </p>
                {!isAddingConnection && (
                    <button 
                        onClick={() => { setIsAddingConnection(true); loadAllClients(); }}
                        className="text-[10px] font-bold text-indigo-600 bg-white border border-indigo-200 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-1"
                    >
                        <span className="material-icons-round text-sm">add</span> Добавить связь
                    </button>
                )}
            </div>

            {isAddingConnection && (
                <div className="bg-white p-3 rounded-xl border border-indigo-200 mb-3 animate-in fade-in zoom-in-95">
                    <p className="text-xs font-bold text-indigo-900 mb-2">Новая связь</p>
                    <div className="space-y-2">
                        <Select 
                            placeholder="Выберите клиента..."
                            options={allClients.map(c => ({ value: c.id, label: c.name }))}
                            value={newConnData.target_id}
                            onChange={(e: any) => setNewConnData({...newConnData, target_id: e.target.value})}
                            className="text-xs"
                        />
                        <Select 
                            options={CONNECTION_TYPES}
                            value={newConnData.type}
                            onChange={(e: any) => setNewConnData({...newConnData, type: e.target.value})}
                            className="text-xs"
                        />
                        <div className="flex gap-2 pt-1">
                            <Button className="h-8 text-xs flex-1" onClick={handleAddConnection} loading={loadingConn}>Сохранить</Button>
                            <Button variant="ghost" className="h-8 text-xs flex-1" onClick={() => setIsAddingConnection(false)}>Отмена</Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {connections.length > 0 ? (
                    connections.map(conn => (
                        <div key={conn.id} className="bg-white p-3 rounded-xl border border-indigo-50 flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                                    {conn.other_client.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800">{conn.other_client.name}</p>
                                    <p className="text-[10px] text-indigo-500 font-bold uppercase">{CONN_LABELS[conn.type] || conn.type}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => handleDeleteConnection(conn.id)}
                                className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <span className="material-icons-round text-sm">close</span>
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-4 text-slate-400 text-xs italic">
                        Нет добавленных связей
                    </div>
                )}
            </div>
        </div>

        {/* MARKETING SECTION (REFERRALS) */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1 flex items-center gap-1">
                <span className="material-icons-round text-sm">campaign</span> Маркетинг (Источники)
            </p>
            
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Пришел через:</span>
                    <Badge color="purple">{SOURCES_MAP[client.lead_source] || client.lead_source || 'Не указано'}</Badge>
                </div>

                {referrer && (
                    <div className="bg-white p-3 rounded-xl border border-purple-100 flex items-center gap-3">
                        <span className="material-icons-round text-purple-400">arrow_forward</span>
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase">По рекомендации от</p>
                            <p className="text-sm font-bold text-slate-800">{referrer.name}</p>
                        </div>
                    </div>
                )}

                {referrals.length > 0 && (
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase mb-2">Привел клиентов ({referrals.length}):</p>
                        <div className="space-y-2">
                            {referrals.map(ref => (
                                <div key={ref.id} className="bg-white p-2 px-3 rounded-lg border border-slate-100 flex items-center gap-2">
                                    <span className="material-icons-round text-emerald-500 text-sm">person_add</span>
                                    <span className="text-xs font-medium text-slate-700">{ref.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
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
