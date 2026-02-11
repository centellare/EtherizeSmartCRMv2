
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Toast } from '../../ui';
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
  const [activeTab, setActiveTab] = useState<Tab>('stock');
  const [loading, setLoading] = useState(false);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [objects, setObjects] = useState<any[]>([]);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add_item' | 'deploy_item' | 'replace_item' | 'edit_item' | 'return_item'>('add_item');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const fetchData = async () => {
    if (activeTab === 'orders') return; // SupplyOrders fetches its own data
    
    setLoading(true);
    try {
      const [prodRes, itemsRes, objRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_archived', false).order('name'),
        supabase.from('inventory_items')
          .select('*, product:products(*), object:objects(id, name)')
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase.from('objects').select('id, name').is('is_deleted', false).order('name')
      ]);

      if (prodRes.data) setProducts(prodRes.data as unknown as Product[]);
      if (itemsRes.data) {
          // Cast data safely to InventoryItem[], assuming application logic ensures data integrity
          setItems(itemsRes.data as unknown as InventoryItem[]);
      }
      if (objRes.data) setObjects(objRes.data);
    } catch (e) {
      console.error(e);
      setToast({ message: 'Ошибка загрузки данных', type: 'error' });
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [activeTab]);

  const addToCart = (item: InventoryItem) => {
    if (cart.find(c => c.id === item.id)) {
      setToast({ message: 'Товар уже в корзине', type: 'error' });
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
    setToast({ message: 'Добавлено в выборку', type: 'success' });
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.id !== id));

  const openCartDeployment = () => {
    if (cart.length === 0) return;
    setSelectedItem(null);
    setModalMode('deploy_item');
    setIsModalOpen(true);
  };

  const handleDeleteItem = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    try {
        await supabase.from('inventory_items').update({ deleted_at: new Date().toISOString() }).eq('id', id);
        
        await supabase.from('inventory_history').insert([{
            item_id: id,
            action_type: 'scrap',
            created_by: profile.id,
            comment: `Перемещено в корзину пользователем ${profile.full_name || 'System'}`
        }]);
        setToast({ message: 'Единица товара перемещена в корзину', type: 'success' });
    } catch (e) {
        console.error(e);
        setToast({ message: 'Ошибка при удалении', type: 'error' });
        fetchData();
    }
  };

  const openModal = (mode: typeof modalMode, item: any | null = null) => {
    setModalMode(mode);
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleSuccess = (keepOpen = false) => {
    fetchData(); 
    if (!keepOpen) {
        setIsModalOpen(false);
        if (modalMode === 'deploy_item' && cart.length > 0) setCart([]);
    }
    setToast({ message: 'Операция выполнена успешно', type: 'success' });
  };

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f]">Склад и Номенклатура</h2>
          <p className="text-sm text-slate-500 mt-1">Управление остатками, товарами и закупками</p>
        </div>
        {activeTab === 'stock' && (
          <div className="flex gap-2">
            <Button icon="download" onClick={() => openModal('add_item')}>Принять на склад</Button>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-6 bg-slate-100 p-1.5 rounded-full w-fit overflow-x-auto">
        <button onClick={() => setActiveTab('stock')} className={`px-5 py-2 rounded-full text-xs font-bold uppercase transition-all ${activeTab === 'stock' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Склад / Отгрузки</button>
        <button onClick={() => setActiveTab('orders')} className={`px-5 py-2 rounded-full text-xs font-bold uppercase transition-all ${activeTab === 'orders' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Заказы (Дефицит)</button>
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
          loading={loading} 
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
        mode={modalMode}
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
