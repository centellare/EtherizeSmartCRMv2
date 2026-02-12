
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Input, Select, Toast, Badge } from '../../ui';
import { Product } from '../../../types';

interface CPGeneratorProps {
  profile: any;
  proposalId?: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

interface CartItem {
  product_id: string; 
  name: string;
  description?: string;
  quantity: number;
  base_price: number; // Cost / Закупка (BYN)
  retail_price: number; // Sales / Продажа (BYN)
  category: string;
  unit: string;
  manual_markup_percent: number; // Editable Markup
}

const CPGenerator: React.FC<CPGeneratorProps> = ({ profile, proposalId, onSuccess, onCancel }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [objects, setObjects] = useState<any[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Settings
  const [title, setTitle] = useState('');
  const [selectedObjectId, setSelectedObjectId] = useState('');
  const [linkedClient, setLinkedClient] = useState<{id: string, name: string} | null>(null);
  
  const [hasVat, setHasVat] = useState(true);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Filters
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [prodRes, objRes, stockRes] = await Promise.all([
          supabase.from('products').select('*').eq('is_archived', false).order('name'),
          supabase.from('objects')
            .select('id, name, address, client:clients(id, name)')
            .is('is_deleted', false)
            .order('name'),
          supabase.from('inventory_items')
            .select('product_id, quantity')
            .eq('status', 'in_stock')
            .is('deleted_at', null)
        ]);
        
        if (prodRes.data) setProducts(prodRes.data as unknown as Product[]);
        if (objRes.data) setObjects(objRes.data);
        
        // Calculate Stock
        if (stockRes.data) {
            const stocks = stockRes.data.reduce((acc: Record<string, number>, item: any) => {
                acc[item.product_id] = (acc[item.product_id] || 0) + item.quantity;
                return acc;
            }, {});
            setStockMap(stocks);
        }

        // Load existing proposal if in edit mode
        if (proposalId) {
          const { data: cp } = await supabase
            .from('commercial_proposals')
            .select('*, client:clients(id, name)')
            .eq('id', proposalId)
            .single();
          
          if (cp) {
            const cpData = cp as any;
            setTitle(cpData.title || '');
            setLinkedClient(cpData.client);
            
            // Try to load linked object from CP first, fallback to finding via client
            if (cpData.object_id) {
                setSelectedObjectId(cpData.object_id);
            } else if (objRes.data) {
                const relatedObject = objRes.data.find((o: any) => o.client?.id === cpData.client_id);
                if (relatedObject) setSelectedObjectId(relatedObject.id);
            }
            
            setHasVat(cpData.has_vat || false);

            const { data: items } = await supabase.from('cp_items').select('*').eq('cp_id', proposalId);

            if (items) {
              // Re-hydrate logic
              const hydratedCart: CartItem[] = items.map((i: any) => {
                  const liveProd = (prodRes.data as unknown as Product[])?.find(p => p.id === i.product_id);
                  const base = liveProd ? liveProd.base_price : 0;
                  
                  return {
                    product_id: i.product_id,
                    name: i.snapshot_name || liveProd?.name || 'Unknown',
                    description: i.snapshot_description || '',
                    unit: i.snapshot_unit || 'шт',
                    category: i.snapshot_global_category || 'General',
                    quantity: i.quantity,
                    base_price: base,
                    // Используем price_at_moment как цену за единицу в BYN
                    retail_price: i.price_at_moment || 0,
                    manual_markup_percent: i.manual_markup || 0
                  };
              });
              setCart(hydratedCart);
            }
          }
        }
      } catch (e: any) {
        console.error(e);
        setToast({ message: 'Ошибка инициализации: ' + e.message, type: 'error' });
      }
      setLoading(false);
    };
    init();
  }, [proposalId]);

  // AUTO-LINK Client
  useEffect(() => {
      if (selectedObjectId) {
          const obj = objects.find(o => o.id === selectedObjectId);
          if (obj && obj.client) {
              setLinkedClient(obj.client);
              if (!title) setTitle(`КП для объекта "${obj.name}"`);
          } else if (selectedObjectId !== '') { 
              // Don't auto-clear if it was set by editing load, but logic above handles it
          }
      }
  }, [selectedObjectId, objects]);

  // Calculate Unit Price in BYN
  const calculateItemPrice = (item: CartItem) => {
      if (item.base_price > 0) {
          return item.base_price * (1 + (item.manual_markup_percent / 100));
      }
      return item.retail_price; 
  };

  const calculateItemTotal = (item: CartItem) => {
    const unitPrice = calculateItemPrice(item);
    return unitPrice * item.quantity;
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let costTotal = 0;

    cart.forEach(i => {
      subtotal += calculateItemTotal(i);
      costTotal += i.base_price * i.quantity;
    });
    
    const vat = hasVat ? subtotal * 0.2 : 0;
    const profit = subtotal - costTotal;
    const markupPercent = costTotal > 0 ? (profit / costTotal) * 100 : 0;

    return { subtotal, vat, total: subtotal + vat, profit, markupPercent };
  }, [cart, hasVat]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const exists = prev.find(c => c.product_id === product.id);
      if (exists) {
        return prev.map(c => c.product_id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      
      // Calculate initial default markup from catalog
      let initialMarkup = 0;
      if (product.base_price > 0) {
          initialMarkup = ((product.retail_price - product.base_price) / product.base_price) * 100;
      }

      return [...prev, {
        product_id: product.id,
        name: product.name,
        description: product.description || '',
        unit: product.unit,
        quantity: 1,
        base_price: product.base_price,
        retail_price: product.retail_price,
        category: product.category,
        manual_markup_percent: parseFloat(initialMarkup.toFixed(2))
      }];
    });
  };

  const updateCartItem = (id: string, field: keyof CartItem, value: any) => {
    setCart(prev => prev.map(c => c.product_id === id ? { ...c, [field]: value } : c));
  };

  const removeFromCart = (id: string) => {
      setCart(prev => prev.filter(c => c.product_id !== id));
  };

  const handleSave = async () => {
    if (!linkedClient) { setToast({ message: 'Выберите объект с клиентом', type: 'error' }); return; }
    if (cart.length === 0) { setToast({ message: 'Корзина пуста', type: 'error' }); return; }

    setLoading(true);
    try {
      let cpId = proposalId;

      const headerPayload = {
        title: title || null,
        client_id: linkedClient.id,
        object_id: selectedObjectId || null, // SAVING OBJECT ID
        status: 'draft',
        exchange_rate: 1, 
        has_vat: hasVat,
        total_amount_byn: totals.total,
        created_by: profile.id
      };

      if (cpId) {
        await supabase.from('commercial_proposals').update(headerPayload as any).eq('id', cpId);
        await supabase.from('cp_items').delete().eq('cp_id', cpId);
      } else {
        const { data, error } = await supabase.from('commercial_proposals').insert([headerPayload as any]).select('id').single();
        if (error) throw error;
        cpId = data.id;
      }

      if (cpId) {
        const itemsPayload = cart.map(item => ({
          cp_id: cpId,
          product_id: item.product_id,
          quantity: item.quantity,
          final_price_byn: calculateItemTotal(item) / item.quantity, // Unit price BYN (Effective)
          price_at_moment: calculateItemPrice(item), // Unit price BYN
          manual_markup: item.manual_markup_percent,
          // Snapshots
          snapshot_name: item.name,
          snapshot_description: item.description,
          snapshot_unit: item.unit,
          snapshot_global_category: item.category
        }));

        const { error: itemsError } = await supabase.from('cp_items').insert(itemsPayload);
        if (itemsError) throw itemsError;
      }

      setToast({ message: 'КП успешно сохранено', type: 'success' });
      onSuccess();
    } catch (e: any) {
      console.error(e);
      if (e.code === 'PGRST204' || e.message?.includes('manual_markup') || e.message?.includes('snapshot') || e.message?.includes('object_id')) {
        setToast({ 
            message: 'Ошибка БД: Выполните скрипт в разделе "База данных"!', 
            type: 'error' 
        });
      } else {
        setToast({ message: 'Ошибка: ' + e.message, type: 'error' });
      }
    }
    setLoading(false);
  };

  // Filters
  const uniqueCategories = useMemo(() => Array.from(new Set(products.map(p => p.category))).sort(), [products]);
  
  const filteredCatalog = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase());
      const matchCat = catFilter === 'all' || p.category === catFilter;
      return matchSearch && matchCat;
    });
  }, [products, search, catFilter]);

  const groupedCart = useMemo(() => {
    const groups: Record<string, CartItem[]> = {};
    cart.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [cart]);

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[500px] gap-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Top Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap gap-4 items-end shrink-0 shadow-sm">
        <div className="w-64">
            <Select 
                label="Объект" 
                value={selectedObjectId} 
                onChange={(e:any) => setSelectedObjectId(e.target.value)}
                options={[{value:'', label:'Выберите объект...'}, ...objects.map(o => ({value:o.id, label:o.name}))]}
                icon="home_work"
            />
        </div>
        <div className="flex-grow min-w-[200px] flex flex-col justify-end">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Заказчик</p>
            <div className={`h-[46px] px-4 rounded-xl border flex items-center transition-all ${linkedClient ? 'bg-blue-50 border-blue-200 text-blue-900 font-bold shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                <span className="material-icons-round text-lg mr-2">{linkedClient ? 'person' : 'no_accounts'}</span>
                {linkedClient ? linkedClient.name : '—'}
            </div>
        </div>
        
        <div className="w-64">
          <Input 
            label="Название КП" 
            placeholder="Напр: Смета на оборудование" 
            value={title} 
            onChange={(e:any) => setTitle(e.target.value)} 
          />
        </div>
        
        <div className="pb-3 px-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={hasVat} onChange={(e) => setHasVat(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <span className="text-sm font-bold text-slate-700">НДС 20%</span>
          </label>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={onCancel}>Отмена</Button>
          <Button icon="save" onClick={handleSave} loading={loading}>Сохранить</Button>
        </div>
      </div>

      <div className="flex-grow grid grid-cols-1 lg:grid-cols-10 gap-4 overflow-hidden h-full">
        {/* Left: Catalog */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden h-full">
          <div className="p-4 border-b border-slate-100 flex gap-2 shrink-0">
            <Input placeholder="Поиск товара..." value={search} onChange={(e:any) => setSearch(e.target.value)} className="flex-grow" icon="search" />
            <div className="w-48">
              <Select 
                value={catFilter} 
                onChange={(e:any) => setCatFilter(e.target.value)} 
                options={[{value:'all', label:'Все категории'}, ...uniqueCategories.map(c => ({value:c, label:c}))]} 
              />
            </div>
          </div>
          <div className="flex-grow overflow-y-auto p-2 scrollbar-hide">
            {filteredCatalog.map(p => {
              const stockQty = stockMap[p.id] || 0;
              const hasStock = stockQty > 0;
              
              return (
                <div key={p.id} onClick={() => addToCart(p)} className="p-3 mb-1 rounded-xl border border-slate-100 hover:border-blue-300 hover:bg-slate-50 cursor-pointer transition-all flex justify-between items-center group">
                  <div className="flex flex-col gap-1 overflow-hidden">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-2">{p.category}</span>
                      {p.sku && <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1 rounded">{p.sku}</span>}
                    </div>
                    <p className="text-sm font-bold text-slate-900 truncate">{p.name}</p>
                  </div>
                  <div className="text-right pl-2 shrink-0">
                    <div className="flex flex-col items-end">
                        <p className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded mb-1">{p.retail_price} BYN</p>
                        <div className="flex gap-2 items-center">
                            {hasStock ? (
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Склад: {stockQty}</span>
                            ) : (
                                <span className="text-[10px] font-bold text-slate-300 bg-slate-50 px-1.5 py-0.5 rounded">Склад: 0</span>
                            )}
                        </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Cart */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden h-full shadow-sm">
          <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <span className="material-icons-round text-slate-400">shopping_cart</span>
              Состав КП
            </h3>
          </div>
          
          <div className="flex-grow overflow-y-auto p-4 space-y-4 scrollbar-hide bg-white">
            {cart.length === 0 ? (
              <p className="text-center text-slate-400 mt-10 italic text-sm">Выберите товары из списка слева</p>
            ) : (
              Object.entries(groupedCart).map(([category, items]: [string, CartItem[]]) => {
                return (
                  <div key={category} className="space-y-2">
                    <div className="bg-slate-100 px-3 py-1.5 rounded-lg sticky top-0 z-10 opacity-95 backdrop-blur-sm">
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{category}</span>
                    </div>
                    {items.map(item => {
                        const unitPrice = calculateItemPrice(item);
                        return (
                          <div key={item.product_id} className="pl-1 group border-b border-slate-50 pb-2 last:border-0">
                            <div className="flex justify-between items-start mb-1">
                                <p className="text-xs font-medium text-slate-800 leading-tight w-[90%]">{item.name}</p>
                                <button onClick={() => removeFromCart(item.product_id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                  <span className="material-icons-round text-sm">close</span>
                                </button>
                            </div>
                            
                            <div className="flex items-center gap-2 mt-1.5">
                                {/* Quantity */}
                                <div className="flex flex-col w-12">
                                    <label className="text-[8px] text-slate-400 font-bold uppercase">Кол-во</label>
                                    <input 
                                      type="number" 
                                      min="1" 
                                      value={item.quantity} 
                                      onChange={(e) => updateCartItem(item.product_id, 'quantity', parseInt(e.target.value) || 1)}
                                      className="w-full h-7 bg-slate-50 border border-slate-200 rounded text-center font-bold text-xs focus:border-blue-500 outline-none"
                                    />
                                </div>

                                {/* Markup % */}
                                <div className="flex flex-col w-14">
                                    <label className="text-[8px] text-slate-400 font-bold uppercase">Наценка %</label>
                                    <input 
                                      type="number" 
                                      step="0.1"
                                      value={item.manual_markup_percent} 
                                      onChange={(e) => updateCartItem(item.product_id, 'manual_markup_percent', parseFloat(e.target.value) || 0)}
                                      className={`w-full h-7 border rounded text-center font-bold text-xs focus:border-blue-500 outline-none ${item.manual_markup_percent < 0 ? 'text-red-500 bg-red-50 border-red-100' : 'text-emerald-600 bg-emerald-50 border-emerald-100'}`}
                                    />
                                </div>

                                {/* Price Display */}
                                <div className="flex flex-col flex-grow items-end">
                                    <label className="text-[8px] text-slate-400 font-bold uppercase">Сумма (BYN)</label>
                                    <div className="h-7 flex items-center">
                                        <span className="font-bold text-sm text-slate-700">
                                            {(unitPrice * item.quantity).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-[9px] text-slate-400 text-right mt-0.5">
                                {unitPrice.toFixed(2)} BYN / шт
                            </div>
                          </div>
                        );
                    })}
                  </div>
                );
              })
            )}
          </div>

          <div className="p-5 bg-slate-50 border-t border-slate-200 shrink-0 z-10">
            <div className="space-y-1 mb-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Сумма без НДС:</span>
                <span className="font-bold text-slate-700">{totals.subtotal.toFixed(2)} BYN</span>
              </div>
              {hasVat && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">НДС 20%:</span>
                  <span className="font-bold text-slate-700">{totals.vat.toFixed(2)} BYN</span>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <span className="font-bold text-slate-900 text-sm">ИТОГО:</span>
              <span className="font-bold text-xl text-blue-600">{totals.total.toFixed(2)} BYN</span>
            </div>
            <div className="mt-2 text-right">
                 <span className={`text-[10px] font-bold ${totals.profit > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                   Прибыль: {totals.profit.toFixed(2)} BYN ({totals.markupPercent.toFixed(1)}%)
                 </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CPGenerator;
