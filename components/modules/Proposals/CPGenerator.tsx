
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Input, Select, Toast, Badge, ProductImage } from '../../ui';
import { Product } from '../../../types';

interface CPGeneratorProps {
  profile: any;
  proposalId?: string | null;
  initialObjectId?: string | null; 
  onSuccess: () => void;
  onCancel: () => void;
}

interface CartItem {
  product_id: string; 
  name: string;
  description?: string;
  quantity: number;
  base_price: number; 
  retail_price: number; 
  category: string;
  unit: string;
  manual_markup_percent: number; 
}

const CPGenerator: React.FC<CPGeneratorProps> = ({ profile, proposalId, initialObjectId, onSuccess, onCancel }) => {
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
  
  // Filters & UI
  const [search, setSearch] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [prodRes, objRes, stockRes] = await Promise.all([
          supabase.from('products').select('*').eq('is_archived', false).order('category').order('name'),
          supabase.from('objects').select('id, name, address, client:clients(id, name)').is('is_deleted', false).order('name'),
          supabase.from('inventory_items').select('product_id, quantity').eq('status', 'in_stock').is('deleted_at', null)
        ]);
        
        if (prodRes.data) setProducts(prodRes.data as unknown as Product[]);
        if (objRes.data) setObjects(objRes.data);
        if (stockRes.data) {
            const stocks = stockRes.data.reduce((acc: Record<string, number>, item: any) => {
                acc[item.product_id] = (acc[item.product_id] || 0) + item.quantity;
                return acc;
            }, {});
            setStockMap(stocks);
        }

        if (initialObjectId && !proposalId && objRes.data) {
            const targetObj = objRes.data.find((o: any) => o.id === initialObjectId);
            if (targetObj) setSelectedObjectId(targetObj.id);
        }

        if (proposalId) {
          const { data: cp } = await supabase.from('commercial_proposals').select('*, client:clients(id, name)').eq('id', proposalId).single();
          if (cp) {
            const cpData = cp as any;
            setTitle(cpData.title || '');
            setLinkedClient(cpData.client);
            if (cpData.object_id) setSelectedObjectId(cpData.object_id);
            setHasVat(cpData.has_vat || false);

            const { data: items } = await supabase.from('cp_items').select('*').eq('cp_id', proposalId);
            if (items) {
              setCart(items.map((i: any) => {
                  const liveProd = (prodRes.data as unknown as Product[])?.find(p => p.id === i.product_id);
                  return {
                    product_id: i.product_id,
                    name: i.snapshot_name || liveProd?.name || 'Unknown',
                    description: i.snapshot_description || '',
                    unit: i.snapshot_unit || 'шт',
                    category: i.snapshot_global_category || 'General',
                    quantity: i.quantity,
                    base_price: liveProd ? liveProd.base_price : 0,
                    retail_price: i.price_at_moment || 0,
                    manual_markup_percent: i.manual_markup || 0
                  };
              }));
            }
          }
        }
      } catch (e: any) { setToast({ message: 'Ошибка: ' + e.message, type: 'error' }); }
      setLoading(false);
    };
    init();
  }, [proposalId, initialObjectId]);

  useEffect(() => {
      if (selectedObjectId) {
          const obj = objects.find(o => o.id === selectedObjectId);
          if (obj && obj.client) {
              setLinkedClient(obj.client);
              if (!title || (title.startsWith('КП для объекта') && title.includes(obj.name))) {
                  setTitle(`КП для объекта "${obj.name}"`);
              }
          }
      }
  }, [selectedObjectId, objects]);

  const calculateItemPrice = (item: CartItem) => {
      if (item.base_price > 0) return item.base_price * (1 + (item.manual_markup_percent / 100));
      return item.retail_price; 
  };

  const calculateItemTotal = (item: CartItem) => calculateItemPrice(item) * item.quantity;

  const totals = useMemo(() => {
    let subtotal = 0; let costTotal = 0;
    cart.forEach(i => { subtotal += calculateItemTotal(i); costTotal += i.base_price * i.quantity; });
    const vat = hasVat ? subtotal * 0.2 : 0;
    const profit = subtotal - costTotal;
    const markupPercent = costTotal > 0 ? (profit / costTotal) * 100 : 0;
    return { subtotal, vat, total: subtotal + vat, profit, markupPercent };
  }, [cart, hasVat]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const exists = prev.find(c => c.product_id === product.id);
      if (exists) return prev.map(c => c.product_id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      let initialMarkup = 0;
      if (product.base_price > 0) initialMarkup = ((product.retail_price - product.base_price) / product.base_price) * 100;
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

  const updateCartItem = (id: string, field: keyof CartItem, value: any) => setCart(prev => prev.map(c => c.product_id === id ? { ...c, [field]: value } : c));
  const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.product_id !== id));

  const handleSave = async () => {
    if (!linkedClient) { setToast({ message: 'Выберите объект с клиентом', type: 'error' }); return; }
    if (cart.length === 0) { setToast({ message: 'Корзина пуста', type: 'error' }); return; }
    setLoading(true);
    try {
      let cpId = proposalId;
      const headerPayload = {
        title: title || null,
        client_id: linkedClient.id,
        object_id: selectedObjectId || null,
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
          final_price_byn: calculateItemTotal(item) / item.quantity,
          price_at_moment: calculateItemPrice(item),
          manual_markup: item.manual_markup_percent,
          snapshot_name: item.name,
          snapshot_description: item.description,
          snapshot_unit: item.unit,
          snapshot_global_category: item.category
        }));
        await supabase.from('cp_items').insert(itemsPayload);
      }
      setToast({ message: 'КП успешно сохранено', type: 'success' });
      onSuccess();
    } catch (e: any) { setToast({ message: 'Ошибка: ' + e.message, type: 'error' }); }
    setLoading(false);
  };

  const groupedCatalog = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    products.forEach(p => {
        const match = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase());
        if (match) {
            const cat = p.category || 'Без категории';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(p);
        }
    });
    return Object.entries(groups).sort((a,b) => a[0].localeCompare(b[0]));
  }, [products, search]);

  const toggleCategory = (cat: string) => {
      setCollapsedCategories(prev => {
          const next = new Set(prev);
          if (next.has(cat)) next.delete(cat); else next.add(cat);
          return next;
      });
  };

  const groupedCart = useMemo(() => {
    const groups: Record<string, CartItem[]> = {};
    cart.forEach(item => { if (!groups[item.category]) groups[item.category] = []; groups[item.category].push(item); });
    return groups;
  }, [cart]);

  return (
    <div className="flex flex-col h-full min-h-[500px] gap-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Top Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap gap-4 items-end shrink-0 shadow-sm">
        <div className="w-64">
            <Select label="Объект" value={selectedObjectId} onChange={(e:any) => setSelectedObjectId(e.target.value)} options={[{value:'', label:'Выберите объект...'}, ...objects.map(o => ({value:o.id, label:o.name}))]} icon="home_work" disabled={!!initialObjectId} />
        </div>
        <div className="flex-grow min-w-[200px] flex flex-col justify-end">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Заказчик</p>
            <div className={`h-[46px] px-4 rounded-xl border flex items-center transition-all ${linkedClient ? 'bg-blue-50 border-blue-200 text-blue-900 font-bold shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                <span className="material-icons-round text-lg mr-2">{linkedClient ? 'person' : 'no_accounts'}</span>
                {linkedClient ? linkedClient.name : '—'}
            </div>
        </div>
        <div className="w-64"><Input label="Название КП" placeholder="Напр: Смета на оборудование" value={title} onChange={(e:any) => setTitle(e.target.value)} /></div>
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

      <div className="flex-grow grid grid-cols-1 lg:grid-cols-10 gap-4 overflow-hidden h-full min-h-0">
        {/* Left: Catalog */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden h-full min-h-0">
          <div className="p-4 border-b border-slate-100 flex gap-2 shrink-0">
            <Input placeholder="Поиск товара..." value={search} onChange={(e:any) => setSearch(e.target.value)} className="flex-grow" icon="search" />
          </div>
          <div className="flex-grow overflow-y-auto scrollbar-hide">
            {groupedCatalog.length === 0 ? (
                <div className="p-10 text-center text-slate-400">Товары не найдены</div>
            ) : (
                groupedCatalog.map(([cat, items]) => {
                    const isCollapsed = collapsedCategories.has(cat);
                    return (
                        <div key={cat} className="border-b border-slate-100 last:border-0">
                            <div 
                                onClick={() => toggleCategory(cat)}
                                className="bg-slate-50/80 px-4 py-2 cursor-pointer flex items-center justify-between hover:bg-slate-100 sticky top-0 z-10 backdrop-blur-sm"
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`material-icons-round text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}>expand_more</span>
                                    <span className="font-bold text-slate-700 text-xs uppercase tracking-wide">{cat}</span>
                                </div>
                                <Badge color="slate">{items.length}</Badge>
                            </div>
                            
                            {!isCollapsed && (
                                <div className="divide-y divide-slate-50">
                                    {items.map(p => {
                                        const stockQty = stockMap[p.id] || 0;
                                        return (
                                            <div key={p.id} onClick={() => addToCart(p)} className="p-3 hover:bg-blue-50/30 cursor-pointer transition-colors flex justify-between items-center group">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <ProductImage src={p.image_url} alt={p.name} className="w-10 h-10 rounded-md shrink-0 border border-slate-100" preview />
                                                    <div className="flex flex-col gap-0.5 min-w-0">
                                                        <p className="text-sm font-bold text-slate-900 truncate">{p.name}</p>
                                                        {p.sku && <span className="text-[10px] text-slate-500 font-mono">{p.sku}</span>}
                                                    </div>
                                                </div>
                                                <div className="text-right pl-2 shrink-0">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{p.retail_price} BYN</span>
                                                        <span className={`text-[9px] mt-1 font-bold ${stockQty > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>Склад: {stockQty}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })
            )}
          </div>
        </div>

        {/* Right: Cart */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden h-full min-h-0 shadow-sm">
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
              Object.entries(groupedCart).map(([category, items]: [string, CartItem[]]) => (
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
                                <div className="flex flex-col w-12">
                                    <label className="text-[8px] text-slate-400 font-bold uppercase">Кол-во</label>
                                    <input type="number" min="1" value={item.quantity} onChange={(e) => updateCartItem(item.product_id, 'quantity', parseInt(e.target.value) || 1)} className="w-full h-7 bg-slate-50 border border-slate-200 rounded text-center font-bold text-xs focus:border-blue-500 outline-none" />
                                </div>
                                <div className="flex flex-col w-14">
                                    <label className="text-[8px] text-slate-400 font-bold uppercase">Наценка %</label>
                                    <input type="number" step="0.1" value={item.manual_markup_percent} onChange={(e) => updateCartItem(item.product_id, 'manual_markup_percent', parseFloat(e.target.value) || 0)} className={`w-full h-7 border rounded text-center font-bold text-xs focus:border-blue-500 outline-none ${item.manual_markup_percent < 0 ? 'text-red-500 bg-red-50 border-red-100' : 'text-emerald-600 bg-emerald-50 border-emerald-100'}`} />
                                </div>
                                <div className="flex flex-col flex-grow items-end">
                                    <label className="text-[8px] text-slate-400 font-bold uppercase">Сумма (BYN)</label>
                                    <div className="h-7 flex items-center"><span className="font-bold text-sm text-slate-700">{(unitPrice * item.quantity).toFixed(2)}</span></div>
                                </div>
                            </div>
                          </div>
                        );
                    })}
                  </div>
                ))
            )}
          </div>

          <div className="p-5 bg-slate-50 border-t border-slate-200 shrink-0 z-10">
            <div className="space-y-1 mb-3">
              <div className="flex justify-between text-xs"><span className="text-slate-500">Сумма без НДС:</span><span className="font-bold text-slate-700">{totals.subtotal.toFixed(2)} BYN</span></div>
              {hasVat && <div className="flex justify-between text-xs"><span className="text-slate-500">НДС 20%:</span><span className="font-bold text-slate-700">{totals.vat.toFixed(2)} BYN</span></div>}
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <span className="font-bold text-slate-900 text-sm">ИТОГО:</span>
              <span className="font-bold text-xl text-blue-600">{totals.total.toFixed(2)} BYN</span>
            </div>
            <div className="mt-2 text-right">
                 <span className={`text-[10px] font-bold ${totals.profit > 0 ? 'text-emerald-600' : 'text-red-500'}`}>Прибыль: {totals.profit.toFixed(2)} BYN ({totals.markupPercent.toFixed(1)}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CPGenerator;
