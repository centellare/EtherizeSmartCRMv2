
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Input, Modal, Toast, ProductImage, Badge } from '../../ui';
import { Product } from '../../../types';
import { ProductForm } from './modals/ProductForm';

const Nomenclature: React.FC<{ profile: any }> = ({ profile }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Edit/Add
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<any[]>([]);
  
  // Filters
  const [search, setSearch] = useState('');
  
  // Grouping State: Use 'expanded' logic so default is closed (empty set)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const canEdit = profile?.role === 'admin' || profile?.role === 'director' || profile?.role === 'manager';

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').eq('is_archived', false).order('category').order('name');
    setProducts((data || []) as unknown as Product[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Группировка продуктов
  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    
    products.forEach(p => {
        // Фильтрация
        const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                            p.sku?.toLowerCase().includes(search.toLowerCase()) ||
                            p.manufacturer?.toLowerCase().includes(search.toLowerCase());
        
        if (matchSearch) {
            const cat = p.category || 'Без категории';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(p);
        }
    });

    // Сортировка категорий
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [products, search]);

  const toggleCategory = (cat: string) => {
      setExpandedCategories(prev => {
          const next = new Set(prev);
          if (next.has(cat)) next.delete(cat);
          else next.add(cat);
          return next;
      });
  };

  const handleSuccess = () => {
      setIsModalOpen(false);
      fetchData();
      setToast({ message: editingProduct ? 'Товар обновлен' : 'Товар создан', type: 'success' });
  };

  // --- CSV PARSER ---
  const parseCSVLine = (line: string) => {
      const values = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
              if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; }
          } else if (char === ';' && !inQuotes) { values.push(current.trim()); current = ''; } else { current += char; }
      }
      values.push(current.trim());
      return values;
  };

  const handleParseImport = () => {
      if (!importText) return;
      const rows = importText.split('\n').filter(r => r.trim() !== '');
      const parsed = rows.slice(1).map(row => {
          const cols = parseCSVLine(row);
          if (cols.length < 4) return null;
          const typeRaw = cols[0]?.toLowerCase() || '';
          const type = typeRaw === 'услуга' ? 'service' : typeRaw === 'материал' ? 'material' : 'product';
          const category = cols[2] || cols[1] || 'Общее';
          const name = cols[3];
          if (!name) return null;
          const sku = cols[4];
          const unit = cols[5] || 'шт';
          const cleanPrice = (val: string) => { if (!val) return 0; return parseFloat(val.replace(/\s/g, '').replace(',', '.')) || 0; };
          const retail = cleanPrice(cols[6]);
          const cost = cleanPrice(cols[7]);
          const description = cols[8];
          const origin_country = cols[9];
          const manufacturer = cols[10];
          const weight = cleanPrice(cols[11]);

          return { name, sku, category, type, unit, base_price: cost, retail_price: retail, description, origin_country, manufacturer, weight, is_archived: false, has_serial: false };
      }).filter(Boolean);
      setImportPreview(parsed);
  };

  const handleExecuteImport = async () => {
      if (importPreview.length === 0) return;
      setLoading(true);
      try {
          const chunkSize = 50;
          for (let i = 0; i < importPreview.length; i += chunkSize) {
              const chunk = importPreview.slice(i, i + chunkSize);
              const { error } = await supabase.from('products').insert(chunk);
              if (error) throw error;
          }
          setToast({ message: `Успешно импортировано ${importPreview.length} товаров`, type: 'success' });
          setIsImportModalOpen(false);
          setImportText('');
          setImportPreview([]);
          fetchData();
      } catch (e: any) {
          setToast({ message: 'Ошибка импорта: ' + e.message, type: 'error' });
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="space-y-6 h-full flex flex-col min-h-0">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-4 shrink-0">
         <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
                <h3 className="font-medium text-slate-800">Справочник товаров (Номенклатура)</h3>
                <p className="text-xs text-slate-500">База данных оборудования и материалов</p>
            </div>
            {canEdit && (
                <div className="flex gap-2">
                    <Button variant="secondary" icon="upload_file" onClick={() => setIsImportModalOpen(true)}>Импорт из Excel</Button>
                    <Button icon="add" onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}>Добавить товар</Button>
                </div>
            )}
         </div>
         
         <div className="flex gap-4">
            <Input placeholder="Поиск по названию, типу, SKU, бренду..." value={search} onChange={(e:any) => setSearch(e.target.value)} icon="search" className="flex-grow" />
         </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm flex-grow flex flex-col min-h-0">
         {/* Fixed Header */}
         <div className="bg-slate-50 border-b border-slate-200 grid grid-cols-[60px_3fr_1fr_1fr_1fr_60px] text-xs font-bold text-slate-500 uppercase py-4 px-2 shrink-0">
             <div className="text-center">Фото</div>
             <div className="pl-2">Наименование / SKU</div>
             <div className="pl-2">Тип</div>
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
                    // Logic inverted: if in set -> Expanded. Default closed.
                    const isExpanded = expandedCategories.has(category);
                    
                    // If searching, auto-expand relevant categories
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
                                                <div className="flex gap-2 mt-1">
                                                    {p.sku && <span className="text-[10px] font-mono bg-slate-100 px-1 rounded text-slate-500">{p.sku}</span>}
                                                    {p.manufacturer && <span className="text-[10px] text-slate-400 flex items-center gap-1"><span className="material-icons-round text-[10px]">factory</span> {p.manufacturer}</span>}
                                                </div>
                                            </div>
                                            <div className="pl-2 text-xs text-slate-500">{p.type}</div>
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

      <Modal isOpen={isImportModalOpen} onClose={() => { setIsImportModalOpen(false); setImportPreview([]); setImportText(''); }} title="Импорт товаров из Excel (CSV)">
          <div className="space-y-4">
              {importPreview.length === 0 ? (
                  <>
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-900">
                        <p className="font-bold mb-1">Инструкция:</p>
                        <ol className="list-decimal list-inside space-y-1 text-xs">
                            <li>Сохраните ваш Excel файл как <b>CSV (разделители - точка с запятой)</b></li>
                            <li>Откройте его в Блокноте, скопируйте <b>ВЕСЬ текст</b> (включая заголовок) и вставьте ниже.</li>
                        </ol>
                    </div>
                    <textarea 
                        className="w-full h-64 p-3 border border-slate-300 rounded-xl font-mono text-[10px] focus:border-blue-500 outline-none resize-none"
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder="Вставьте содержимое CSV файла сюда..."
                    />
                    <Button onClick={handleParseImport} disabled={!importText} className="w-full h-12">Разобрать данные</Button>
                  </>
              ) : (
                  <>
                    <div className="flex justify-between items-center">
                        <p className="text-sm font-bold text-emerald-600">Распознано: {importPreview.length} шт.</p>
                        <button onClick={() => setImportPreview([])} className="text-xs text-slate-400 underline hover:text-red-500">Сбросить</button>
                    </div>
                    <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left text-[10px]">
                            <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                                <tr><th className="p-2">Название / SKU</th><th className="p-2">Категория</th><th className="p-2 text-right">Цена</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {importPreview.slice(0, 100).map((item, idx) => (
                                    <tr key={idx}><td className="p-2 truncate max-w-[150px]">{item.name}</td><td className="p-2">{item.category}</td><td className="p-2 text-right">{item.base_price}</td></tr>
                                ))}
                            </tbody>
                        </table>
                        {importPreview.length > 100 && <p className="text-center text-xs text-slate-400 p-2">...и еще {importPreview.length - 100}</p>}
                    </div>
                    <Button onClick={handleExecuteImport} loading={loading} className="w-full">Импортировать в базу</Button>
                  </>
              )}
          </div>
      </Modal>
    </div>
  );
};

export default Nomenclature;
