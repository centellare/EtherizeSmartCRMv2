
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Input, Modal, Toast, Select } from '../../ui';
import { Product } from '../../../types';
import { ProductForm } from './modals/ProductForm';

const Nomenclature: React.FC<{ profile: any }> = ({ profile }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Edit/Add
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const canEdit = profile?.role === 'admin' || profile?.role === 'director' || profile?.role === 'manager';

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').eq('is_archived', false).order('category').order('name');
    setProducts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const uniqueCategories = useMemo(() => Array.from(new Set(products.map(p => p.category))).sort(), [products]);
  
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                            p.sku?.toLowerCase().includes(search.toLowerCase()) ||
                            p.type?.toLowerCase().includes(search.toLowerCase());
        const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
        return matchSearch && matchCat;
    });
  }, [products, search, categoryFilter]);

  const handleSuccess = () => {
      setIsModalOpen(false);
      fetchData();
      setToast({ message: editingProduct ? 'Товар обновлен' : 'Товар создан', type: 'success' });
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-4">
         <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
                <h3 className="font-medium text-slate-800">Справочник товаров (Номенклатура)</h3>
                <p className="text-xs text-slate-500">База данных оборудования и материалов</p>
            </div>
            {canEdit && <Button icon="add" onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}>Добавить товар</Button>}
         </div>
         
         <div className="flex gap-4">
            <Input placeholder="Поиск по названию, типу, SKU..." value={search} onChange={(e:any) => setSearch(e.target.value)} icon="search" className="flex-grow" />
            <div className="w-64">
                <Select value={categoryFilter} onChange={(e:any) => setCategoryFilter(e.target.value)} options={[{value:'all', label:'Все категории'}, ...uniqueCategories.map(c => ({value:c, label:c}))]} />
            </div>
         </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm flex-grow overflow-auto">
         <table className="w-full text-left">
            <thead className="bg-slate-50 border-b sticky top-0 z-10">
                <tr>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Наименование / SKU</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Категория / Тип</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Закупка</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Розница</th>
                    <th className="p-4 w-20"></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {filteredProducts.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="p-4">
                            <p className="font-bold text-slate-900">{p.name}</p>
                            <div className="flex gap-2 mt-1">
                                {p.sku && <span className="text-[10px] font-mono bg-slate-100 px-1 rounded text-slate-500">{p.sku}</span>}
                                {p.has_serial && <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 rounded font-bold">S/N</span>}
                            </div>
                        </td>
                        <td className="p-4">
                            <p className="text-sm font-medium text-slate-700">{p.category}</p>
                            <p className="text-xs text-slate-500">{p.type}</p>
                        </td>
                        <td className="p-4 text-right font-mono text-xs">{p.base_price}</td>
                        <td className="p-4 text-right font-bold text-emerald-600">{p.retail_price}</td>
                        <td className="p-4 text-right">
                            {canEdit && (
                                <button onClick={() => { setEditingProduct(p); setIsModalOpen(true); }} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600">
                                    <span className="material-icons-round text-sm">edit</span>
                                </button>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
         </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProduct ? "Редактирование товара" : "Новый товар"}>
          <ProductForm 
            product={editingProduct} 
            categories={uniqueCategories}
            existingTypes={Array.from(new Set(products.map(p => p.type))).filter(Boolean)}
            onSuccess={handleSuccess} 
          />
      </Modal>
    </div>
  );
};

export default Nomenclature;
