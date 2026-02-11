
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Input, Modal, Toast, Select } from '../../ui';
import { Product } from '../../../types';

const PriceManager: React.FC<{ profile: any }> = ({ profile }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Edit/Add
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    category: '', type: 'product', name: '', description: '', 
    unit: 'шт', base_price: '', retail_price: '', has_serial: false, sku: ''
  });
  
  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const canEdit = profile?.role === 'admin' || profile?.role === 'director';

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
        const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase());
        const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
        return matchSearch && matchCat;
    });
  }, [products, search, categoryFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
        ...formData,
        base_price: parseFloat(formData.base_price) || 0,
        retail_price: parseFloat(formData.retail_price) || 0
    };

    if (editingProduct) {
        await supabase.from('products').update(payload).eq('id', editingProduct.id);
    } else {
        await supabase.from('products').insert([payload]);
    }
    
    setIsModalOpen(false);
    fetchData();
    setToast({ message: 'Сохранено успешно', type: 'success' });
    setLoading(false);
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-4">
         <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <h3 className="font-medium text-slate-800">Единый справочник (Номенклатура)</h3>
            {canEdit && <Button icon="add" onClick={() => { setEditingProduct(null); setFormData({ category: '', type: 'product', name: '', description: '', unit: 'шт', base_price: '', retail_price: '', has_serial: false, sku: '' }); setIsModalOpen(true); }}>Добавить товар</Button>}
         </div>
         
         <div className="flex gap-4">
            <Input placeholder="Поиск..." value={search} onChange={(e:any) => setSearch(e.target.value)} icon="search" className="flex-grow" />
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
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Категория</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Закупка (BYN)</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Продажа (BYN)</th>
                    <th className="p-4 w-20"></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {filteredProducts.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="p-4">
                            <p className="font-bold text-slate-900">{p.name}</p>
                            {p.sku && <span className="text-[10px] font-mono bg-slate-100 px-1 rounded">{p.sku}</span>}
                        </td>
                        <td className="p-4 text-sm text-slate-600">{p.category}</td>
                        <td className="p-4 text-right font-mono text-xs">{p.base_price}</td>
                        <td className="p-4 text-right font-bold text-emerald-600">{p.retail_price}</td>
                        <td className="p-4 text-right">
                            {canEdit && (
                                <button onClick={() => { setEditingProduct(p); setFormData({ ...p, base_price: p.base_price.toString(), retail_price: p.retail_price.toString(), description: p.description || '', sku: p.sku || '' } as any); setIsModalOpen(true); }} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600">
                                    <span className="material-icons-round text-sm">edit</span>
                                </button>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
         </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProduct ? "Редактирование" : "Новый товар"}>
          <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <Input label="Категория" required value={formData.category} onChange={(e:any) => setFormData({...formData, category: e.target.value})} list="cat-list" />
                  <datalist id="cat-list">{uniqueCategories.map(c => <option key={c} value={c}/>)}</datalist>
                  <Input label="Артикул (SKU)" value={formData.sku} onChange={(e:any) => setFormData({...formData, sku: e.target.value})} />
              </div>
              <Input label="Название" required value={formData.name} onChange={(e:any) => setFormData({...formData, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                  <Input label="Закупка (BYN)" type="number" required value={formData.base_price} onChange={(e:any) => setFormData({...formData, base_price: e.target.value})} />
                  <Input label="Продажа (BYN)" type="number" required value={formData.retail_price} onChange={(e:any) => setFormData({...formData, retail_price: e.target.value})} />
              </div>
              <div className="flex gap-4 items-center bg-slate-50 p-3 rounded-xl">
                  <Select label="Ед. изм." value={formData.unit} onChange={(e:any) => setFormData({...formData, unit: e.target.value})} options={[{value:'шт', label:'шт'}, {value:'м', label:'м'}, {value:'компл', label:'компл'}]} />
                  <label className="flex items-center gap-2 cursor-pointer mt-4">
                      <input type="checkbox" checked={formData.has_serial} onChange={(e) => setFormData({...formData, has_serial: e.target.checked})} className="w-4 h-4" />
                      <span className="text-sm font-bold text-slate-600">Нужен S/N</span>
                  </label>
              </div>
              <Button type="submit" className="w-full h-12" loading={loading}>Сохранить</Button>
          </form>
      </Modal>
    </div>
  );
};

export default PriceManager;
