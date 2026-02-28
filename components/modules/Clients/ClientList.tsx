
import React from 'react';
import { Badge } from '../../ui';

interface ClientListProps {
  clients: any[];
  canManage: boolean;
  onView: (client: any) => void;
  onEdit: (client: any) => void;
  onDelete: (id: string) => void;
  onNavigateToObject: (id: string) => void;
}

export const ClientList: React.FC<ClientListProps> = ({ 
  clients, canManage, onView, onEdit, onDelete, onNavigateToObject 
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {clients.map(client => {
        const activeObjects = client.objects?.filter((o: any) => !o.is_deleted) || [];
        return (
          <div 
            key={client.id} 
            onClick={() => onView(client)} 
            className="bg-white rounded-[28px] border border-[#e1e2e1] p-6 cursor-pointer hover:border-[#005ac1] hover:shadow-md transition-all group flex flex-col justify-between min-h-[220px]"
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <Badge color={client.type === 'company' ? 'emerald' : 'blue'}>
                  {client.type === 'company' ? 'Компания' : 'Физлицо'}
                </Badge>
                
                <div className="flex items-center gap-2">
                  {activeObjects.length > 0 && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-[#005ac1] bg-[#d3e4ff] px-2 py-0.5 rounded-full">
                      <span className="material-icons-round text-xs">home_work</span>
                      {activeObjects.length}
                    </div>
                  )}
                  
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); onView(client); }} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-all" title="Просмотр">
                      <span className="material-icons-round text-lg">visibility</span>
                    </button>
                    {canManage && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); onEdit(client); }} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-all" title="Редактировать">
                          <span className="material-icons-round text-lg">edit</span>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(client.id); }} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-red-600 flex items-center justify-center transition-all" title="Удалить">
                          <span className="material-icons-round text-lg">delete</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              <h4 className="text-xl font-medium text-[#1c1b1f] mb-1 group-hover:text-[#005ac1] transition-colors line-clamp-2">{client.name}</h4>
              {client.type === 'company' && client.contact_person && (
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter truncate mb-4">Отв: {client.contact_person}</p>
              )}
              
              {client.partner && (
                <div className="mb-4 inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                  <span className="material-icons-round text-xs">handshake</span>
                  {client.partner.name}
                </div>
              )}
              
              <div className="space-y-2 mb-6">
                {client.phone && (
                  <div className="flex items-center gap-2 text-sm text-[#444746]">
                    <span className="material-icons-round text-base opacity-50">phone</span>
                    {client.phone}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#f2f3f5] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold overflow-hidden ${
                  client.manager?.role === 'admin' ? 'bg-red-50 text-red-600' :
                  client.manager?.role === 'director' ? 'bg-purple-50 text-purple-600' :
                  client.manager?.role === 'manager' ? 'bg-blue-50 text-blue-600' :
                  client.manager?.role === 'storekeeper' ? 'bg-amber-50 text-amber-600' :
                  'bg-emerald-50 text-emerald-600'
                }`}>
                  {client.manager?.avatar_url ? (
                    <img src={client.manager.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    client.manager?.full_name?.charAt(0) || '?'
                  )}
                </div>
                <span className="text-xs text-[#444746]">{client.manager?.full_name?.split(' ')[0] || 'Нет менеджера'}</span>
              </div>
              <span className="material-icons-round text-[#c4c7c5] group-hover:text-[#005ac1] transition-all">chevron_right</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
