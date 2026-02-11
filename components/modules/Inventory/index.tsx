
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Toast } from '../../ui';
import InventoryList from './InventoryList';
import InventoryModal from './InventoryModal';
import { InventoryCatalogItem, InventoryItem } from '../../../types';

export interface CartItem {
  id: string;
  catalog_name: string;
  quantity: number; // Сколько отгружаем
  max_quantity: number; // Сколько есть всего
  serial_number?: string;
  unit: string;
  purchase_price?: number;
  catalog_id: string; // Нужно для логики разделения
}

type Tab = 'catalog' | 'stock' | 'warranty';

const Inventory: React.FC<{ profile: any }> = ({ profile }) => {
  const [activeTab, setActiveTab] = useState<Tab>('stock');
  const [loading, setLoading] = useState(false);
  
  const [catalog, setCatalog] = useState<InventoryCatalogItem[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [objects, setObjects] = useState<any[]>([]);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create_catalog' | 'add_item' | 'deploy_item' | 'replace_item' | 'edit_catalog' | 'edit_item' | 'return_item'>('add_item');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, itemsRes, objRes] = await Promise.all([
        supabase.from('inventory_catalog').select('*').eq('is_deleted', false).order('name'),
        supabase.from('inventory_items')
          .select('*, catalog:inventory_catalog(*), object:objects(id, name)')
          .eq('is_deleted', false)
          .order('created_at', { ascending: false }),
        supabase.from('objects').select('id, name').is('is_deleted', false).order('name')
      ]);

      if (catRes.data) {
        // Явное приведение типов или маппинг для соответствия InventoryCatalogItem
        const mappedCatalog: InventoryCatalogItem[] = catRes.data.map((c: any) => ({
          ...c,
          // Гарантируем, что item_type соответствует литеральному типу
          item_type: (c.item_type === 'material' ? 'material' : 'product'),
          sku: c.sku || null,
          unit: c.unit || null,
          description: c.description || null
        }));
        setCatalog(mappedCatalog);
      }

      if (itemsRes.data) {
        // Явное приведение для элементов склада
        const mappedItems: InventoryItem[] = itemsRes.data.map((i: any) => ({
          ...i,
          // Убеждаемся, что статус валиден
          status: ['in_stock', 'deployed', 'maintenance', 'scrapped'].includes(i.status) ? i.status : 'in_stock',
          serial_number: i.serial_number || null,
          catalog: i.catalog ? {
             ...i.catalog,
             item_type: i.catalog.item_type === 'material' ? 'material' : 'product'
          } : undefined
        }));
        setItems(mappedItems);
      }
      
      if (objRes.data) setObjects(objRes.data);
    } catch (e) {
      console.error(e);
      setToast({ message: 'Ошибка загрузки данных склада', type: 'error' });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Cart Handlers
  const addToCart = (item: InventoryItem) => {
    if (cart.find(c => c.id === item.id)) {
      setToast({ message: 'Товар уже в корзине', type: 'error' });
      return;
    }
    const newItem: CartItem = {
      id: item.id,
      catalog_name: item.catalog?.name || 'Неизвестный товар',
      quantity: item.quantity, // По умолчанию берем всё доступное количество
      max_quantity: item.quantity,
      serial_number: item.serial_number || undefined,
      unit: item.catalog?.unit || 'шт',
      purchase_price: item.purchase_price || 0,
      catalog_id: item.catalog_id
    };
    setCart(prev => [...prev, newItem]);
    setToast({ message: 'Добавлено в выборку', type: 'success' });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(c => c.id !== id));
  };

  const openCartDeployment = () => {
    if (cart.length === 0) return;
    setSelectedItem(null); // Explicitly null because we use cartItems
    setModalMode('deploy_item');
    setIsModalOpen(true);
  };

  const handleDeleteCatalog = async (id: string) => {
    // Optimistic update
    setCatalog(prev => prev.filter(c => c.id !== id));
    
    try {
        const now = new Date().toISOString();
        // Soft delete items first with timestamp
        await supabase.from('inventory_items').update({ is_deleted: true, deleted_at: now }).eq('catalog_id', id);
        // Soft delete catalog with timestamp
        await supabase.from('inventory_catalog').update({ is_deleted: true, deleted_at: now }).eq('id', id);
        
        setToast({ message: 'Категория и связанные товары перемещены в корзину', type: 'success' });
    } catch (e) {
        console.error(e);
        setToast({ message: 'Ошибка при удалении', type: 'error' });
        fetchData(); // Revert on error
    }
  };

  const handleDeleteItem = async (id: string) => {
    // Optimistic update
    setItems(prev => prev.filter(i => i.id !== id));

    try {
        // Soft delete with explicit timestamp
        await supabase.from('inventory_items')
          .update({ is_deleted: true, deleted_at: new Date().toISOString() })
          .eq('id', id);
        
        // Log history
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
        fetchData(); // Revert on error
    }
  };

  const openModal = (mode: 'create_catalog' | 'add_item' | 'deploy_item' | 'replace_item' | 'edit_catalog' | 'edit_item' | 'return_item', item: any | null = null) => {
    setModalMode(mode);
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleSuccess = (keepOpen = false) => {
    fetchData();
    if (!keepOpen) {
        setIsModalOpen(false);
        // Очищаем корзину только если это была групповая отгрузка и окно закрылось
        if (modalMode === 'deploy_item' && cart.length > 0) {
            setCart([]);
        }
    }
    setToast({ message: 'Операция выполнена успешно', type: 'success' });
  };

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f]">Склад и Гарантия</h2>
          <p className="text-sm text-slate-500 mt-1">Управление оборудованием, отгрузками и сервисным обслуживанием</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'catalog' && (
            <Button icon="add" onClick={() => openModal('create_catalog')}>Новый тип оборудования</Button>
          )}
          {activeTab === 'stock' && (
            <Button icon="download" onClick={() => openModal('add_item')}>Принять на склад</Button>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-6 bg-slate-100 p-1.5 rounded-full w-fit">
        <button onClick={() => setActiveTab('stock')} className={`px-5 py-2 rounded-full text-xs font-bold uppercase transition-all ${activeTab === 'stock' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Склад / Отгрузки</button>
        <button onClick={() => setActiveTab('warranty')} className={`px-5 py-2 rounded-full text-xs font-bold uppercase transition-all ${activeTab === 'warranty' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Гарантия / Сервис</button>
        <button onClick={() => setActiveTab('catalog')} className={`px-5 py-2 rounded-full text-xs font-bold uppercase transition-all ${activeTab === 'catalog' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Каталог (Номенклатура)</button>
      </div>

      <InventoryList 
        activeTab={activeTab} 
        catalog={catalog} 
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
        onEdit={(item, type) => openModal(type === 'catalog' ? 'edit_catalog' : 'edit_item', item)}
        onRefresh={fetchData}
        onDeleteItem={handleDeleteItem}
        onDeleteCatalog={handleDeleteCatalog}
      />

      <InventoryModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        mode={modalMode}
        catalog={catalog}
        objects={objects}
        selectedItem={selectedItem}
        cartItems={cart.length > 0 && modalMode === 'deploy_item' && !selectedItem ? cart : []} // Pass cart only if no single item selected
        items={items}
        profile={profile}
        onSuccess={handleSuccess}
      />
    </div>
  );
};

export default Inventory;
