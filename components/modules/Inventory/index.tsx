
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Toast } from '../../ui';
import InventoryList from './InventoryList';
import InventoryModal from './InventoryModal';
import { InventoryCatalogItem, InventoryItem } from '../../../types';

type Tab = 'catalog' | 'stock' | 'warranty';

const Inventory: React.FC<{ profile: any }> = ({ profile }) => {
  const [activeTab, setActiveTab] = useState<Tab>('stock');
  const [loading, setLoading] = useState(false);
  
  const [catalog, setCatalog] = useState<InventoryCatalogItem[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [objects, setObjects] = useState<any[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create_catalog' | 'add_item' | 'deploy_item' | 'replace_item' | 'edit_catalog' | 'edit_item'>('add_item');
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

      if (catRes.data) setCatalog(catRes.data);
      if (itemsRes.data) setItems(itemsRes.data);
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

  const handleDeleteCatalog = async (id: string) => {
    // Optimistic update
    setCatalog(prev => prev.filter(c => c.id !== id));
    
    try {
        const now = new Date().toISOString();
        // Soft delete items first
        await supabase.from('inventory_items').update({ is_deleted: true, deleted_at: now }).eq('catalog_id', id);
        // Soft delete catalog
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
        // Soft delete
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

  const openModal = (mode: 'create_catalog' | 'add_item' | 'deploy_item' | 'replace_item' | 'edit_catalog' | 'edit_item', item: any | null = null) => {
    setModalMode(mode);
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleSuccess = () => {
    fetchData();
    setIsModalOpen(false);
    setToast({ message: 'Операция выполнена успешно', type: 'success' });
  };

  return (
    <div className="animate-in fade-in duration-500">
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
        onDeploy={(item) => openModal('deploy_item', item)}
        onReplace={(item) => openModal('replace_item', item)}
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
        items={items}
        profile={profile}
        onSuccess={handleSuccess}
      />
    </div>
  );
};

export default Inventory;
