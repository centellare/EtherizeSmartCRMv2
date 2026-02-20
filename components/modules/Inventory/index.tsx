
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { Button, useToast } from '../../ui';
import InventoryList from './InventoryList';
import InventoryModal from './InventoryModal';
import Nomenclature from './Nomenclature';
import SupplyOrders from './SupplyOrders';
import { Product, InventoryItem } from '../../../types';

export interface CartItem {
  id: string;
  product_name: string;
  quantity: number;
  max_quantity: number;
  serial_number?: string;
  unit: string;
  purchase_price?: number;
  product_id: string;
}

type Tab = 'stock' | 'nomenclature' | 'warranty' | 'orders';

const Inventory: React.FC<{ profile: any }> = ({ profile }) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('stock');
  
  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add_item' | 'deploy_item' | 'replace_item' | 'edit_item' | 'return_item' | 'deploy_invoice'>('add_item');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const toast = useToast();

  // --- QUERIES ---

  const { data: pendingOrdersCount = 0 } = useQuery({
    queryKey: ['supply_orders_count'],
    queryFn: async () => {
      const { count } = await supabase.from('supply_orders').select('*', { count: 'exact', head: true }).neq('status', 'received');
      return count || 0;
    },
    // Refetch often as orders change frequently
    refetchInterval: 30000 
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').eq('is_archived', false).order('name');
      return (data as unknown as Product[]) || [];
    },
    enabled: activeTab !== 'orders'
  });

  const { data: items = [], isLoading: isItemsLoading } = useQuery({
    queryKey: ['inventory_items'],
    queryFn: async () => {
      const { data } = await supabase
        .from('inventory_items')
        .select('*, product:products(*), object:objects(id, name), invoice:invoices(number)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      return (data as unknown as InventoryItem[]) || [];
    },
    enabled: activeTab !== 'orders'
  });

  const { data: objects = [] } = useQuery({
    queryKey: ['objects_list'],
    queryFn: async () => {
      const { data } = await supabase.from('objects').select('id, name').is('is_deleted', false).order('name');
      return data || [];
    },
    enabled: activeTab !== 'orders'
  });

  // Realtime subscription for inventory items
  useEffect(() => {
    const channel = supabase.channel('inventory_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ['inventory_items'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const addToCart = (item: InventoryItem) => {
    if (cart.find(c => c.id === item.id)) {
      toast.error('Товар уже в корзине');
      return;
    }
    const newItem: CartItem = {
      id: item.id,
      product_name: item.product?.name || 'Неизвестный товар',
      quantity: item.quantity,
      max_quantity: item.quantity,
      serial_number: item.serial_number || undefined,
      unit: item.product?.unit || 'шт',
      purchase_price: item.purchase_price || 0,
      product_id: item.product_id
    };
    setCart(prev => [...prev, newItem]);
    toast.success('Добавлено в ручную отгрузку');
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.id !== id));

  const openCartDeployment = () => {
    if (cart.length === 0) return;
    setSelectedItem(null);
    setModalMode('deploy_item');
    setIsModalOpen(true);
  };

  const handleDeleteItem = async (id: string) => {
    // Optimistic update handled by invalidation, but we can also set toast
    try {
        await supabase.from('inventory_items').update({ deleted_at: new Date().toISOString() }).eq('id', id);
        
        await supabase.from('inventory_history').insert([{
            item_id: id,
            action_type: 'scrap',
            created_by: profile.id,
            comment: `Перемещено в корзину пользователем ${profile.full_name || 'System'}`
        }]);
        toast.success('Единица товара перемещена в корзину');
        queryClient.invalidateQueries({ queryKey: ['inventory_items'] });
    } catch (e) {
        console.error(e);
        toast.error('Ошибка при удалении');
    }
  };

  const openModal = (mode: typeof modalMode, item: any | null = null) => {
    setModalMode(mode);
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleSuccess = (keepOpen = false) => {
    queryClient.invalidateQueries({ queryKey: ['inventory_items'] });
    if (!keepOpen) {
        setIsModalOpen(false);
        if (modalMode === 'deploy_item' && cart.length > 0) setCart([]);
    }
    toast.success('Операция выполнена успешно');
  };

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f]">Склад и Номенклатура</h2>
          <p className="text-sm text-slate-500 mt-1">Управление остатками, товарами и закупками</p>
        </div>
        {activeTab === 'stock' && (
          <div className="flex gap-2">
            <Button icon="add" onClick={() => openModal('add_item')} variant="secondary">Принять на склад</Button>
            {/* Primary Action is now Invoice Deployment */}
            <Button icon="receipt_long" onClick={() => openModal('deploy_invoice')} className="shadow-lg shadow-blue-200">Отгрузка по счету</Button>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-6 bg-slate-100 p-1.5 rounded-full w-fit overflow-x-auto">
        <button onClick={() => setActiveTab('stock')} className={`px-5 py-2 rounded-full text-xs font-bold uppercase transition-all ${activeTab === 'stock' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Склад / Отгрузки</button>
        <button onClick={() => setActiveTab('orders')} className={`px-5 py-2 rounded-full text-xs font-bold uppercase transition-all flex items-center gap-2 ${activeTab === 'orders' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
            Заказы (Дефицит)
            {pendingOrdersCount > 0 && (
                <span className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                    {pendingOrdersCount}
                </span>
            )}
        </button>
        <button onClick={() => setActiveTab('nomenclature')} className={`px-5 py-2 rounded-full text-xs font-bold uppercase transition-all ${activeTab === 'nomenclature' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Номенклатура</button>
        <button onClick={() => setActiveTab('warranty')} className={`px-5 py-2 rounded-full text-xs font-bold uppercase transition-all ${activeTab === 'warranty' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Гарантия / Сервис</button>
      </div>

      {activeTab === 'nomenclature' ? (
        <Nomenclature profile={profile} />
      ) : activeTab === 'orders' ? (
        <SupplyOrders profile={profile} />
      ) : (
        <InventoryList 
          activeTab={activeTab} 
          items={items} 
          loading={isItemsLoading} 
          profile={profile}
          cart={cart}
          onAddToCart={addToCart}
          onRemoveFromCart={removeFromCart}
          onBulkDeploy={openCartDeployment}
          onDeploy={(item) => openModal('deploy_item', item)}
          onReplace={(item) => openModal('replace_item', item)}
          onReturn={(item) => openModal('return_item', item)}
          onEdit={(item) => openModal('edit_item', item)}
          onDeleteItem={handleDeleteItem}
        />
      )}

      <InventoryModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        mode={modalMode as any}
        products={products}
        objects={objects}
        selectedItem={selectedItem}
        cartItems={cart} 
        items={items}
        profile={profile}
        onSuccess={handleSuccess}
      />
    </div>
  );
};

export default Inventory;
