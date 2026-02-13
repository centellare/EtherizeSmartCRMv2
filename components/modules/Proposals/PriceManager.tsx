
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Input, Modal, Toast, Badge, ProductImage } from '../../ui';
import { Product, PriceRule } from '../../../types';
import { ProductForm } from '../Inventory/modals/ProductForm';

const PriceManager: React.FC<{ profile: any }> = ({ profile }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [priceRules, setPriceRules] = useState<Record<string, number>>({});
  const [globalMarkup, setGlobalMarkup] = useState(15);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const canEdit = profile?.role === 'admin' || profile?.role === 'director';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
        const [prodRes, settingsRes, rulesRes] = await Promise.all([
            supabase.from('products').select('*').eq('is_archived', false).order('category').order('name'),
            supabase.from('company_settings').select('global_markup').limit(1).maybeSingle(),
            supabase.from('price_rules').select('*')
        ]);

        if (prodRes.data) setProducts((prodRes.data || []) as unknown as Product[]);
        if (settingsRes.data && settingsRes.data.global_markup !== null) {
            setGlobalMarkup(settingsRes.data.global_markup);
        }
        
        const rulesMap: Record<string, number> = {};
        rulesRes.data?.forEach((r: any) => {
            rulesMap[r.category_name] = r.markup_delta;
        });
        setPriceRules(rulesMap);

    } catch (e: any) {
        console.error(e);
        setToast({ message: 'Ошибка загрузки данных', type: 'error' });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- CALCULATION LOGIC ---
  const calculateRetail = (base: number, catDelta: number, prodDelta: number) => {
      // Logic: Base * (1 + (Global% + CategoryDelta% + ProductDelta%)/100)
      const totalMarkupPercent = globalMarkup + catDelta + prodDelta;
      // Prevent negative price if markup < -100%
      const multiplier = Math.max(0, 1 + (totalMarkupPercent / 100));
      return base * multiplier;
  };

  const handleGlobalMarkupChange = async (newVal: string) => {
      const val = parseFloat(newVal) || 0;
      setGlobalMarkup(val); // Optimistic UI
      
      setCalculating(true);
      // Update DB
      const { data: settings } = await supabase.from('company_settings').select('id').limit(1).maybeSingle();
      if (settings) {
          await supabase.from('company_settings').update({ global_markup: val }).eq('id', settings.id);
      } else {
          // If no settings exist, create with defaults
          await supabase.from('company_settings').insert({ 
              global_markup: val, 
              company_name: 'My Company',
              default_vat_percent: 20
          });
      }
      
      // Recalculate ALL products in DB
      await recalculateAllPrices(val, priceRules);
      setCalculating(false);
  };

  const handleCategoryRuleChange = async (category: string, newDeltaStr: string) => {
      const val = parseFloat(newDeltaStr) || 0;
      const newRules = { ...priceRules, [category]: val };
      setPriceRules(newRules); // Optimistic UI

      // Update DB Rule
      await supabase.from('price_rules').upsert(
          { category_name: category, markup_delta: val }, 
          { onConflict: 'category_name' }
      );

      // Recalculate only products in this category
      await recalculateCategoryPrices(category, val);
  };

  const handleProductDeltaChange = async (product: Product, newDeltaStr: string) => {
      const val = parseFloat(newDeltaStr) || 0;
      
      // Optimistic Update
      setProducts(prev => prev.map(p => {
          if (p.id === product.id) {
              const catDelta = priceRules[p.category] || 0;
              const newRetail = calculateRetail(p.base_price, catDelta, val);
              return { ...p, markup_percent: val, retail_price: newRetail };
          }
          return p;
      }));

      // DB Update
      const catDelta = priceRules[product.category] || 0;
      const newRetail = calculateRetail(product.base_price, catDelta, val);
      
      await supabase.from('products').update({ 
          markup_percent: val,
          retail_price: newRetail
      }).eq('id', product.id);
  };

  // Bulk Recalculation Helpers
  const recalculateCategoryPrices = async (category: string, catDelta: number) => {
      setCalculating(true);
      const catProducts = products.filter(p => p.category === category);
      
      const updates = catProducts.map(p => {
          const prodDelta = p.markup_percent || 0;
          const newRetail = calculateRetail(p.base_price, catDelta, prodDelta);
          return { id: p.id, retail_price: newRetail }; 
      });

      // We have to update one by one or utilize upsert. Since retail_price varies per item, bulk update is tricky without a custom function or loop.
      const promises = updates.map(u => 
          supabase.from('products').update({ retail_price: u.retail_price }).eq('id', u.id)
      );
      
      await Promise.all(promises);
      
      // Update local state completely to ensure sync
      setProducts(prev => prev.map(p => {
          if (p.category === category) {
              const update = updates.find(u => u.id === p.id);
              return update ? { ...p, retail_price: update.retail_price } : p;
          }
          return p;
      }));
      setCalculating(false);
  };

  const recalculateAllPrices = async (global: number, rules: Record<string, number>) => {
      // Heavy operation warning
      const updates = products.map(p => {
          const catDelta = rules[p.category] || 0;
          const prodDelta = p.markup_percent || 0;
          const newRetail = calculateRetail(p.base_price, catDelta, prodDelta); // Use provided global, not state (might be stale)
          return { id: p.id, retail: newRetail };
      });

      // Batching to prevent request limits
      const chunkSize = 50;
      for (let i = 0; i < updates.length; i += chunkSize) {
          const chunk = updates.slice(i, i + chunkSize);
          await Promise.all(chunk.map(u => 
              supabase.from('products').update({ retail_price: u.retail }).eq('id', u.id)
          ));
      }
      
      // Update local
      setProducts(prev => prev.map(p => {
          const u = updates.find(up => up.id === p.id);
          return u ? { ...p, retail_price: u.retail } : p;
      }));
  };


  // Grouping Logic
  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    products.forEach(p => {
        const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                            p.sku?.toLowerCase().includes(search.toLowerCase());
        
        if (matchSearch) {
            const cat = p.category || 'Без категории';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(p);
        }
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [products, search]);

  const toggleCategory = (cat: string) => {
      setExpandedCategories(prev => {
          const next = new Set(prev);
          if (next.has(cat)) next.delete(cat); else next.add(cat);
          return next;
      });
  };

  const handleSuccess = () => {
      setIsModalOpen(false);
      fetchData();
      setToast({ message: 'Прайс обновлен', type: 'success' });
  };

  return (
    <div className="space-y-6 h-full flex flex-col min-h-0">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-4 shrink-0">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-4 gap-4">
            <div>
                <h3 className="font-medium text-slate-800">Прайс-лист (Каскадная наценка)</h3>
                <p className="text-xs text-slate-500">База + (Глобал % + Категория % + Товар %) = Розница</p>
            </div>
            
            {/* GLOBAL MARKUP SETTING */}
            <div className="flex items-center gap-3 bg-blue-50 p-2 px-4 rounded-2xl border border-blue-100">
                <span className="text-xs font-bold text-blue-800 uppercase">Базовая наценка компании:</span>
                <div className="relative w-20">
                    <input 
                        type="number" 
                        disabled={!canEdit}
                        value={globalMarkup}
                        onChange={(e) => handleGlobalMarkupChange(e.target.value)}
                        className="w-full bg-white border border-blue-200 rounded-lg px-2 py-1 text-right font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-300">%</span>
                </div>
            </div>

            {canEdit && (
                <Button icon="add" onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}>Добавить товар</Button>
            )}
         </div>
         
         <div className="flex gap-4 items-center">
            <Input placeholder="Поиск товара..." value={search} onChange={(e:any) => setSearch(e.target.value)} icon="search" className="flex-grow" />
            {calculating && <span className="text-xs font-bold text-slate-400 animate-pulse flex items-center gap-1"><span className="material-icons-round text-sm">sync</span> Пересчет цен...</span>}
         </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm flex-grow flex flex-col min-h-0">
         {/* Fixed Header */}
         <div className="bg-slate-50 border-b border-slate-200 grid grid-cols-[50px_3fr_80px_100px_2fr_100px_50px] text-xs font-bold text-slate-500 uppercase py-4 px-2 shrink-0 gap-2">
             <div className="text-center">Фото</div>
             <div className="pl-2">Наименование</div>
             <div className="text-center">Ед. изм</div>
             <div className="text-right">База (Закуп)</div>
             <div className="text-center">Формула цены (Наценки %)</div>
             <div className="text-right pr-2">Розница</div>
             <div></div>
         </div>

         {/* Scrollable Content */}
         <div className="overflow-y-auto flex-grow scrollbar-hide">
            {groupedProducts.length === 0 ? (
                <div className="p-10 text-center text-slate-400">Товары не найдены</div>
            ) : (
                groupedProducts.map(([category, items]) => {
                    const isExpanded = expandedCategories.has(category);
                    const shouldShow = search ? true : isExpanded;
                    const catDelta = priceRules[category] || 0;

                    return (
                        <div key={category} className="border-b border-slate-100 last:border-0">
                            {/* Category Header */}
                            <div 
                                className="bg-slate-100/50 hover:bg-slate-100 px-4 py-3 flex items-center justify-between transition-colors sticky top-0 z-10 backdrop-blur-sm group"
                            >
                                <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleCategory(category)}>
                                    <button className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                                        <span className={`material-icons-round text-sm transition-transform ${shouldShow ? '-rotate-90' : 'rotate-0'}`}>expand_more</span>
                                    </button>
                                    <span className="font-bold text-slate-800 text-sm">{category}</span>
                                    <Badge color="slate">{items.length}</Badge>
                                </div>

                                {/* CATEGORY RULE INPUT */}
                                <div className="flex items-center gap-2" title="Поправка наценки для всей категории">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase hidden md:inline">Поправка категории:</span>
                                    <div className="relative w-24">
                                        <input 
                                            type="number"
                                            disabled={!canEdit}
                                            value={catDelta}
                                            onChange={(e) => handleCategoryRuleChange(category, e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            className={`w-full border rounded-lg px-2 py-1 text-right font-bold text-xs outline-none focus:ring-2 focus:ring-blue-400 ${catDelta !== 0 ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-500'}`}
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Items List */}
                            {shouldShow && (
                                <div className="divide-y divide-slate-50">
                                    {items.map(p => {
                                        const prodDelta = p.markup_percent || 0;
                                        const totalPercent = globalMarkup + catDelta + prodDelta;
                                        // Re-calculate strictly for display to ensure consistency, though DB has it too
                                        const calcRetail = calculateRetail(p.base_price, catDelta, prodDelta);

                                        return (
                                            <div key={p.id} className="grid grid-cols-[50px_3fr_80px_100px_2fr_100px_50px] items-center py-2 px-2 hover:bg-blue-50/30 transition-colors group gap-2">
                                                <div className="flex justify-center">
                                                    <ProductImage src={p.image_url} alt={p.name} className="w-9 h-9 rounded-lg border border-slate-100" preview />
                                                </div>
                                                <div className="pl-2 pr-4 min-w-0">
                                                    <p className="font-bold text-slate-900 text-xs truncate" title={p.name}>{p.name}</p>
                                                    {p.sku && <span className="text-[9px] font-mono bg-slate-100 px-1 rounded text-slate-500">{p.sku}</span>}
                                                </div>
                                                <div className="text-center text-[10px] text-slate-500 font-bold">{p.unit}</div>
                                                <div className="text-right font-mono text-xs text-slate-600">{p.base_price.toFixed(2)}</div>
                                                
                                                {/* FORMULA PILL */}
                                                <div className="flex items-center justify-center">
                                                    <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1 border border-slate-200">
                                                        {/* Global */}
                                                        <div className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold" title="Глобальная">{globalMarkup}%</div>
                                                        <span className="text-[9px] text-slate-400">+</span>
                                                        {/* Category */}
                                                        <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${catDelta !== 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-400'}`} title="Категория">
                                                            {catDelta > 0 ? '+' : ''}{catDelta}%
                                                        </div>
                                                        <span className="text-[9px] text-slate-400">+</span>
                                                        {/* Product Input */}
                                                        <div className="relative w-14">
                                                            <input 
                                                                type="number"
                                                                disabled={!canEdit}
                                                                value={prodDelta}
                                                                onChange={(e) => handleProductDeltaChange(p, e.target.value)}
                                                                className={`w-full rounded border px-1 py-0.5 text-center text-[9px] font-bold outline-none focus:border-blue-500 ${prodDelta !== 0 ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-slate-300 text-slate-500'}`}
                                                                title="Индивидуальная поправка товара"
                                                            />
                                                        </div>
                                                        <span className="text-[9px] font-bold text-slate-600 ml-1">= {totalPercent}%</span>
                                                    </div>
                                                </div>

                                                <div className="text-right font-bold text-emerald-600 text-sm pr-2">{calcRetail.toFixed(2)}</div>
                                                
                                                <div className="flex justify-end">
                                                    {canEdit && (
                                                        <button onClick={() => { setEditingProduct(p); setIsModalOpen(true); }} className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600">
                                                            <span className="material-icons-round text-sm">edit</span>
                                                        </button>
                                                    )}
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProduct ? "Редактирование товара" : "Новый товар"}>
          <ProductForm 
            product={editingProduct} 
            categories={groupedProducts.map(g => g[0])}
            existingTypes={Array.from(new Set(products.map(p => p.type))).filter(Boolean)}
            onSuccess={handleSuccess} 
          />
      </Modal>
    </div>
  );
};

export default PriceManager;
