import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { InventoryItem } from '../../../types';
import { Badge, Button } from '../../ui';
import { formatDate } from '../../../lib/dateUtils';

interface ItemDetailsDrawerProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: 'return' | 'replace' | 'edit', item: InventoryItem) => void;
  profile: any;
}

const ItemDetailsDrawer: React.FC<ItemDetailsDrawerProps> = ({ item, isOpen, onClose, onAction, profile }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && item) {
      fetchHistory();
    }
  }, [isOpen, item]);

  const fetchHistory = async () => {
    if (!item) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('inventory_history')
        .select('*, profiles(full_name)')
        .eq('item_id', item.id)
        .order('created_at', { ascending: false });
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!item) return null;

  const isDeployed = item.status === 'deployed';

  return (
    <>
      {/* Overlay — теперь под хэдером */}
      <div 
        className={`fixed inset-0 top-[64px] bg-[#1c1b1f]/20 backdrop-blur-sm z-[1000] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose}
      />
      
      {/* Drawer — top-[64px] и правильный расчет высоты */}
      <div className={`fixed right-0 top-[64px] h-[calc(100vh-64px)] w-full max-w-md bg-white shadow-2xl z-[1010] transform transition-transform duration-300 ease-in-out border-l border-slate-100 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
            <div className="pr-4">
              <div className="mb-2">
                 <Badge color={item.status === 'deployed' ? 'blue' : item.status === 'in_stock' ? 'emerald' : 'red'}>
                    {item.status === 'deployed' ? 'На объекте' : item.status === 'in_stock' ? 'На складе' : item.status === 'scrapped' ? 'Списан' : 'В ремонте'}
                 </Badge>
              </div>
              <h2 className="text-xl font-bold text-slate-900 leading-tight">{item.catalog?.name}</h2>
              <p className="text-xs text-slate-400 font-mono mt-1">
                ID: {item.id.split('-')[0]}... 
                {item.serial_number && <span className="text-slate-600 font-bold ml-1">| S/N: {item.serial_number}</span>}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors shrink-0">
              <span className="material-icons-round text-slate-400">close</span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
            
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              {isDeployed ? (
                <Button variant="tonal" className="flex items-center justify-center gap-2 h-10" onClick={() => onAction('return', item)}>
                  <span className="material-icons-round text-sm">settings_backup_restore</span> Вернуть
                </Button>
              ) : (
                <Button variant="secondary" className="flex items-center justify-center gap-2 h-10" onClick={() => onAction('edit', item)}>
                  <span className="material-icons-round text-sm">edit</span> Редактировать
                </Button>
              )}
              
              {isDeployed && (
                  <Button variant="secondary" className="flex items-center justify-center gap-2 h-10" onClick={() => onAction('replace', item)}>
                    <span className="material-icons-round text-sm">autorenew</span> Замена
                  </Button>
              )}
            </div>

            {/* Info Section */}
            <section>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Характеристики</h3>
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                  <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
                    <div className="p-4">
                        <p className="text-[10px] text-slate-400 uppercase mb-1">Количество</p>
                        <p className="font-bold text-slate-900">{item.quantity} {item.catalog?.unit}</p>
                    </div>
                    <div className="p-4">
                        <p className="text-[10px] text-slate-400 uppercase mb-1">Закупка</p>
                        <p className="font-bold text-slate-900">
                            {(item.purchase_price || item.catalog?.last_purchase_price || 0).toLocaleString('ru-RU')} BYN
                        </p>
                    </div>
                  </div>
                  {item.current_object_id && (
                    <div className="p-4 bg-blue-50/50">
                        <p className="text-[10px] text-blue-400 uppercase mb-1">Текущее местоположение</p>
                        <div className="flex items-center gap-2">
                            <span className="material-icons-round text-blue-600 text-sm">home_work</span>
                            <p className="font-bold text-blue-900 text-sm">{item.objects?.name || 'Неизвестный объект'}</p>
                        </div>
                    </div>
                  )}
                  {item.catalog?.description && (
                      <div className="p-4 text-sm text-slate-600 italic border-t border-slate-100">
                          {item.catalog.description}
                      </div>
                  )}
              </div>
            </section>

            {/* Timeline / History */}
            <section className="pb-4">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">История движения</h3>
              <div className="space-y-0 relative pl-2">
                <div className="absolute left-[19px] top-2 bottom-4 w-[2px] bg-slate-100"></div>

                {loading ? (
                    <div className="flex items-center gap-3 pl-8 py-2">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs text-slate-400">Загрузка истории...</span>
                    </div>
                ) : history.length === 0 ? (
                    <p className="text-xs text-slate-400 italic pl-8">История пуста</p>
                ) : (
                    history.map((event, idx) => {
                        const isFirst = idx === 0;
                        const icon = event.action_type === 'receive' ? 'add_box' : 
                                     event.action_type === 'deploy' ? 'local_shipping' : 
                                     event.action_type === 'scrap' ? 'delete' : 
                                     event.action_type === 'replace' ? 'autorenew' : 'history';
                        
                        const colorClass = event.action_type === 'receive' ? 'bg-emerald-100 text-emerald-600' :
                                           event.action_type === 'deploy' ? 'bg-blue-100 text-blue-600' :
                                           'bg-slate-100 text-slate-600';

                        return (
                          <div key={event.id} className="relative pl-10 pb-6 group last:pb-0">
                            <div className={`absolute left-0 top-0 w-10 h-10 rounded-full border-4 border-white flex items-center justify-center z-10 ${colorClass}`}>
                              <span className="material-icons-round text-lg">{icon}</span>
                            </div>
                            <div className="pt-1">
                              <div className="flex justify-between items-start">
                                  <p className={`text-sm font-bold ${isFirst ? 'text-slate-900' : 'text-slate-500'}`}>
                                    {event.action_type === 'receive' ? 'Приемка на склад' :
                                     event.action_type === 'deploy' ? 'Отгрузка' :
                                     event.action_type === 'scrap' ? 'Списание' :
                                     event.action_type === 'replace' ? 'Замена' : 'Действие'}
                                  </p>
                                  <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap bg-slate-50 px-2 py-0.5 rounded">
                                      {formatDate(event.created_at)}
                                  </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">{event.comment || 'Без комментария'}</p>
                              <div className="flex items-center gap-1 mt-2">
                                <span className="material-icons-round text-[10px] text-slate-300">person</span>
                                <p className="text-[10px] text-slate-400 font-medium">{event.profiles?.full_name || 'Система'}</p>
                              </div>
                            </div>
                          </div>
                        );
                    })
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

// ВОТ ЭТА СТРОКА КРИТИЧЕСКИ ВАЖНА:
export default ItemDetailsDrawer;