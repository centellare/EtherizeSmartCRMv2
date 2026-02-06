
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Input, Modal, Badge, Toast, Select, ConfirmModal } from '../../ui';
import { PriceCatalogItem } from '../../../types';

const PAGE_SIZE = 25;

const PriceManager: React.FC<{ profile: any }> = ({ profile }) => {
  const [items, setItems] = useState<PriceCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Pagination & Count
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  
  // Dynamic Options for Filters & Inputs
  // Store raw pairs to handle cascading logic
  const [filterData, setFilterData] = useState<{global_category: string, item_type: string}[]>([]);

  // Global Settings
  const [exchangeRate, setExchangeRate] = useState<number>(3.5);
  const [globalMarkup, setGlobalMarkup] = useState<number>(0);

  // Edit/Add State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceCatalogItem | null>(null);
  const [formData, setFormData] = useState({
    global_category: '',
    item_type: '',
    name: '',
    description: '',
    price_eur: '',
    markup_percent: '0'
  });

  // Category Rename State
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [categoryToRename, setCategoryToRename] = useState({ oldName: '', newName: '' });

  // Delete State
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const canEdit = profile?.role === 'admin' || profile?.role === 'director';

  // Fetch unique values for filters (Initial Load)
  const fetchFilterOptions = async () => {
    const { data } = await supabase.from('price_catalog').select('global_category, item_type').eq('is_active', true);
    if (data) {
      setFilterData(data);
    }
  };

  // Derived Filter Options (Main Table)
  const uniqueCategories = useMemo(() => {
    const cats = new Set(filterData.map(i => i.global_category));
    return Array.from(cats).sort();
  }, [filterData]);

  const availableTypes = useMemo(() => {
    let types = new Set<string>();
    if (categoryFilter === 'all') {
      filterData.forEach(i => types.add(i.item_type));
    } else {
      filterData
        .filter(i => i.global_category === categoryFilter)
        .forEach(i => types.add(i.item_type));
    }
    return Array.from(types).sort();
  }, [filterData, categoryFilter]);

  // Derived Options for Modal (Independent Cascading)
  const modalCategories = useMemo(() => {
    const cats = new Set(filterData.map(i => i.global_category));
    return Array.from(cats).sort();
  }, [filterData]);

  const modalTypes = useMemo(() => {
    const currentCat = formData.global_category;
    let relevantItems = filterData;
    
    if (currentCat) {
       // Filter types strictly by the entered category if it exists in DB
       const exactMatches = filterData.filter(i => i.global_category === currentCat);
       if (exactMatches.length > 0) {
         relevantItems = exactMatches;
       } else {
         // If it's a new category (not in DB), don't suggest types from other categories
         relevantItems = [];
       }
    }
    
    return Array.from(new Set(relevantItems.map(i => i.item_type))).sort();
  }, [filterData, formData.global_category]);

  // Reset type filter if selected type doesn't exist in new category
  useEffect(() => {
    if (typeFilter !== 'all' && !availableTypes.includes(typeFilter)) {
      setTypeFilter('all');
    }
  }, [categoryFilter, availableTypes]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('price_catalog')
        .select('*', { count: 'exact' })
        .eq('is_active', true);

      // Filters
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }
      if (categoryFilter !== 'all') {
        query = query.eq('global_category', categoryFilter);
      }
      if (typeFilter !== 'all') {
        query = query.eq('item_type', typeFilter);
      }

      // Pagination
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      const { data, count, error } = await query
        .order('global_category', { ascending: true }) // Important for grouping
        .order('item_type', { ascending: true })
        .order('name', { ascending: true })
        .range(from, to);

      if (error) throw error;

      setItems(data || []);
      setTotalCount(count || 0);
    } catch (e: any) {
      console.error(e);
      setToast({ message: 'Ошибка загрузки: ' + e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter, typeFilter]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [search, categoryFilter, typeFilter]);

  useEffect(() => { 
    fetchData(); 
    fetchFilterOptions();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setLoading(true);
    
    // Duplicate Check (Only on Create or if Name changed)
    if (!editingItem || editingItem.name !== formData.name) {
      const { data: dup } = await supabase
        .from('price_catalog')
        .select('id')
        .eq('name', formData.name)
        .neq('is_active', false)
        .maybeSingle();
      
      if (dup) {
        setToast({ message: 'Товар с таким названием уже существует!', type: 'error' });
        setLoading(false);
        return;
      }
    }

    const payload = {
      ...formData,
      price_eur: parseFloat(formData.price_eur) || 0,
      markup_percent: parseFloat(formData.markup_percent) || 0,
      updated_at: new Date().toISOString()
    };

    let error;
    if (editingItem) {
      const res = await supabase.from('price_catalog').update(payload).eq('id', editingItem.id);
      error = res.error;
    } else {
      const res = await supabase.from('price_catalog').insert([payload]);
      error = res.error;
    }

    if (!error) {
      setToast({ message: editingItem ? 'Товар обновлен' : 'Товар добавлен', type: 'success' });
      setIsModalOpen(false);
      fetchData();
      fetchFilterOptions();
    } else {
      setToast({ message: 'Ошибка: ' + error.message, type: 'error' });
    }
    setLoading(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    setLoading(true);
    const { error } = await supabase.from('price_catalog').update({ is_active: false }).eq('id', deleteConfirm.id);
    
    if (!error) {
      setToast({ message: 'Товар удален', type: 'success' });
      setDeleteConfirm({ open: false, id: null });
      fetchData();
    } else {
      setToast({ message: 'Ошибка удаления', type: 'error' });
    }
    setLoading(false);
  };

  const handleRenameCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryToRename.newName.trim()) return;
    setLoading(true);

    const { error } = await supabase
      .from('price_catalog')
      .update({ global_category: categoryToRename.newName })
      .eq('global_category', categoryToRename.oldName);

    if (!error) {
      setToast({ message: 'Категория переименована', type: 'success' });
      setRenameModalOpen(false);
      fetchData();
      fetchFilterOptions();
    } else {
      setToast({ message: 'Ошибка переименования', type: 'error' });
    }
    setLoading(false);
  };

  const openCreate = () => {
    setEditingItem(null);
    setFormData({ global_category: '', item_type: '', name: '', description: '', price_eur: '', markup_percent: '0' });
    setIsModalOpen(true);
  };

  const openEdit = (item: PriceCatalogItem) => {
    setEditingItem(item);
    setFormData({
      global_category: item.global_category,
      item_type: item.item_type,
      name: item.name,
      description: item.description || '',
      price_eur: item.price_eur.toString(),
      markup_percent: item.markup_percent.toString()
    });
    setIsModalOpen(true);
  };

  const openRenameCategory = (oldName: string) => {
    setCategoryToRename({ oldName, newName: oldName });
    setRenameModalOpen(true);
  };

  const calculateBYN = (eur: number, itemMarkup: number) => {
    const totalMarkup = globalMarkup + itemMarkup;
    return (eur * (1 + totalMarkup / 100)) * exchangeRate;
  };

  // Pagination calculation
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const startRange = page * PAGE_SIZE + 1;
  const endRange = Math.min((page + 1) * PAGE_SIZE, totalCount);

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Hide native datalist arrow to prevent double arrows with our custom icon */}
      <style>{`
        input[list]::-webkit-calendar-picker-indicator {
          display: none !important;
          opacity: 0 !important;
        }
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Settings & Filters Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap gap-6 items-end border-b border-slate-100 pb-4">
          <div className="w-32">
            <Input label="Курс EUR" type="number" step="0.01" value={exchangeRate} onChange={(e:any) => setExchangeRate(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="w-32">
            <Input label="Наценка %" type="number" value={globalMarkup} onChange={(e:any) => setGlobalMarkup(parseFloat(e.target.value) || 0)} />
          </div>
          {canEdit && (
            <div className="ml-auto">
              <Button icon="add" onClick={openCreate}>Добавить товар</Button>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-4 items-center">
          <div className="w-full max-w-xs">
            <Input placeholder="Поиск..." value={search} onChange={(e:any) => setSearch(e.target.value)} icon="search" className="h-10 text-sm" />
          </div>
          <div className="w-full lg:w-48">
            <Select 
              value={categoryFilter}
              onChange={(e:any) => setCategoryFilter(e.target.value)}
              options={[
                { value: 'all', label: 'Все категории' }, 
                ...uniqueCategories.map(c => ({ value: c, label: c }))
              ]}
              className="h-10 text-sm !py-0"
            />
          </div>
          <div className="w-full lg:w-48">
            <Select 
              value={typeFilter}
              onChange={(e:any) => setTypeFilter(e.target.value)}
              options={[
                { value: 'all', label: 'Все типы' }, 
                ...availableTypes.map(t => ({ value: t, label: t }))
              ]}
              className="h-10 text-sm !py-0"
            />
          </div>
        </div>
      </div>

      {/* Table Area */}
      <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm flex-grow flex flex-col">
        <div className="overflow-x-auto flex-grow">
          <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-20 shadow-sm">
              <tr>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase w-1/3">Наименование</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase w-48 min-w-[12rem]">Тип</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase w-24">EUR</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase w-24">Наценка</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase w-32">BYN</th>
                <th className="p-4 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && items.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-slate-400">Загрузка...</td></tr>
              ) : (
                items.map((item, index) => {
                  const showHeader = index === 0 || item.global_category !== items[index - 1].global_category;
                  
                  return (
                    <React.Fragment key={item.id}>
                      {showHeader && (
                        // Sticky Header for Category
                        <tr className="bg-slate-100/90 backdrop-blur-sm sticky top-[45px] z-10 shadow-sm border-y border-slate-200">
                          <td colSpan={6} className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-widest">{item.global_category}</span>
                              {canEdit && (
                                <button 
                                  onClick={() => openRenameCategory(item.global_category)}
                                  className="w-5 h-5 flex items-center justify-center rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-100 transition-colors"
                                  title="Переименовать категорию"
                                >
                                  <span className="material-icons-round text-xs">edit</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      
                      <tr className="hover:bg-blue-50/30 group transition-colors">
                        <td className="p-4 align-top">
                          <p className="text-sm font-bold text-slate-900 break-words">{item.name}</p>
                          {item.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.description}</p>}
                        </td>
                        <td className="p-4 align-top">
                          <p className="text-xs text-slate-600 font-medium leading-relaxed whitespace-normal bg-slate-50 rounded px-2 py-1 inline-block border border-slate-100">
                            {item.item_type}
                          </p>
                        </td>
                        <td className="p-4 align-top font-mono text-sm text-slate-600">€{item.price_eur}</td>
                        <td className="p-4 align-top text-sm text-slate-500">{item.markup_percent > 0 ? `+${item.markup_percent}%` : '0%'}</td>
                        <td className="p-4 align-top font-bold text-emerald-700 text-sm">
                          {calculateBYN(item.price_eur, item.markup_percent).toFixed(2)}
                        </td>
                        <td className="p-4 align-top text-right">
                          <div className="flex gap-1 justify-end">
                            {canEdit && (
                              <>
                                <button 
                                  onClick={() => openEdit(item)} 
                                  className="w-8 h-8 rounded-full hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors flex items-center justify-center"
                                  title="Редактировать"
                                >
                                  <span className="material-icons-round text-sm">edit</span>
                                </button>
                                <button 
                                  onClick={() => setDeleteConfirm({ open: true, id: item.id })} 
                                  className="w-8 h-8 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors flex items-center justify-center"
                                  title="Удалить"
                                >
                                  <span className="material-icons-round text-sm">delete</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div className="p-4 border-t border-slate-100 flex flex-wrap items-center justify-center sm:justify-between bg-slate-50 gap-4">
           <div className="flex items-center gap-1">
             <Button variant="ghost" disabled={page === 0 || loading} onClick={() => setPage(0)} className="h-8 w-8 !px-0" title="В начало">
               <span className="material-icons-round text-sm">first_page</span>
             </Button>
             <Button variant="ghost" disabled={page === 0 || loading} onClick={() => setPage(p => Math.max(0, p - 1))} className="h-8 w-8 !px-0" title="Назад">
               <span className="material-icons-round text-sm">chevron_left</span>
             </Button>
           </div>

           <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
             Показано: {totalCount > 0 ? `${startRange}-${endRange}` : '0'} из {totalCount}
           </span>

           <div className="flex items-center gap-1">
             <Button variant="ghost" disabled={(page + 1) * PAGE_SIZE >= totalCount || loading} onClick={() => setPage(p => p + 1)} className="h-8 w-8 !px-0" title="Вперед">
               <span className="material-icons-round text-sm">chevron_right</span>
             </Button>
             <Button variant="ghost" disabled={(page + 1) * PAGE_SIZE >= totalCount || loading} onClick={() => setPage(totalPages - 1)} className="h-8 w-8 !px-0" title="В конец">
               <span className="material-icons-round text-sm">last_page</span>
             </Button>
           </div>
        </div>
      </div>

      {/* Create/Edit Item Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "Редактирование" : "Новый товар"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="w-full min-w-0">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Категория</label>
              <div className="relative">
                <input 
                  list="modal-categories-list" 
                  required 
                  className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-base outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/5 placeholder:text-slate-300 truncate pr-10 leading-relaxed appearance-none"
                  style={{ textOverflow: 'ellipsis' }}
                  value={formData.global_category} 
                  onChange={(e) => setFormData({...formData, global_category: e.target.value})} 
                  placeholder="Выберите или введите..."
                />
                <datalist id="modal-categories-list">
                  {modalCategories.map(c => <option key={c} value={c} title={c} />)}
                </datalist>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                  <span className="material-icons-round text-slate-400 text-sm">expand_more</span>
                </div>
              </div>
            </div>
            <div className="w-full min-w-0">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Тип</label>
              <div className="relative">
                <input 
                  list="modal-types-list" 
                  required 
                  className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-base outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/5 placeholder:text-slate-300 truncate pr-10 leading-relaxed appearance-none"
                  style={{ textOverflow: 'ellipsis' }}
                  value={formData.item_type} 
                  onChange={(e) => setFormData({...formData, item_type: e.target.value})} 
                  placeholder="Выберите или введите..."
                />
                <datalist id="modal-types-list">
                  {modalTypes.map(t => <option key={t} value={t} title={t} />)}
                </datalist>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                  <span className="material-icons-round text-slate-400 text-sm">expand_more</span>
                </div>
              </div>
            </div>
          </div>
          <Input label="Название" required value={formData.name} onChange={(e:any) => setFormData({...formData, name: e.target.value})} />
          <div className="w-full">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Описание</label>
            <textarea className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/5" rows={2} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Цена (EUR)" type="number" step="0.01" required value={formData.price_eur} onChange={(e:any) => setFormData({...formData, price_eur: e.target.value})} />
            <Input label="Индивид. наценка (%)" type="number" step="0.1" value={formData.markup_percent} onChange={(e:any) => setFormData({...formData, markup_percent: e.target.value})} />
          </div>
          <Button type="submit" className="w-full h-12" loading={loading} icon="save">Сохранить</Button>
        </form>
      </Modal>

      {/* Rename Category Modal */}
      <Modal isOpen={renameModalOpen} onClose={() => setRenameModalOpen(false)} title="Переименовать категорию">
        <form onSubmit={handleRenameCategory} className="space-y-4">
          <p className="text-sm text-slate-500">
            Все товары из категории <b>{categoryToRename.oldName}</b> будут перемещены в новую категорию.
          </p>
          <Input 
            label="Новое название" 
            required 
            value={categoryToRename.newName} 
            onChange={(e:any) => setCategoryToRename({...categoryToRename, newName: e.target.value})} 
          />
          <Button type="submit" className="w-full h-12" loading={loading}>Переименовать</Button>
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={deleteConfirm.open} 
        onClose={() => setDeleteConfirm({ open: false, id: null })} 
        onConfirm={handleDeleteConfirm}
        title="Удаление товара"
        message="Вы уверены, что хотите удалить этот товар из прайса?"
        confirmVariant="danger"
        loading={loading}
      />
    </div>
  );
};

export default PriceManager;
