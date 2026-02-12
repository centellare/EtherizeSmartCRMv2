
import React, { useState, useMemo } from 'react';
import { InventoryItem } from '../../../types';
import { CartItem } from './index';
import { Badge, Input, Button, ConfirmModal } from '../../ui';
import { formatDate, getMinskISODate } from '../../../lib/dateUtils';
import ItemDetailsDrawer from './ItemDetailsDrawer';
import { supabase } from '../../../lib/supabase'; // Import supabase

interface InventoryListProps {
  activeTab: 'stock' | 'warranty';
  items: InventoryItem[];
  loading: boolean;
  profile: any;
  cart: CartItem[];
  onAddToCart: (item: InventoryItem) => void;
  onRemoveFromCart: (id: string) => void;
  onBulkDeploy: () => void;
  onDeploy: (item: InventoryItem) => void;
  onReplace: (item: InventoryItem) => void;
  onReturn: (item: InventoryItem) => void;
  onEdit: (item: any) => void;
  onDeleteItem: (id: string) => void;
}

const InventoryList: React.FC<InventoryListProps> = ({ 
  activeTab, items, loading, profile, 
  cart, onAddToCart, onRemoveFromCart, onBulkDeploy,
  onDeploy, onReplace, onReturn, onEdit, onDeleteItem
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<InventoryItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const isAdmin = profile?.role === 'admin';

  // Handler for Unreserve
  const handleUnreserve = async (itemId: string) => {
      if(!window.confirm('Снять резерв с товара? Он станет доступен для использования.')) return;
      try {
          const { error } = await supabase.from('inventory_items').update({
              status: 'in_stock',
              reserved_for_invoice_id: null
          }).eq('id', itemId);
          
          if(error) throw error;
          // Optimistic update or page reload required from parent, but for now we can rely on parent refresh or alert
          // Ideally pass a refresh callback, but let's reload window or hack a re-fetch
          window.location.reload(); // Simple refresh for now as we don't have refresh prop here
      } catch (e: any) {
          alert('Ошибка: ' + e.message);
      }
  };

  const filteredItems = useMemo(() => {
    let list = items;
    // Basic Tab Filter
    if (activeTab === 'stock') {
        // Show in_stock AND reserved
        list = list.filter(i => i.status === 'in_stock' || i.status === 'reserved');
    } else if (activeTab === 'warranty') {
        // Show deployed/warranty items
        list = list.filter(i => i.status === 'deployed');
    }
    
    return list.filter(i => {
      // Safe access
      const productName = i.product?.name || `Товар #${i.product_id?.slice(0,4)}...`;
      const productSku = i.product?.sku || '';
      const serial = i.serial_number || '';
      const objName = i.object?.name || '';

      const matchSearch = 
        productName.toLowerCase().includes(search.toLowerCase()) || 
        productSku.toLowerCase().includes(search.toLowerCase()) ||
        serial.toLowerCase().includes(search.toLowerCase()) ||
        objName.toLowerCase().includes(search.toLowerCase());
      
      const matchStatus = statusFilter === 'all' || i.status === statusFilter;
      
      const targetDate = activeTab === 'warranty' ? i.warranty_start : i.created_at;
      const itemDate = targetDate ? getMinskISODate(targetDate) : null;
      const matchDateFrom = !dateFrom || (itemDate && itemDate >= dateFrom);
      const matchDateTo = !dateTo || (itemDate && itemDate <= dateTo);

      return matchSearch && matchStatus && matchDateFrom && matchDateTo;
    });
  }, [items, search, statusFilter, dateFrom, dateTo, activeTab]);

  // Grouping Logic for Stock Tab
  const stockGroups = useMemo(() => {
    if (activeTab !== 'stock') return [];
    
    const groups: Record<string, { 
      product: any, 
      totalQty: number,
      reservedQty: number, 
      totalValue: number, 
      items: InventoryItem[] 
    }> = {};

    filteredItems.forEach(item => {
      const pId = item.product_id;
      if (!groups[pId]) {
        groups[pId] = {
          product: item.product,
          totalQty: 0,
          reservedQty: 0,
          totalValue: 0,
          items: []
        };
      }
      
      const unitPrice = item.purchase_price || item.product?.base_price || 0;
      
      groups[pId].items.push(item);
      groups[pId].totalQty += item.quantity;
      if (item.status === 'reserved') {
          groups[pId].reservedQty += item.quantity;
      }
      groups[pId].totalValue += (item.quantity * unitPrice);
    });

    return Object.values(groups).sort((a,b) => (a.product?.name || '').localeCompare(b.product?.name || ''));
  }, [filteredItems, activeTab]);

  const totalSum = useMemo(() => {
    return filteredItems.reduce((acc, item) => {
        const price = item.purchase_price || item.product?.base_price || 0;
        return acc + (item.quantity * price);
    }, 0);
  }, [filteredItems]);

  const groupedWarrantyItems = useMemo(() => {
    if (activeTab !== 'warranty') return [];
    const groups: Record<string, { id: string; objectName: string; date: string; items: InventoryItem[] }> = {};

    filteredItems.forEach(item => {
      const dateKey = item.warranty_start ? getMinskISODate(item.warranty_start) : 'unknown';
      const objId = item.current_object_id || 'no-object';
      const key = `${objId}_${dateKey}`;

      if (!groups[key]) {
        groups[key] = {
          id: key,
          objectName: item.object?.name || 'Без объекта',
          date: item.warranty_start || new Date().toISOString(),
          items: []
        };
      }
      groups[key].items.push(item);
    });
    return Object.values(groups).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredItems, activeTab]);

  const toggleGroup = (productId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('ru-BY', { style: 'currency', currency: 'BYN', maximumFractionDigits: 2 }).format(val);

  if (loading && items.length === 0) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <div className="w-full md:w-80">
                <Input placeholder="Поиск по названию, S/N..." value={search} onChange={(e: any) => setSearch(e.target.value)} icon="search" className="h-11 !text-sm" />
            </div>
            <div className="flex items-center gap-2 bg-white rounded-2xl border border-slate-200 px-3 py-1 shadow-sm shrink-0 h-[44px]">
                <Input type="date" value={dateFrom} onChange={(e:any) => setDateFrom(e.target.value)} className="!border-0 !p-0 !h-auto !text-xs w-24 bg-transparent focus:ring-0" />
                <span className="text-slate-300 font-bold">-</span>
                <Input type="date" value={dateTo} onChange={(e:any) => setDateTo(e.target.value)} className="!border-0 !p-0 !h-auto !text-xs w-24 bg-transparent focus:ring-0" />
            </div>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-2 flex items-center justify-between gap-6 shrink-0 w-full xl:w-auto xl:ml-auto shadow-sm">
            <div className="flex flex-col">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Итого</span>
                <span className="text-[10px] font-medium text-blue-300">Оценка запасов</span>
            </div>
            <span className="text-xl font-bold text-blue-900">{formatCurrency(totalSum)}</span>
        </div>
      </div>

      {cart.length > 0 && activeTab === 'stock' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1c1b1f] text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-4">
           <div className="flex items-center gap-2">
             <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold">{cart.length}</div>
             <span className="text-sm font-medium">Выбрано</span>
           </div>
           <button onClick={onBulkDeploy} className="bg-white text-[#1c1b1f] px-4 py-2 rounded-full text-xs font-bold hover:bg-blue-50 transition-colors flex items-center gap-2">
             Отгрузить все <span className="material-icons-round text-sm">rocket_launch</span>
           </button>
        </div>
      )}

      {activeTab === 'warranty' ? (
        // --- WARRANTY TAB (Unchanged) ---
        <div className="space-y-4">
          {groupedWarrantyItems.map(group => (
            <details key={group.id} className="group bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all hover:shadow-sm">
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none bg-slate-50/50 hover:bg-slate-100/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-600 text-white p-2 rounded-xl shadow-sm"><span className="material-icons-round text-base">inventory_2</span></div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{group.objectName}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Отгрузка: {formatDate(group.date)} • {group.items.length} поз.</p>
                    </div>
                  </div>
                  <span className="material-icons-round text-slate-400 group-open:rotate-180 transition-transform">expand_more</span>
                </summary>
                <div className="p-0 border-t border-slate-100">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/30 text-[10px] text-slate-400 uppercase font-bold">
                      <tr><th className="pl-6 py-2">Товар</th><th className="py-2 text-center">Кол-во</th><th className="pr-6 py-2 text-right">Действия</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {group.items.map((item) => (
                        <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="pl-6 py-3 cursor-pointer" onClick={() => setSelectedDrawerItem(item)}>
                            <p className="text-xs font-bold text-slate-900">{item.product?.name || <span className="text-red-400 italic">Связь потеряна</span>}</p>
                            {item.serial_number && <p className="text-[10px] font-mono text-blue-600">S/N: {item.serial_number}</p>}
                          </td>
                          <td className="py-3 text-center"><Badge color="slate">{item.quantity} {item.product?.unit || 'шт'}</Badge></td>
                          <td className="pr-6 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <button onClick={() => onReturn(item)} className="p-1.5 hover:bg-orange-100 text-orange-600 rounded-lg"><span className="material-icons-round text-sm">settings_backup_restore</span></button>
                              <button onClick={() => onReplace(item)} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg"><span className="material-icons-round text-sm">swap_horiz</span></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            </details>
          ))}
        </div>
      ) : (
        // --- STOCK TAB (Grouped) ---
        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="p-4 w-12"></th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase">Номенклатура</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase">Артикул / Тип</th>
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase text-center">Всего</th>
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase text-center text-blue-600">В резерве</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase">Общая стоимость</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockGroups.length === 0 ? (
                    <tr>
                        <td colSpan={7} className="p-10 text-center text-slate-400">
                            {items.length > 0 ? 'Товары скрыты фильтрами' : 'Склад пуст'}
                        </td>
                    </tr>
                ) : (
                    stockGroups.map((group, groupIdx) => {
                      const productId = group.items[0].product_id;
                      const isExpanded = expandedGroups.has(productId);
                      const hasDifferentPrices = group.items.some(i => i.purchase_price !== group.items[0].purchase_price);

                      return (
                        <React.Fragment key={productId}>
                          {/* Group Header Row */}
                          <tr className={`transition-colors cursor-pointer group ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50'}`} onClick={() => toggleGroup(productId)}>
                            <td className="p-4 text-center">
                               <button className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center hover:bg-blue-100 hover:text-blue-600 transition-colors">
                                  <span className={`material-icons-round text-sm transition-transform ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                               </button>
                            </td>
                            <td className="p-4">
                                <p className="font-bold text-slate-900 text-sm">{group.product?.name || <span className="text-red-400">Удаленный товар</span>}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{group.items.length} партий</p>
                            </td>
                            <td className="p-4">
                                <div className="flex flex-col gap-1">
                                    {group.product?.sku && <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 w-fit">{group.product.sku}</span>}
                                    <span className="text-[10px] text-slate-400">{group.product?.type}</span>
                                </div>
                            </td>
                            <td className="p-4 text-center">
                                <Badge color={group.totalQty > 0 ? 'emerald' : 'slate'}>{group.totalQty} {group.product?.unit}</Badge>
                            </td>
                            <td className="p-4 text-center">
                                {group.reservedQty > 0 ? (
                                    <Badge color="blue">{group.reservedQty} {group.product?.unit}</Badge>
                                ) : (
                                    <span className="text-slate-300">-</span>
                                )}
                            </td>
                            <td className="p-4">
                                <span className="font-bold text-slate-700">{formatCurrency(group.totalValue)}</span>
                                {hasDifferentPrices && <p className="text-[9px] text-orange-500 font-medium">Разные цены партий</p>}
                            </td>
                            <td className="p-4 text-right">
                                <Button variant="ghost" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); toggleGroup(productId); }}>
                                    {isExpanded ? 'Свернуть' : 'Развернуть'}
                                </Button>
                            </td>
                          </tr>

                          {/* Expanded Items (Batches) */}
                          {isExpanded && (
                            <tr className="bg-slate-50/50">
                                <td colSpan={7} className="p-0">
                                    <div className="px-4 pb-4">
                                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-inner">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-100 text-[10px] text-slate-500 uppercase border-b border-slate-200">
                                                    <tr>
                                                        <th className="p-3 pl-6">Дата прихода</th>
                                                        <th className="p-3">Кол-во</th>
                                                        <th className="p-3">Статус</th>
                                                        <th className="p-3">Цена закупки</th>
                                                        <th className="p-3">Серийный номер</th>
                                                        <th className="p-3 text-right">Действия</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {group.items.map(item => {
                                                        const unitPrice = item.purchase_price || item.product?.base_price || 0;
                                                        const isInCart = cart.some(c => c.id === item.id);
                                                        const isReserved = item.status === 'reserved';
                                                        
                                                        return (
                                                            <tr key={item.id} className="hover:bg-blue-50/20 transition-colors">
                                                                <td className="p-3 pl-6 text-xs text-slate-600 cursor-pointer" onClick={() => setSelectedDrawerItem(item)}>
                                                                    {formatDate(item.created_at)}
                                                                </td>
                                                                <td className="p-3 text-sm font-bold text-slate-800">{item.quantity} {item.product?.unit}</td>
                                                                <td className="p-3">
                                                                    {isReserved ? (
                                                                        <div className="flex flex-col gap-1">
                                                                            <span className="text-[9px] font-bold text-blue-600 uppercase bg-blue-50 px-1.5 py-0.5 rounded w-fit">Резерв</span>
                                                                            {item.invoice && (
                                                                                <span className="text-[9px] text-slate-400">Счет №{item.invoice.number}</span>
                                                                            )}
                                                                            {/* MANUAL UNRESERVE BUTTON */}
                                                                            <button 
                                                                                onClick={() => handleUnreserve(item.id)} 
                                                                                className="text-[9px] text-red-500 hover:underline text-left"
                                                                            >
                                                                                Снять
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[9px] font-bold text-emerald-600 uppercase bg-emerald-50 px-1.5 py-0.5 rounded w-fit">Свободен</span>
                                                                    )}
                                                                </td>
                                                                <td className="p-3 text-xs font-mono">{formatCurrency(unitPrice)}</td>
                                                                <td className="p-3">
                                                                    {item.serial_number ? 
                                                                        <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">{item.serial_number}</span> 
                                                                        : <span className="text-[10px] text-slate-300 italic">Нет S/N</span>}
                                                                </td>
                                                                <td className="p-3 text-right">
                                                                    <div className="flex justify-end gap-1">
                                                                        {!isReserved && (
                                                                            <button onClick={() => isInCart ? onRemoveFromCart(item.id) : onAddToCart(item)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isInCart ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`} title={isInCart ? "Убрать из отгрузки" : "Добавить к отгрузке"}>
                                                                                <span className="material-icons-round text-sm">{isInCart ? 'remove_shopping_cart' : 'add_shopping_cart'}</span>
                                                                            </button>
                                                                        )}
                                                                        {isAdmin && (
                                                                            <>
                                                                                <button onClick={() => onEdit(item)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-all" title="Редактировать партию">
                                                                                    <span className="material-icons-round text-sm">edit</span>
                                                                                </button>
                                                                                <button onClick={() => setDeleteId(item.id)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-all" title="Списать">
                                                                                    <span className="material-icons-round text-sm">delete</span>
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if(deleteId) onDeleteItem(deleteId); setDeleteId(null); }}
        title="Списание товара"
        message="Товар будет перемещен в корзину и помечен как списанный."
        confirmVariant="danger"
      />

      <ItemDetailsDrawer 
        item={selectedDrawerItem}
        isOpen={!!selectedDrawerItem}
        onClose={() => setSelectedDrawerItem(null)}
        profile={profile}
        onAction={(action, item) => { setSelectedDrawerItem(null); if (action === 'return') onReturn(item); if (action === 'replace') onReplace(item); if (action === 'edit') onEdit(item); }}
      />
    </div>
  );
};

export default InventoryList;
