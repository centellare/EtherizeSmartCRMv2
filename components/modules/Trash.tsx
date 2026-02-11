
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Badge, ConfirmModal, Select, Input } from '../ui';

type TrashItem = {
  id: string;
  name: string;
  type: string;
  table: string;
  deleted_at: string;
};

const Trash: React.FC<{ profile: any }> = ({ profile }) => {
  const [deletedItems, setDeletedItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState('all');
  
  // Modals
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; item: TrashItem | null }>({ open: false, item: null });
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);

  const isAdmin = profile?.role === 'admin';

  const fetchDeleted = async () => {
    setLoading(true);
    const [
      { data: objects }, 
      { data: clients }, 
      { data: tasks }, 
      { data: transactions },
      { data: inventoryItems }
    ] = await Promise.all([
      supabase.from('objects').select('id, name, deleted_at').is('is_deleted', true),
      supabase.from('clients').select('id, name, deleted_at').not('deleted_at', 'is', null),
      supabase.from('tasks').select('id, title, deleted_at').is('is_deleted', true),
      supabase.from('transactions').select('id, category, amount, type, deleted_at').not('deleted_at', 'is', null),
      // CHANGED: Use deleted_at and join with PRODUCTS instead of catalog
      supabase.from('inventory_items')
        .select('id, serial_number, deleted_at, product:products(name, unit)')
        .not('deleted_at', 'is', null)
    ]);
    
    const combined: TrashItem[] = [
      ...(objects || []).map(i => ({ id: i.id, name: i.name, type: 'Объект', table: 'objects', deleted_at: i.deleted_at || '' })),
      ...(clients || []).map(i => ({ id: i.id, name: i.name, type: 'Клиент', table: 'clients', deleted_at: i.deleted_at || '' })),
      ...(tasks || []).map(i => ({ id: i.id, name: i.title, type: 'Задача', table: 'tasks', deleted_at: i.deleted_at || '' })),
      ...(transactions || []).map(i => ({ 
        id: i.id,
        name: `${i.type === 'income' ? 'Приход' : 'Расход'}: ${i.category} (${i.amount} BYN)`, 
        type: 'Финансы', 
        table: 'transactions',
        deleted_at: i.deleted_at || ''
      })),
      ...(inventoryItems || []).map((i: any) => ({ 
        id: i.id, 
        name: `${i.product?.name || 'Товар'} ${i.serial_number ? `(S/N: ${i.serial_number})` : ''}`, 
        type: 'Товар со склада', 
        table: 'inventory_items', 
        deleted_at: i.deleted_at || '' 
      })),
    ];
    setDeletedItems(combined.sort((a,b) => new Date(b.deleted_at || 0).getTime() - new Date(a.deleted_at || 0).getTime()));
    setLoading(false);
  };

  useEffect(() => { fetchDeleted(); }, []);

  const filteredItems = useMemo(() => {
    if (filterType === 'all') return deletedItems;
    return deletedItems.filter(item => {
      if (filterType === 'objects') return item.table === 'objects';
      if (filterType === 'clients') return item.table === 'clients';
      if (filterType === 'tasks') return item.table === 'tasks';
      if (filterType === 'finances') return item.table === 'transactions';
      if (filterType === 'inventory') return item.table === 'inventory_items';
      return true;
    });
  }, [deletedItems, filterType]);

  const toggleSelect = (table: string, id: string) => {
    const key = `${table}:${id}`;
    const next = new Set(selectedIds);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(i => `${i.table}:${i.id}`)));
    }
  };

  const handleRestore = async (id: string, table: string) => {
    setLoading(true);
    // Determine which field to use for restoration
    const usesDeletedAt = ['clients', 'transactions', 'inventory_items'].includes(table);
    const field = usesDeletedAt ? 'deleted_at' : 'is_deleted';
    const value = usesDeletedAt ? null : false;
    
    const updates: any = { [field]: value };
    // Legacy support for older tables (objects/tasks) that might have both or depend on is_deleted
    if (field === 'is_deleted') {
       updates.deleted_at = null;
    }

    // Explicitly cast table to any to bypass strict typing for dynamic string
    await supabase.from(table as any).update(updates).eq('id', id);
    await fetchDeleted();
    setLoading(false);
  };

  const handleHardDelete = async (id: string, table: string) => {
    setLoading(true);
    
    // 1. Очистка зависимостей для товара
    if (table === 'inventory_items') {
      await supabase.from('inventory_history').delete().eq('item_id', id);
    }

    // Explicitly cast table to any to bypass strict typing for dynamic string
    await supabase.from(table as any).delete().eq('id', id);
    setDeleteConfirm({ open: false, item: null });
    await fetchDeleted();
    setLoading(false);
  };

  const handleBulkAction = async (action: 'restore' | 'delete') => {
    setLoading(true);
    const grouped: Record<string, string[]> = {};
    selectedIds.forEach(key => {
      const [table, id] = key.split(':');
      if (!grouped[table]) grouped[table] = [];
      grouped[table].push(id);
    });

    for (const table in grouped) {
      const ids = grouped[table];
      if (action === 'restore') {
        const usesDeletedAt = ['clients', 'transactions', 'inventory_items'].includes(table);
        const field = usesDeletedAt ? 'deleted_at' : 'is_deleted';
        const value = usesDeletedAt ? null : false;
        
        const updates: any = { [field]: value };
        if (field === 'is_deleted') {
           updates.deleted_at = null;
        }

        await supabase.from(table as any).update(updates).in('id', ids);
      } else {
        // Очистка зависимостей при массовом удалении
        // Товары
        if (table === 'inventory_items') {
           await supabase.from('inventory_history').delete().in('item_id', ids);
        }

        await supabase.from(table as any).delete().in('id', ids);
      }
    }

    setSelectedIds(new Set());
    setBulkDeleteConfirm(false);
    await fetchDeleted();
    setLoading(false);
  };

  const handleClearTrash = async () => {
    setLoading(true);
    const grouped: Record<string, string[]> = {};
    filteredItems.forEach(i => {
      if (!grouped[i.table]) grouped[i.table] = [];
      grouped[i.table].push(i.id);
    });

    for (const table in grouped) {
      const ids = grouped[table];

      // Очистка зависимостей при полной очистке
      if (table === 'inventory_items') {
         await supabase.from('inventory_history').delete().in('item_id', ids);
      }

      await supabase.from(table as any).delete().in('id', ids);
    }

    setClearAllConfirm(false);
    await fetchDeleted();
    setLoading(false);
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f]">Корзина</h2>
          <p className="text-slate-500 text-sm mt-1">Восстановление и окончательное удаление данных</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <div className="w-48">
            <Select 
              value={filterType}
              onChange={(e: any) => setFilterType(e.target.value)}
              options={[
                { value: 'all', label: 'Все типы' },
                { value: 'objects', label: 'Объекты' },
                { value: 'clients', label: 'Клиенты' },
                { value: 'tasks', label: 'Задачи' },
                { value: 'finances', label: 'Финансы' },
                { value: 'inventory', label: 'Склад' }
              ]}
              icon="filter_list"
              className="!h-11"
            />
          </div>
          {isAdmin && (
            <Button 
              variant="danger" 
              icon="delete_forever" 
              onClick={() => setClearAllConfirm(true)}
              disabled={filteredItems.length === 0 || loading}
              className="h-11"
            >
              Очистить всё
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-[#e1e2e1] overflow-hidden shadow-sm relative">
        {selectedIds.size > 0 && (
          <div className="absolute top-0 left-0 w-full bg-[#d3e4ff] px-6 py-3 z-10 flex items-center justify-between animate-in slide-in-from-top-4 duration-200">
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-[#001d3d]">Выбрано: {selectedIds.size}</span>
              <Button variant="ghost" className="h-8 text-xs !text-[#001d3d]" onClick={() => setSelectedIds(new Set())}>Отменить</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="tonal" className="h-9 text-xs" icon="history" onClick={() => handleBulkAction('restore')} loading={loading}>Восстановить</Button>
              {isAdmin && <Button variant="danger" className="h-9 text-xs" icon="delete_forever" onClick={() => setBulkDeleteConfirm(true)} loading={loading}>Удалить навсегда</Button>}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Элемент</th>
                <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Тип</th>
                <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Дата удаления</th>
                <th className="p-5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredItems.map(item => {
                const isSelected = selectedIds.has(`${item.table}:${item.id}`);
                return (
                  <tr key={`${item.table}-${item.id}`} className={`hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                    <td className="p-4 text-center">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => toggleSelect(item.table, item.id)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="p-5 font-bold text-slate-900">{item.name}</td>
                    <td className="p-5">
                      <Badge color={
                        item.table === 'transactions' ? 'emerald' : 
                        item.table === 'objects' ? 'blue' : 
                        item.table === 'inventory_items' ? 'amber' : 'slate'
                      }>
                        {item.type}
                      </Badge>
                    </td>
                    <td className="p-5 text-xs text-slate-500">
                      {item.deleted_at ? new Date(item.deleted_at).toLocaleString() : '—'}
                    </td>
                    <td className="p-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleRestore(item.id, item.table)}
                          className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all"
                          title="Восстановить"
                        >
                          <span className="material-icons-round text-sm">history</span>
                        </button>
                        {isAdmin && (
                          <button 
                            onClick={() => setDeleteConfirm({ open: true, item })}
                            className="w-9 h-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all"
                            title="Удалить навсегда"
                          >
                            <span className="material-icons-round text-sm">delete_forever</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="p-20 text-center">
                    <div className="flex flex-col items-center opacity-20">
                      <span className="material-icons-round text-6xl mb-4">delete_sweep</span>
                      <p className="text-lg font-medium italic">Корзина пуста</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal 
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, item: null })}
        onConfirm={() => deleteConfirm.item && handleHardDelete(deleteConfirm.item.id, deleteConfirm.item.table)}
        title="Окончательное удаление"
        message={`Вы уверены, что хотите навсегда удалить "${deleteConfirm.item?.name}"? Это действие нельзя отменить.`}
        confirmLabel="Удалить навсегда"
        confirmVariant="danger"
        loading={loading}
      />

      <ConfirmModal 
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={() => handleBulkAction('delete')}
        title="Массовое удаление"
        message={`Вы уверены, что хотите навсегда удалить выбранные элементы (${selectedIds.size} шт.)? Данные будут потеряны безвозвратно.`}
        confirmLabel="Удалить выбранное"
        confirmVariant="danger"
        loading={loading}
      />

      <ConfirmModal 
        isOpen={clearAllConfirm}
        onClose={() => setClearAllConfirm(false)}
        onConfirm={handleClearTrash}
        title="Очистка корзины"
        message="Вы собираетесь безвозвратно удалить ВСЕ элементы, соответствующие текущему фильтру. Продолжить?"
        confirmLabel="Очистить корзину"
        confirmVariant="danger"
        loading={loading}
      />
    </div>
  );
};

export default Trash;
