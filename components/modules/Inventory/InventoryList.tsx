
import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InventoryItem } from '../../../types';
import { CartItem } from './index';
import { Badge, Input, Button, ConfirmModal, ProductImage } from '../../ui';
import { formatDate } from '../../../lib/dateUtils';
import ItemDetailsDrawer from './ItemDetailsDrawer';
import { supabase } from '../../../lib/supabase';

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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<InventoryItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Expanded states (default closed = empty set)
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // Type Filter State (Services removed from warehouse view)
  const [typeFilter, setTypeFilter] = useState<'all' | 'product' | 'material'>('all');

  const isAdmin = profile?.role === 'admin';
  const isStorekeeper = profile?.role === 'storekeeper';
  const isDirector = profile?.role === 'director';
  // Update: Director has full rights too
  const canManage = isAdmin || isStorekeeper || isDirector;

  const unreserveMutation = useMutation({
    mutationFn: async (itemId: string) => {
        await supabase.from('inventory_items').update({ status: 'in_stock', reserved_for_invoice_id: null }).eq('id', itemId);
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['inventory_items'] });
    },
    onError: (error: any) => {
        alert('Ошибка: ' + error.message);
    }
  });

  const handleUnreserve = (itemId: string) => {
      if(!window.confirm('Снять резерв с товара? Он станет доступен для использования.')) return;
      unreserveMutation.mutate(itemId);
  };

  const filteredItems = useMemo(() => {
    let list = items;
    if (activeTab === 'stock') {
        list = list.filter(i => i.status === 'in_stock' || i.status === 'reserved');
    } else if (activeTab === 'warranty') {
        list = list.filter(i => i.status === 'deployed');
    }
    
    return list.filter(i => {
      const productName = i.product?.name || `Товар #${i.product_id?.slice(0,4)}...`;
      const productSku = i.product?.sku || '';
      const serial = i.serial_number || '';
      const objName = i.object?.name || '';
      const prodType = i.product?.type || 'product';

      // STRICTLY EXCLUDE SERVICES from Warehouse view
      if (prodType === 'service') return false;

      const matchSearch = 
        productName.toLowerCase().includes(search.toLowerCase()) || 
        productSku.toLowerCase().includes(search.toLowerCase()) ||
        serial.toLowerCase().includes(search.toLowerCase()) ||
        objName.toLowerCase().includes(search.toLowerCase());
      
      const matchType = typeFilter === 'all' || prodType === typeFilter;
      
      return matchSearch && matchType;
    });
  }, [items, search, typeFilter, activeTab]);

  // ГРУППИРОВКА: Категория -> Продукт -> Партии
  const groupedData = useMemo(() => {
    if (activeTab !== 'stock') return [];
    
    const categoryGroups: Record<string, Record<string, { product: any, totalQty: number, reservedQty: number, totalValue: number, items: InventoryItem[] }>> = {};

    filteredItems.forEach(item => {
      const cat = item.product?.category || 'Разное';
      const pId = item.product_id;
      
      if (!categoryGroups[cat]) categoryGroups[cat] = {};
      if (!categoryGroups[cat][pId]) {
        categoryGroups[cat][pId] = {
          product: item.product,
          totalQty: 0,
          reservedQty: 0,
          totalValue: 0,
          items: []
        };
      }
      
      const group = categoryGroups[cat][pId];
      const unitPrice = item.purchase_price || item.product?.base_price || 0;
      
      group.items.push(item);
      group.totalQty += item.quantity;
      if (item.status === 'reserved') group.reservedQty += item.quantity;
      group.totalValue += (item.quantity * unitPrice);
    });

    // Преобразуем в массив для рендеринга
    return Object.entries(categoryGroups)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([cat, productsMap]) => ({
            category: cat,
            products: Object.values(productsMap).sort((a,b) => (a.product?.name || '').localeCompare(b.product?.name || ''))
        }));
  }, [filteredItems, activeTab]);

  const totalSum = useMemo(() => {
    return filteredItems.reduce((acc, item) => {
        const price = item.purchase_price || item.product?.base_price || 0;
        return acc + (item.quantity * price);
    }, 0);
  }, [filteredItems]);

  const toggleProduct = (pId: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(pId)) next.delete(pId); else next.add(pId);
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
        const next = new Set(prev);
        if (next.has(cat)) next.delete(cat); else next.add(cat);
        return next;
    });
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('ru-BY', { style: 'currency', currency: 'BYN', maximumFractionDigits: 2 }).format(val);

  if (loading && items.length === 0) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div></div>;

  return (
    <div className="space-y-6 h-full flex flex-col min-h-0">
      <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between shrink-0">
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <div className="w-full md:w-64">
                <Input placeholder="Поиск по названию, S/N..." value={search} onChange={(e: any) => setSearch(e.target.value)} icon="search" className="h-11 !text-sm" />
            </div>
            
            {/* TYPE FILTER SWITCH */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
                <button onClick={() => setTypeFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${typeFilter === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Все</button>
                <button onClick={() => setTypeFilter('product')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${typeFilter === 'product' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>Товары</button>
                <button onClick={() => setTypeFilter('material')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${typeFilter === 'material' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500'}`}>Материалы</button>
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

      {activeTab === 'stock' ? (
        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden flex flex-col min-h-0 flex-grow shadow-sm">
          {/* Header */}
          <div className="bg-slate-50 border-b border-slate-200 grid grid-cols-[40px_60px_3fr_1fr_100px_100px_120px_100px] gap-2 p-4 text-xs font-bold text-slate-500 uppercase sticky top-0 z-20 shrink-0">
             <div></div>
             <div>Фото</div>
             <div>Номенклатура</div>
             <div>Артикул</div>
             <div className="text-center">Всего</div>
             <div className="text-center">В резерве</div>
             <div>Стоимость</div>
             <div className="text-right">Действия</div>
          </div>

          <div className="overflow-y-auto flex-grow scrollbar-hide">
            {groupedData.length === 0 ? (
                <div className="p-10 text-center text-slate-400">Склад пуст</div>
            ) : (
                groupedData.map(group => {
                    const isCatExpanded = expandedCategories.has(group.category);
                    const shouldShow = search ? true : isCatExpanded; 

                    return (
                        <div key={group.category} className="border-b border-slate-100 last:border-0">
                            {/* Category Header */}
                            <div 
                                onClick={() => toggleCategory(group.category)}
                                className="bg-slate-100/80 px-4 py-2 cursor-pointer flex items-center gap-3 hover:bg-slate-200/50 transition-colors sticky top-0 z-10 backdrop-blur-sm"
                            >
                                <button className="w-5 h-5 rounded-full border border-slate-300 bg-white flex items-center justify-center">
                                    <span className={`material-icons-round text-sm text-slate-500 transition-transform ${shouldShow ? '-rotate-90' : ''}`}>expand_more</span>
                                </button>
                                <span className="font-bold text-slate-700 text-sm">{group.category}</span>
                                <Badge color="slate">{group.products.length} поз.</Badge>
                            </div>

                            {shouldShow && group.products.map((pGroup) => {
                                const productId = pGroup.items[0].product_id;
                                const isExpanded = expandedProducts.has(productId);
                                const hasDiffPrices = pGroup.items.some(i => i.purchase_price !== pGroup.items[0].purchase_price);

                                return (
                                    <div key={productId} className={`transition-colors border-b border-slate-50 ${isExpanded ? 'bg-blue-50/10' : 'hover:bg-slate-50'}`}>
                                        {/* Product Row */}
                                        <div className="grid grid-cols-[40px_60px_3fr_1fr_100px_100px_120px_100px] gap-2 p-3 items-center cursor-pointer" onClick={() => toggleProduct(productId)}>
                                            <div className="flex justify-center">
                                                <button className={`w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all ${isExpanded ? 'bg-blue-100 text-blue-600 rotate-180' : ''}`}>
                                                    <span className="material-icons-round text-sm">expand_more</span>
                                                </button>
                                            </div>
                                            <div><ProductImage src={pGroup.product?.image_url} className="w-10 h-10 rounded-lg border border-slate-100" /></div>
                                            <div>
                                                <p className="font-bold text-slate-900 text-sm">{pGroup.product?.name}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">{pGroup.items.length} партий</p>
                                            </div>
                                            <div className="text-xs text-slate-500 font-mono">{pGroup.product?.sku || '—'}</div>
                                            <div className="text-center"><Badge color={pGroup.totalQty > 0 ? 'emerald' : 'slate'}>{pGroup.totalQty} {pGroup.product?.unit}</Badge></div>
                                            <div className="text-center">{pGroup.reservedQty > 0 ? <Badge color="blue">{pGroup.reservedQty}</Badge> : <span className="text-slate-300">-</span>}</div>
                                            <div>
                                                <span className="font-bold text-slate-700 text-sm">{formatCurrency(pGroup.totalValue)}</span>
                                                {hasDiffPrices && <span className="block text-[9px] text-orange-500 font-bold">разные цены</span>}
                                            </div>
                                            <div className="text-right">
                                                <Button variant="ghost" className="h-8 w-8 !px-0" onClick={(e) => { e.stopPropagation(); toggleProduct(productId); }}>
                                                    <span className="material-icons-round">list</span>
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Batches Table (Expanded) */}
                                        {isExpanded && (
                                            <div className="px-4 pb-4 pl-14">
                                                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-inner">
                                                    <table className="w-full text-left text-xs">
                                                        <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-100">
                                                            <tr>
                                                                <th className="p-3 pl-4">Дата прихода</th>
                                                                <th className="p-3">Кол-во</th>
                                                                <th className="p-3">Статус</th>
                                                                <th className="p-3">Закупка</th>
                                                                <th className="p-3">S/N</th>
                                                                <th className="p-3 text-right">Действия</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-50">
                                                            {pGroup.items.map(item => {
                                                                const isInCart = cart.some(c => c.id === item.id);
                                                                const isReserved = item.status === 'reserved';
                                                                return (
                                                                    <tr key={item.id} className="hover:bg-blue-50/30">
                                                                        <td className="p-3 pl-4 text-slate-600">{formatDate(item.created_at)}</td>
                                                                        <td className="p-3 font-bold">{item.quantity} {item.product?.unit}</td>
                                                                        <td className="p-3">
                                                                            {isReserved ? (
                                                                                <div className="flex flex-col items-start gap-1">
                                                                                    <Badge color="blue">Резерв</Badge>
                                                                                    {item.invoice && <span className="text-[9px]">Счет №{item.invoice.number}</span>}
                                                                                    {canManage && <button onClick={() => handleUnreserve(item.id)} className="text-[9px] text-red-500 underline">Снять</button>}
                                                                                </div>
                                                                            ) : <Badge color="emerald">Свободно</Badge>}
                                                                        </td>
                                                                        <td className="p-3 font-mono">{formatCurrency(item.purchase_price || 0)}</td>
                                                                        <td className="p-3 font-mono text-slate-600">{item.serial_number || '—'}</td>
                                                                        <td className="p-3 text-right flex justify-end gap-1">
                                                                            {!isReserved && (
                                                                                <button onClick={() => isInCart ? onRemoveFromCart(item.id) : onAddToCart(item)} className={`w-7 h-7 rounded flex items-center justify-center transition-all ${isInCart ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:text-blue-600'}`}>
                                                                                    <span className="material-icons-round text-sm">{isInCart ? 'remove' : 'add'}</span>
                                                                                </button>
                                                                            )}
                                                                            {canManage && (
                                                                                <>
                                                                                    <button onClick={() => onEdit(item)} className="w-7 h-7 rounded bg-slate-100 text-slate-500 hover:text-blue-600 flex items-center justify-center"><span className="material-icons-round text-sm">edit</span></button>
                                                                                    <button onClick={() => setDeleteId(item.id)} className="w-7 h-7 rounded bg-slate-100 text-slate-500 hover:text-red-600 flex items-center justify-center"><span className="material-icons-round text-sm">delete</span></button>
                                                                                </>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })
            )}
          </div>
        </div>
      ) : (
        // Warranty Tab
        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden flex-grow flex flex-col min-h-0">
             <div className="p-10 text-center text-slate-400">Модуль гарантии (в разработке)</div>
        </div>
      )}

      <ConfirmModal 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if(deleteId) onDeleteItem(deleteId); setDeleteId(null); }}
        title="Списание товара"
        message="Товар будет перемещен в корзину."
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
