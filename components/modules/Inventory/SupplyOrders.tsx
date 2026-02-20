
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Badge, Button, ConfirmModal, useToast } from '../../ui';
import { formatDate } from '../../../lib/dateUtils';
import InventoryModal from './InventoryModal';

const SupplyOrders: React.FC<{ profile: any }> = ({ profile }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [selectedSupplyItem, setSelectedSupplyItem] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]); // Need for modal mapping

  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
      const { data } = await supabase.from('products').select('*');
      setProducts(data || []);
  };

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('supply_orders')
      .select('*, items:supply_order_items(*, product:products(*)), invoice:invoices(number, client:clients(name))')
      .order('created_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  const handleUpdateStatus = async (itemId: string, newStatus: string) => {
      await supabase.from('supply_order_items').update({ status: newStatus }).eq('id', itemId);
      fetchOrders();
  };

  const handleDeleteOrder = async () => {
      if (!deleteConfirm.id) return;
      setLoading(true);
      try {
          // Delete items first manually to be safe
          await supabase.from('supply_order_items').delete().eq('supply_order_id', deleteConfirm.id);
          // Delete the order itself
          const { error } = await supabase.from('supply_orders').delete().eq('id', deleteConfirm.id);
          
          if (error) throw error;
          
          toast.success('Заказ на закупку удален');
          fetchOrders();
      } catch (e: any) {
          console.error(e);
          toast.error('Ошибка удаления: ' + e.message);
      } finally {
          setLoading(false);
          setDeleteConfirm({ open: false, id: null });
      }
  };

  const openReceiveModal = (item: any) => {
      setSelectedSupplyItem(item);
      setIsModalOpen(true);
  };

  const handleSuccess = () => {
      toast.success('Товар принят на склад');
      setIsModalOpen(false);
      fetchOrders();
  };

  if (loading && orders.length === 0) return <div className="p-10 text-center"><div className="w-8 h-8 border-4 border-blue-600 rounded-full animate-spin mx-auto"></div></div>;

  return (
    <div className="space-y-6">
        
        {orders.length === 0 ? (
            <div className="p-10 text-center text-slate-400 bg-white rounded-[32px] border border-dashed border-slate-200">
                Дефицита товаров не обнаружено. Все заказы укомплектованы.
            </div>
        ) : (
            <div className="grid grid-cols-1 gap-4">
                {orders.map(order => (
                    <div key={order.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm group">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="font-bold text-lg text-slate-900">Заказ под счет №{order.invoice?.number}</h4>
                                <p className="text-sm text-slate-500">Клиент: {order.invoice?.client?.name}</p>
                                <p className="text-xs text-slate-400 mt-1">Создан: {formatDate(order.created_at)}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Badge color={order.status === 'received' ? 'emerald' : 'amber'}>{order.status === 'received' ? 'Поступил' : 'В работе'}</Badge>
                                <button 
                                    onClick={() => setDeleteConfirm({ open: true, id: order.id })}
                                    className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                                    title="Удалить заказ"
                                >
                                    <span className="material-icons-round text-sm">delete</span>
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="p-3 text-xs font-bold text-slate-500 uppercase">Товар</th>
                                        <th className="p-3 text-xs font-bold text-slate-500 uppercase text-center">Нужно</th>
                                        <th className="p-3 text-xs font-bold text-slate-500 uppercase text-center">Статус</th>
                                        <th className="p-3 text-right">Действия</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {order.items.map((item: any) => (
                                        <tr key={item.id}>
                                            <td className="p-3">
                                                <p className="font-bold text-slate-900">{item.product?.name}</p>
                                                <p className="text-[10px] text-slate-400">{item.product?.sku}</p>
                                            </td>
                                            <td className="p-3 text-center font-bold">{item.quantity_needed} {item.product?.unit}</td>
                                            <td className="p-3 text-center">
                                                <Badge color={item.status === 'received' ? 'emerald' : item.status === 'ordered' ? 'blue' : 'red'}>
                                                    {item.status === 'received' ? 'На складе' : item.status === 'ordered' ? 'Заказано' : 'Не заказано'}
                                                </Badge>
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {item.status === 'pending' && (
                                                        <Button variant="tonal" className="h-8 px-3 text-[10px]" onClick={() => handleUpdateStatus(item.id, 'ordered')}>Заказал</Button>
                                                    )}
                                                    {item.status === 'ordered' && (
                                                        <Button className="h-8 px-3 text-[10px]" onClick={() => openReceiveModal(item)}>Принять</Button>
                                                    )}
                                                    {item.status === 'received' && (
                                                        <span className="text-[10px] text-emerald-600 font-bold flex items-center justify-end gap-1">
                                                            <span className="material-icons-round text-sm">check_circle</span> Принято
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>
        )}

        <InventoryModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            mode="receive_supply"
            products={products}
            objects={[]} // Not needed for receiving to stock (it goes to stock first)
            items={[]} // Not needed
            selectedItem={selectedSupplyItem}
            profile={profile}
            onSuccess={() => handleSuccess()}
        />

        <ConfirmModal 
            isOpen={deleteConfirm.open}
            onClose={() => setDeleteConfirm({ open: false, id: null })}
            onConfirm={handleDeleteOrder}
            title="Удаление заказа"
            message="Вы уверены? Это удалит заказ на закупку и освободит привязку к счету."
            confirmVariant="danger"
            loading={loading}
        />
    </div>
  );
};

export default SupplyOrders;
