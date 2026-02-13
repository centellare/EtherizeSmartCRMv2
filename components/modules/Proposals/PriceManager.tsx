
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Input, Modal, Toast, Badge, ProductImage } from '../../ui';
import { Product } from '../../../types';
import { ProductForm } from '../Inventory/modals/ProductForm';

const PriceManager: React.FC<{ profile: any }> = ({ profile }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Filters
  const [search, setSearch] = useState('');
  
  // Grouping State: Default closed (empty set)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const canEdit = profile?.role === 'admin' || profile?.role === 'director';

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').eq('is_archived', false).order('category').order('name');
    setProducts((data || []) as unknown as Product[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
         <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
                <h3 className="font-medium text-slate-800">Прайс-лист компании</h3>
                <p className="text-xs text-slate-500">Управление розничными и закупочными ценами</p>
            </div>
            {canEdit && (
                <Button icon="add" onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}>Добавить позицию</Button>
            )}
         </div>
         
         <div className="flex gap-4">
            <Input placeholder="Поиск товара..." value={search} onChange={(e:any) => setSearch(e.target.value)} icon="search" className="flex-grow" />
         </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm flex-grow flex flex-col min-h-0">
         {/* Fixed Header */}
         <div className="bg-slate-50 border-b border-slate-200 grid grid-cols-[60px_3fr_1fr_1fr_1fr_60px] text-xs font-bold text-slate-500 uppercase py-4 px-2 shrink-0">
             <div className="text-center">Фото</div>
             <div className="pl-2">Наименование / SKU</div>
             <div className="pl-2">Ед. изм</div>
             <div className="text-right pr-4">Закупка</div>
             <div className="text-right pr-4">Розница</div>
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

                    return (
                        <div key={category} className="border-b border-slate-100 last:border-0">
                            {/* Category Header */}
                            <div 
                                onClick={() => toggleCategory(category)}
                                className="bg-slate-100/50 hover:bg-slate-100 px-4 py-3 cursor-pointer flex items-center justify-between transition-colors sticky top-0 z-10 backdrop-blur-sm"
                            >
                                <div className="flex items-center gap-3">
                                    <button className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                                        <span className={`material-icons-round text-sm transition-transform ${shouldShow ? '-rotate-90' : 'rotate-0'}`}>expand_more</span>
                                    </button>
                                    <span className="font-bold text-slate-800 text-sm">{category}</span>
                                    <Badge color="slate">{items.length}</Badge>
                                </div>
                            </div>

                            {/* Items List */}
                            {shouldShow && (
                                <div className="divide-y divide-slate-50">
                                    {items.map(p => (
                                        <div key={p.id} className="grid grid-cols-[60px_3fr_1fr_1fr_1fr_60px] items-center py-3 px-2 hover:bg-blue-50/30 transition-colors group">
                                            <div className="flex justify-center">
                                                <ProductImage src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg border border-slate-100" preview />
                                            </div>
                                            <div className="pl-2 pr-4 min-w-0">
                                                <p className="font-bold text-slate-900 text-sm truncate">{p.name}</p>
                                                {p.sku && <span className="text-[10px] font-mono bg-slate-100 px-1 rounded text-slate-500">{p.sku}</span>}
                                            </div>
                                            <div className="pl-2 text-xs text-slate-500 font-bold">{p.unit}</div>
                                            <div className="text-right pr-4 font-mono text-xs">{p.base_price.toFixed(2)}</div>
                                            <div className="text-right pr-4 font-bold text-emerald-600 text-sm">{p.retail_price.toFixed(2)}</div>
                                            <div className="flex justify-end pr-2">
                                                {canEdit && (
                                                    <button onClick={() => { setEditingProduct(p); setIsModalOpen(true); }} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600">
                                                        <span className="material-icons-round text-sm">edit</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
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
