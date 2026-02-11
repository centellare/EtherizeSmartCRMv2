
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Input, Select, Toast } from '../../ui';
import { PriceCatalogItem } from '../../../types';

interface CPGeneratorProps {
  profile: any;
  proposalId?: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

interface CartItem {
  catalog_id: string;
  name: string;
  description?: string;
  quantity: number;
  base_eur: number;
  item_markup: number;
  category: string;
  unit: string;
}

const CPGenerator: React.FC<CPGeneratorProps> = ({ profile, proposalId, onSuccess, onCancel }) => {
  const [catalog, setCatalog] = useState<PriceCatalogItem[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Settings
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [exchangeRate, setExchangeRate] = useState<number>(3.5);
  const [globalMarkup, setGlobalMarkup] = useState<number>(0);
  const [hasVat, setHasVat] = useState(true);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Filters
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [catRes, cliRes, configRes] = await Promise.all([
          supabase.from('price_catalog').select('*').eq('is_active', true).neq('item_type', 'system_config'),
          supabase.from('clients').select('id, name').is('deleted_at', null),
          // Fetch default global settings
          supabase.from('price_catalog').select('*').eq('item_type', 'system_config').eq('name', 'GLOBAL_CONFIG').maybeSingle()
        ]);
        
        const catalogData = catRes.data || [];
        setCatalog(catalogData);
        setClients(cliRes.data || []);

        // Apply defaults from DB if available (and not editing existing)
        if (configRes.data && !proposalId) {
           setExchangeRate(configRes.data.price_eur || 3.5);
           setGlobalMarkup(configRes.data.markup_percent || 0);
        }

        // Load existing proposal if in edit mode
        if (proposalId) {
          const { data: cp } = await supabase
            .from('commercial_proposals')
            .select('*')
            .eq('id', proposalId)
            .single();
          
          if (cp) {
            setTitle(cp.title || '');
            setClientId(cp.client_id);
            setExchangeRate(cp.exchange_rate);
            setGlobalMarkup(cp.global_markup);
            setHasVat(cp.has_vat);

            const { data: items } = await supabase
              .from('cp_items')
              .select('*, catalog:price_catalog(*)') // Join just to get current catalog details if available
              .eq('cp_id', proposalId);

            if (items) {
              const mappedCart: CartItem[] = items.map((i: any) => ({
                catalog_id: i.catalog_id,
                // Prefer snapshot data if available (implied), otherwise fallback to catalog
                name: i.snapshot_name || i.catalog?.name || 'Unknown Item',
                description: i.snapshot_description || i.catalog?.description || '',
                unit: i.snapshot_unit || i.catalog?.unit || 'шт',
                category: i.snapshot_global_category || i.catalog?.global_category || 'Uncategorized',
                quantity: i.quantity,
                base_eur: i.snapshot_base_price_eur || i.catalog?.price_eur || 0,
                // Markup logic: approximate based on final price if strict field missing
                item_markup: i.catalog?.markup_percent || 0,
              }));
              setCart(mappedCart);
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

  const calculateUnitBYN = (item: CartItem) => {
    const baseWithMarkups = item.base_eur * (1 + (item.item_markup + globalMarkup) / 100);
    return baseWithMarkups * exchangeRate;
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let cogs = 0; // Cost of Goods Sold (Себестоимость)

    cart.forEach(i => {
      subtotal += calculateUnitBYN(i) * i.quantity;
      cogs += i.base_eur * exchangeRate * i.quantity;
    });
    
    const vat = hasVat ? subtotal * 0.2 : 0;
    const profit = subtotal - cogs;
    
    // Calculate MARKUP % (Profit / COGS) instead of Margin (Profit / Revenue)
    const markupPercent = cogs > 0 ? (profit / cogs) * 100 : 0;

    return { subtotal, vat, total: subtotal + vat, profit, markupPercent };
  }, [cart, globalMarkup, exchangeRate, hasVat]);

  const addToCart = (item: PriceCatalogItem) => {
    setCart(prev => {
      const exists = prev.find(c => c.catalog_id === item.id);
      if (exists) {
        return prev.map(c => c.catalog_id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, {
        catalog_id: item.id,
        name: item.name,
        description: item.description,
        unit: item.unit,
        quantity: 1,
        base_eur: item.price_eur,
        item_markup: item.markup_percent,
        category: item.global_category
      }];
    });
  };

  const updateQuantity = (id: string, qty: number) => {
    if (qty < 1) {
      setCart(prev => prev.filter(c => c.catalog_id !== id));
    } else {
      setCart(prev => prev.map(c => c.catalog_id === id ? { ...c, quantity: qty } : c));
    }
  };

  const updateMarkup = (id: string, markup: number) => {
    setCart(prev => prev.map(c => c.catalog_id === id ? { ...c, item_markup: markup } : c));
  };

  const handleSave = async () => {
    if (!clientId) { setToast({ message: 'Выберите клиента', type: 'error' }); return; }
    if (cart.length === 0) { setToast({ message: 'Корзина пуста', type: 'error' }); return; }

    setLoading(true);
    try {
      let cpId = proposalId;

      // 1. Create or Update Header
      const headerPayload = {
        title: title || null,
        client_id: clientId,
        status: 'draft',
        exchange_rate: exchangeRate,
        global_markup: globalMarkup,
        has_vat: hasVat,
        total_amount_byn: totals.total,
        created_by: profile.id
      };

      if (cpId) {
        const { error } = await supabase.from('commercial_proposals').update(headerPayload).eq('id', cpId);
        if (error) throw error;
        // Clear old items to replace with new ones (simple strategy)
        await supabase.from('cp_items').delete().eq('cp_id', cpId);
      } else {
        const { data, error } = await supabase.from('commercial_proposals').insert([headerPayload]).select('id').single();
        if (error) throw error;
        cpId = data.id;
      }

      // 2. Create Items with SNAPSHOT data
      if (cpId) {
        const itemsPayload = cart.map(item => ({
          cp_id: cpId,
          catalog_id: item.catalog_id,
          quantity: item.quantity,
          final_price_byn: calculateUnitBYN(item),
          // Snapshot Fields
          snapshot_name: item.name,
          snapshot_description: item.description,
          snapshot_unit: item.unit,
          snapshot_base_price_eur: item.base_eur,
          snapshot_global_category: item.category
        }));

        const { error: itemsError } = await supabase.from('cp_items').insert(itemsPayload);
        if (itemsError) throw itemsError;
      }

      setToast({ message: proposalId ? 'КП обновлено' : 'КП успешно создано', type: 'success' });
      onSuccess();
    } catch (e: any) {
      console.error(e);
      setToast({ message: 'Ошибка: ' + e.message, type: 'error' });
    }
    setLoading(false);
  };

  // Filter Logic
  const uniqueCategories = useMemo(() => {
    const cats = new Set(catalog.map(i => i.global_category));
    return Array.from(cats).sort();
  }, [catalog]);

  const availableTypes = useMemo(() => {
    let types = new Set<string>();
    if (catFilter === 'all') {
      catalog.forEach(i => types.add(i.item_type));
    } else {
      catalog
        .filter(i => i.global_category === catFilter)
        .forEach(i => types.add(i.item_type));
    }
    return Array.from(types).sort();
  }, [catalog, catFilter]);

  useEffect(() => {
    if (typeFilter !== 'all' && !availableTypes.includes(typeFilter)) {
      setTypeFilter('all');
    }
  }, [catFilter, availableTypes]);

  const filteredCatalog = useMemo(() => {
    return catalog.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
      const matchCat = catFilter === 'all' || c.global_category === catFilter;
      const matchType = typeFilter === 'all' || c.item_type === typeFilter;
      return matchSearch && matchCat && matchType;
    });
  }, [catalog, search, catFilter, typeFilter]);

  // Group Cart by Category
  const groupedCart = useMemo(() => {
    const groups: Record<string, CartItem[]> = {};
    cart.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [cart]);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Top Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap gap-4 items-end shrink-0">
        <div className="flex-grow min-w-[200px]">
          <Input 
            label="Название проекта / Объекта" 
            placeholder="Напр: Автоматизация офиса" 
            value={title} 
            onChange={(e:any) => setTitle(e.target.value)} 
            icon="business"
          />
        </div>
        <Select 
          label="Клиент" 
          value={clientId} 
          onChange={(e:any) => setClientId(e.target.value)}
          options={[{value:'', label:'Выберите клиента'}, ...clients.map(c => ({value:c.id, label:c.name}))]}
          className="w-64"
        />
        <div className="w-24">
          <Input label="Курс EUR" type="number" step="0.01" value={exchangeRate} onChange={(e:any) => setExchangeRate(parseFloat(e.target.value))} />
        </div>
        <div className="w-24">
          <Input label="Наценка %" type="number" value={globalMarkup} onChange={(e:any) => setGlobalMarkup(parseFloat(e.target.value))} />
        </div>
        <div className="pb-3 px-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={hasVat} onChange={(e) => setHasVat(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <span className="text-sm font-bold text-slate-700">НДС 20%</span>
          </label>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={onCancel}>Отмена</Button>
          <Button icon="save" onClick={handleSave} loading={loading}>Сохранить КП</Button>
        </div>
      </div>

      <div className="flex-grow grid grid-cols-1 lg:grid-cols-10 gap-4 overflow-hidden">
        {/* Left: Catalog (70% width -> col-span-7) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex gap-2">
            <Input placeholder="Поиск товара..." value={search} onChange={(e:any) => setSearch(e.target.value)} className="flex-grow" icon="search" />
            <div className="w-48">
              <Select 
                value={catFilter} 
                onChange={(e:any) => setCatFilter(e.target.value)} 
                options={[{value:'all', label:'Все категории'}, ...uniqueCategories.map(c => ({value:c, label:c}))]} 
              />
            </div>
            <div className="w-40">
              <Select 
                value={typeFilter} 
                onChange={(e:any) => setTypeFilter(e.target.value)} 
                options={[{value:'all', label:'Все типы'}, ...availableTypes.map(c => ({value:c, label:c}))]} 
              />
            </div>
          </div>
          <div className="flex-grow overflow-y-auto p-2">
            {filteredCatalog.map(item => (
              <div key={item.id} onClick={() => addToCart(item)} className="p-3 mb-1 rounded-xl border border-slate-100 hover:border-blue-300 hover:bg-slate-50 cursor-pointer transition-all flex justify-between items-center group">
                <div className="flex flex-col gap-1 overflow-hidden">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-2">{item.global_category}</span>
                    <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">{item.item_type}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 truncate">{item.name}</p>
                  {item.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 leading-tight">{item.description}</p>
                  )}
                </div>
                <div className="text-right pl-2 shrink-0">
                  <p className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded">€{item.price_eur}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Cart (30% width -> col-span-3) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <span className="material-icons-round text-slate-400">shopping_cart</span>
              Корзина КП
            </h3>
          </div>
          <div className="flex-grow overflow-y-auto p-4 space-y-6">
            {cart.length === 0 ? (
              <p className="text-center text-slate-400 mt-10 italic text-sm">Добавьте товары из каталога</p>
            ) : (
              Object.entries(groupedCart).map(([category, items]: [string, CartItem[]]) => {
                const catTotal = items.reduce((sum, i) => sum + calculateUnitBYN(i) * i.quantity, 0);
                const catCount = items.reduce((sum, i) => sum + i.quantity, 0);
                
                return (
                  <div key={category} className="space-y-2">
                    <div className="bg-slate-100 px-3 py-2 rounded-lg flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">{category}</span>
                      <span className="text-[10px] font-bold text-slate-500">{catCount} шт. • {catTotal.toFixed(0)} BYN</span>
                    </div>
                    {items.map(item => (
                      <div key={item.catalog_id} className="flex items-center gap-2 pl-1 group">
                        <div className="flex-grow min-w-0 flex flex-col">
                          <div className="flex items-center gap-1">
                            <p className="text-xs font-medium truncate text-slate-800 leading-tight">{item.name}</p>
                            {item.description && (
                              <span className="material-icons-round text-[14px] text-slate-300 hover:text-blue-500 cursor-help" title={item.description}>info</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] text-slate-400">
                              {calculateUnitBYN(item).toFixed(2)} BYN
                            </p>
                            <div className="flex flex-col items-end">
                              <input 
                                type="number" 
                                value={item.item_markup} 
                                onChange={(e) => updateMarkup(item.catalog_id, parseFloat(e.target.value))}
                                className="w-14 h-6 text-[10px] bg-slate-50 border border-slate-200 rounded text-right px-1 focus:border-blue-500 outline-none text-slate-600"
                                placeholder="%"
                              />
                            </div>
                          </div>
                        </div>
                        <input 
                          type="number" 
                          min="1" 
                          value={item.quantity} 
                          onChange={(e) => updateQuantity(item.catalog_id, parseInt(e.target.value))}
                          className="w-12 h-8 bg-white border border-slate-300 rounded text-center font-bold text-xs text-slate-900 focus:border-blue-500 outline-none"
                        />
                        <button onClick={() => updateQuantity(item.catalog_id, 0)} className="text-slate-300 hover:text-red-500 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors">
                          <span className="material-icons-round text-sm">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
          <div className="p-5 bg-slate-50 border-t border-slate-200">
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
            
            {/* Profit & Markup Analysis Block */}
            <div className="mt-3 pt-2 border-t border-slate-200 flex justify-between items-center group cursor-help opacity-70 hover:opacity-100 transition-opacity" title="Расчет: Прибыль / Себестоимость * 100% (Наценка)">
               <span className="text-[10px] text-slate-400">Ориентировочная прибыль:</span>
               <div className="text-right">
                 <span className="text-xs font-medium text-slate-500 mr-2">
                   {totals.profit.toFixed(2)} BYN
                 </span>
                 <span className={`text-xs font-bold ${
                   totals.markupPercent > 15 ? 'text-emerald-600' : 
                   totals.markupPercent >= 10 ? 'text-amber-500' : 'text-red-500'
                 }`}>
                   {totals.markupPercent.toFixed(1)}%
                 </span>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CPGenerator;
