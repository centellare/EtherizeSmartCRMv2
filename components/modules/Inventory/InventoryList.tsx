
import React, { useState, useMemo } from 'react';
import { InventoryCatalogItem, InventoryItem } from '../../../types';
import { CartItem } from './index';
import { Badge, Input, Select, ConfirmModal, Button } from '../../ui';
import { formatDate, getMinskISODate } from '../../../lib/dateUtils';
import ItemDetailsDrawer from './ItemDetailsDrawer';

interface InventoryListProps {
  activeTab: 'catalog' | 'stock' | 'warranty';
  catalog: InventoryCatalogItem[];
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
  onEdit: (item: any, type: 'catalog' | 'item') => void;
  onRefresh: () => void;
  onDeleteItem: (id: string) => void;
  onDeleteCatalog: (id: string) => void;
}

const InventoryList: React.FC<InventoryListProps> = ({ 
  activeTab, catalog, items, loading, profile, 
  cart, onAddToCart, onRemoveFromCart, onBulkDeploy,
  onDeploy, onReplace, onReturn, onEdit, onRefresh, onDeleteItem, onDeleteCatalog 
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<InventoryItem | null>(null);

  // State for delete confirmation
  const [deleteConfig, setDeleteConfig] = useState<{ open: boolean; id: string | null; type: 'catalog' | 'item' }>({ 
    open: false, id: null, type: 'item' 
  });

  const isAdmin = profile?.role === 'admin';

  const filteredItems = useMemo(() => {
    let list = items;
    
    // Strict Tab Filtering
    if (activeTab === 'stock') {
        list = list.filter(i => i.status === 'in_stock');
    } else if (activeTab === 'warranty') {
        list = list.filter(i => i.status === 'deployed');
    }
    
    return list.filter(i => {
      const matchSearch = 
        i.serial_number?.toLowerCase().includes(search.toLowerCase()) || 
        i.catalog?.name.toLowerCase().includes(search.toLowerCase()) ||
        i.catalog?.sku?.toLowerCase().includes(search.toLowerCase()) ||
        i.object?.name.toLowerCase().includes(search.toLowerCase());
      
      const matchStatus = statusFilter === 'all' || i.status === statusFilter;
      const matchType = typeFilter === 'all' || i.catalog?.item_type === typeFilter;
      
      // Логика даты: для гарантии используем дату отгрузки, для склада - дату приемки
      const targetDate = activeTab === 'warranty' ? i.warranty_start : i.created_at;
      const itemDate = targetDate ? getMinskISODate(targetDate) : null;
      
      const matchDateFrom = !dateFrom || (itemDate && itemDate >= dateFrom);
      const matchDateTo = !dateTo || (itemDate && itemDate <= dateTo);

      return matchSearch && matchStatus && matchDateFrom && matchDateTo && matchType;
    });
  }, [items, search, statusFilter, typeFilter, dateFrom, dateTo, activeTab]);

  const filteredCatalog = useMemo(() => {
    return catalog.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
                          c.sku?.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === 'all' || c.item_type === typeFilter;
      return matchSearch && matchType;
    });
  }, [catalog, search, typeFilter]);

  // Расчет общей стоимости
  const totalSum = useMemo(() => {
    return filteredItems.reduce((acc, item) => {
        const price = item.purchase_price || item.catalog?.last_purchase_price || 0;
        return acc + (item.quantity * price);
    }, 0);
  }, [filteredItems]);

  // Группировка для вкладки Гарантия
  const groupedWarrantyItems = useMemo(() => {
    if (activeTab !== 'warranty') return [];

    // Используем отфильтрованный список, чтобы поиск работал
    const groups: Record<string, { id: string; objectName: string; date: string; items: InventoryItem[] }> = {};

    filteredItems.forEach(item => {
      const dateKey = item.warranty_start ? getMinskISODate(item.warranty_start) : 'unknown';
      const objId = item.current_object_id || 'no-object';
      const key = `${objId}_${dateKey}`;

      if (!groups[key]) {
        groups[key] = {
          id: key,
          objectName: item.objects?.name || item.object?.name || 'Без объекта',
          date: item.warranty_start || new Date().toISOString(),
          items: []
        };
      }
      groups[key].items.push(item);
    });

    return Object.values(groups).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredItems, activeTab]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('ru-BY', { style: 'currency', currency: 'BYN', maximumFractionDigits: 2 }).format(val);

  const handleConfirmDelete = () => {
    if (deleteConfig.id) {
      if (deleteConfig.type === 'catalog') {
        onDeleteCatalog(deleteConfig.id);
      } else {
        onDeleteItem(deleteConfig.id);
      }
    }
    setDeleteConfig({ ...deleteConfig, open: false });
  };

  const handlePrintTechnicalList = (group: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
        <html>
            <head>
                <title>Список отгруженного оборудования</title>
                <style>
                    body { font-family: sans-serif; padding: 40px; color: #1c1b1f; max-width: 900px; margin: 0 auto; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                    th, td { border: 1px solid #e1e2e1; padding: 8px 12px; text-align: left; vertical-align: top; }
                    th { background-color: #f8f9fa; font-weight: bold; }
                    .header { margin-bottom: 30px; border-bottom: 2px solid #1c1b1f; padding-bottom: 20px; }
                    .header h1 { margin: 0 0 10px 0; font-size: 20px; text-transform: uppercase; }
                    .info-row { margin-bottom: 5px; font-size: 14px; }
                    .footer { margin-top: 60px; display: flex; justify-content: space-between; font-size: 14px; }
                    .signature-block { width: 45%; }
                    .signature-line { border-top: 1px solid #000; margin-top: 40px; margin-bottom: 5px; }
                    .signature-hint { font-size: 10px; color: #666; }
                    @media print {
                        @page { margin: 1cm; }
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Список отгруженного оборудования и/или материалов</h1>
                    <div class="info-row"><strong>Объект:</strong> ${group.objectName}</div>
                    <div class="info-row"><strong>Дата отгрузки:</strong> ${formatDate(group.date)}</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 40px">№</th>
                            <th>Наименование</th>
                            <th style="width: 80px">Кол-во</th>
                            <th>Гарантия</th>
                            <th>Серийные номера</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${group.items.map((item: any, idx: number) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td>${item.catalog?.name}</td>
                                <td>${item.quantity} ${item.catalog?.unit}</td>
                                <td>${item.catalog?.warranty_period_months ? item.catalog.warranty_period_months + ' мес' : '-'}</td>
                                <td style="font-family: monospace;">${item.serial_number || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="footer">
                    <div class="signature-block">
                        <p><strong>Отпустил (Логист):</strong></p>
                        <div class="signature-line"></div>
                        <div class="signature-hint">(Подпись / ФИО)</div>
                    </div>
                    <div class="signature-block">
                        <p><strong>Принял (Инженер/Клиент):</strong></p>
                        <div class="signature-line"></div>
                        <div class="signature-hint">(Подпись / ФИО)</div>
                    </div>
                </div>
                
                <script>window.print();</script>
            </body>
        </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (activeTab === 'catalog') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <Input placeholder="Поиск по названию или артикулу..." value={search} onChange={(e: any) => setSearch(e.target.value)} icon="search" className="flex-grow" />
          <div className="w-full md:w-48">
            <Select 
              value={typeFilter}
              onChange={(e: any) => setTypeFilter(e.target.value)}
              options={[
                { value: 'all', label: 'Все типы' },
                { value: 'product', label: 'Оборудование' },
                { value: 'material', label: 'Материалы' }
              ]}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCatalog.map(c => (
            <div key={c.id} className="bg-white p-5 rounded-[24px] border border-slate-200 relative group">
              {isAdmin && (
                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEdit(c, 'catalog'); }}
                    className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-all"
                    title="Редактировать"
                  >
                    <span className="material-icons-round text-sm">edit</span>
                  </button>
                  <button 
                    type="button"
                    className="w-8 h-8 rounded-full bg-slate-100 text-red-600 hover:bg-red-50 flex items-center justify-center transition-all"
                    onClick={(e) => { 
                      e.preventDefault();
                      e.stopPropagation(); 
                      setDeleteConfig({ open: true, id: c.id, type: 'catalog' });
                    }}
                    title="Удалить"
                  >
                    <span className="material-icons-round text-sm">delete</span>
                  </button>
                </div>
              )}
              <div className="flex justify-between items-start mb-2 pr-20">
                <div>
                  <div className="flex gap-2 mb-1">
                    <Badge color={c.item_type === 'product' ? 'blue' : 'amber'}>{c.item_type === 'product' ? 'Оборудование' : 'Материал'}</Badge>
                    {c.sku && <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">SKU: {c.sku}</span>}
                  </div>
                  <h4 className="font-bold text-slate-900 mt-1">{c.name}</h4>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-4">
                 <Badge color="slate">{c.warranty_period_months} мес.</Badge>
              </div>
              <p className="text-sm text-slate-500 mb-4 line-clamp-2">{c.description || 'Нет описания'}</p>
              <div className="flex flex-wrap gap-2 items-center text-xs">
                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-bold">{c.unit || 'шт'}</span>
                {c.last_purchase_price ? (
                  <span className="font-mono text-slate-600">~{formatCurrency(c.last_purchase_price)}</span>
                ) : null}
                {c.has_serial && <Badge color="blue">S/N</Badge>}
              </div>
            </div>
          ))}
        </div>
        
        <ConfirmModal 
          isOpen={deleteConfig.open}
          onClose={() => setDeleteConfig({ ...deleteConfig, open: false })}
          onConfirm={handleConfirmDelete}
          title={deleteConfig.type === 'catalog' ? "Удаление категории" : "Удаление товара"}
          message={deleteConfig.type === 'catalog' 
            ? "ВНИМАНИЕ: Вы удаляете тип оборудования из справочника. Это скроет все существующие товары этого типа. Продолжить?" 
            : "Вы уверены, что хотите удалить эту единицу товара? Она будет перемещена в корзину."}
          confirmVariant="danger"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            {/* Search */}
            <div className="w-full md:w-80">
                <Input 
                    placeholder={activeTab === 'warranty' ? "Поиск по S/N..." : "Название, SKU, S/N..."} 
                    value={search} 
                    onChange={(e: any) => setSearch(e.target.value)} 
                    icon="search" 
                    className="h-11 !text-sm"
                />
            </div>
            
            {/* Filters only for stock */}
            {activeTab === 'stock' && (
                <div className="w-full sm:w-auto min-w-[160px]">
                    <Select 
                        value={statusFilter}
                        onChange={(e: any) => setStatusFilter(e.target.value)}
                        options={[
                            { value: 'all', label: 'Все статусы' },
                            { value: 'in_stock', label: 'На складе' },
                            { value: 'maintenance', label: 'В ремонте' }
                        ]}
                        className="h-11 !py-0 !text-sm truncate pr-8"
                    />
                </div>
            )}

            {/* Type Filter */}
            <div className="w-full sm:w-auto min-w-[160px]">
                <Select 
                    value={typeFilter}
                    onChange={(e: any) => setTypeFilter(e.target.value)}
                    options={[
                        { value: 'all', label: 'Все типы' },
                        { value: 'product', label: 'Оборудование' },
                        { value: 'material', label: 'Материалы' }
                    ]}
                    className="h-11 !py-0 !text-sm truncate pr-8"
                />
            </div>

            {/* Date Range - Compact */}
            <div className="flex items-center gap-2 bg-white rounded-2xl border border-slate-200 px-3 py-1 shadow-sm shrink-0 h-[44px] w-full sm:w-auto justify-center sm:justify-start">
                <span className="material-icons-round text-slate-400 text-lg">date_range</span>
                <Input type="date" value={dateFrom} onChange={(e:any) => setDateFrom(e.target.value)} className="!border-0 !p-0 !h-auto !text-xs w-24 bg-transparent focus:ring-0" />
                <span className="text-slate-300 font-bold">-</span>
                <Input type="date" value={dateTo} onChange={(e:any) => setDateTo(e.target.value)} className="!border-0 !p-0 !h-auto !text-xs w-24 bg-transparent focus:ring-0" />
            </div>
        </div>
        
        {/* Total Summary Block */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-2 flex items-center justify-between gap-6 shrink-0 w-full xl:w-auto xl:ml-auto shadow-sm">
            <div className="flex flex-col">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Итого</span>
                <span className="text-[10px] font-medium text-blue-300">Стоимость остатка</span>
            </div>
            <span className="text-xl font-bold text-blue-900">{formatCurrency(totalSum)}</span>
        </div>
      </div>

      {/* Bulk Action Bar - Sticky if cart has items */}
      {cart.length > 0 && activeTab === 'stock' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1c1b1f] text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-4">
           <div className="flex items-center gap-2">
             <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold">{cart.length}</div>
             <span className="text-sm font-medium">Выбрано к отгрузке</span>
           </div>
           <button 
             onClick={onBulkDeploy}
             className="bg-white text-[#1c1b1f] px-4 py-2 rounded-full text-xs font-bold hover:bg-blue-50 transition-colors flex items-center gap-2"
           >
             Отгрузить все
             <span className="material-icons-round text-sm">rocket_launch</span>
           </button>
        </div>
      )}

      {/* --- CONTENT AREA START --- */}
      {activeTab === 'warranty' ? (
        <div className="space-y-4">
          {groupedWarrantyItems.length === 0 && (
            <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
              <p className="text-slate-400 text-sm">Установленного оборудования не найдено</p>
            </div>
          )}

          {groupedWarrantyItems.map(group => {
            // Проверка: нужно ли раскрыть группу, если поиск совпал с товаром внутри
            // hasSearchMatch будет true только если введен поиск и он совпал с элементом внутри группы
            const hasSearchMatch = search && group.items.some(item => 
              item.catalog?.name.toLowerCase().includes(search.toLowerCase()) ||
              item.serial_number?.toLowerCase().includes(search.toLowerCase())
            );

            return (
              <details 
                key={group.id} 
                open={!!(search && hasSearchMatch)} // Принудительное приведение к true/false для TS
                className="group bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all hover:shadow-sm"
              >
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none bg-slate-50/50 hover:bg-slate-100/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-600 text-white p-2 rounded-xl shadow-sm">
                      <span className="material-icons-round text-base">inventory_2</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{group.objectName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">
                          Отгрузка от {formatDate(group.date)}
                        </span>
                        <span className="text-slate-300 text-[10px]">•</span>
                        <span className="text-[10px] text-blue-600 font-bold">
                          {group.items.length} поз.
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="secondary" 
                      className="!h-8 !px-3 !text-[10px] font-bold border-none bg-white hover:bg-blue-50 text-blue-600 shadow-sm"
                      onClick={(e) => {
                        e.preventDefault();
                        handlePrintTechnicalList(group);
                      }}
                    >
                      <span className="material-icons-round text-sm mr-1">print</span>
                      Тех. лист
                    </Button>
                    <div className="w-8 h-8 flex items-center justify-center rounded-full group-open:bg-slate-200 transition-colors">
                      <span className="material-icons-round text-slate-400 group-open:rotate-180 transition-transform">expand_more</span>
                    </div>
                  </div>
                </summary>

                <div className="p-0 border-t border-slate-100">
                  <table className="w-full text-left border-separate border-spacing-0">
                    <thead className="bg-slate-50/30">
                      <tr className="text-[10px] text-slate-400 uppercase font-bold">
                        <th className="pl-6 py-2">Наименование и S/N</th>
                        <th className="py-2 text-center">Кол-во</th>
                        <th className="py-2 text-center">Гарантия</th>
                        <th className="pr-6 py-2 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {group.items.map((item) => (
                        <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group/row">
                          <td className="pl-6 py-3">
                            <div 
                              className="flex flex-col cursor-pointer"
                              onClick={() => setSelectedDrawerItem(item)}
                            >
                              <span className="text-xs font-bold text-slate-900">
                                {item.catalog?.name}
                              </span>
                              {item.serial_number && (
                                <span className="text-[10px] font-mono text-blue-600 mt-1">
                                  S/N: {item.serial_number}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 text-center">
                            <Badge color="slate">
                              {item.quantity} {item.catalog?.unit}
                            </Badge>
                          </td>
                          <td className="py-3 text-center text-[10px] text-slate-500 font-medium">
                            {item.catalog?.warranty_period_months} мес.
                          </td>
                          <td className="pr-6 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button 
                                onClick={() => onReturn(item)}
                                className="p-1.5 hover:bg-orange-100 text-orange-600 rounded-lg transition-colors"
                                title="Вернуть на склад"
                              >
                                <span className="material-icons-round text-sm">settings_backup_restore</span>
                              </button>
                              <button 
                                onClick={() => onReplace(item)}
                                className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                                title="Заменить / Сервис"
                              >
                                <span className="material-icons-round text-sm">swap_horiz</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        // TABLE VIEW FOR STOCK
        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase">Оборудование / SKU</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase">Дата приемки</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase">Кол-во</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase">Цена / Сумма</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase">S/N</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase">Статус</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase">Гарантия</th>
                  <th className="p-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredItems.map(item => {
                  const isMaterial = item.catalog?.item_type === 'material';
                  const warrantyStatus = item.warranty_end 
                    ? (new Date(item.warranty_end) < new Date() ? 'expired' : 'active')
                    : 'none';
                  
                  const unitPrice = item.purchase_price || item.catalog?.last_purchase_price || 0;
                  const totalValue = item.quantity * unitPrice;
                  const dateDisplay = item.created_at;
                  const isInCart = cart.some(c => c.id === item.id);

                  return (
                    <tr key={item.id} className={`hover:bg-slate-50 transition-colors group ${isInCart ? 'bg-blue-50/30' : ''}`}>
                      <td className="p-4">
                        <div 
                          className="flex flex-col cursor-pointer group/name hover:translate-x-1 transition-transform"
                          onClick={() => setSelectedDrawerItem(item)}
                        >
                          <p className="font-bold text-slate-900 group-hover/name:text-blue-600 transition-colors">{item.catalog?.name}</p>
                          <div className="flex gap-1 mt-1">
                              <Badge color={isMaterial ? 'amber' : 'blue'}>{isMaterial ? 'Мат' : 'Об'}</Badge>
                              {item.catalog?.sku && <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 rounded">{item.catalog.sku}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-xs text-slate-500">
                          {formatDate(dateDisplay)}
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-sm">{item.quantity}</span> 
                        <span className="text-xs text-slate-500 ml-1">{item.catalog?.unit || 'шт'}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-500">{formatCurrency(unitPrice)}</span>
                          <span className="text-xs font-bold text-slate-700">{formatCurrency(totalValue)}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        {item.serial_number ? (
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">{item.serial_number}</span>
                        ) : (
                          <span className="text-xs text-slate-300 italic">Нет</span>
                        )}
                      </td>
                      <td className="p-4">
                         <Badge color={
                           item.status === 'in_stock' ? 'emerald' :
                           item.status === 'deployed' ? 'blue' :
                           item.status === 'scrapped' ? 'red' : 'amber'
                         }>
                           {item.status === 'in_stock' ? 'На складе' :
                            item.status === 'deployed' ? 'Установлен' :
                            item.status === 'scrapped' ? 'Списан' : 'В ремонте'}
                         </Badge>
                      </td>
                      <td className="p-4">
                        {isMaterial ? (
                           <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">Расходник</span>
                        ) : (
                          warrantyStatus === 'none' ? (
                             <span className="text-xs text-slate-400">—</span>
                          ) : (
                             <div>
                               <p className={`text-xs font-bold ${warrantyStatus === 'active' ? 'text-emerald-600' : 'text-red-500'}`}>
                                 {warrantyStatus === 'active' ? 'Активна' : 'Истекла'}
                               </p>
                               <p className="text-[10px] text-slate-400">до {formatDate(item.warranty_end)}</p>
                             </div>
                          )
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1">
                          {/* Cart Action */}
                          {item.status === 'in_stock' && (
                              <button 
                                  onClick={() => isInCart ? onRemoveFromCart(item.id) : onAddToCart(item)}
                                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                                      isInCart 
                                      ? 'bg-blue-100 text-blue-600 hover:bg-red-100 hover:text-red-600' 
                                      : 'bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600'
                                  }`}
                                  title={isInCart ? "Убрать из выборки" : "Добавить к отгрузке"}
                              >
                                  <span className="material-icons-round text-sm">
                                      {isInCart ? 'shopping_cart_checkout' : 'add_shopping_cart'}
                                  </span>
                              </button>
                          )}

                          {isAdmin && (
                            <>
                              <button 
                                type="button"
                                onClick={() => onEdit(item, 'item')}
                                className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                                title="Редактировать запись"
                              >
                                <span className="material-icons-round text-sm">edit</span>
                              </button>
                              <button 
                                type="button"
                                className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setDeleteConfig({ open: true, id: item.id, type: 'item' });
                                }}
                                title="Удалить запись"
                              >
                                <span className="material-icons-round text-sm">delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* --- CONTENT AREA END --- */}

      {/* Confirm Modal for Items */}
      <ConfirmModal 
        isOpen={deleteConfig.open}
        onClose={() => setDeleteConfig({ ...deleteConfig, open: false })}
        onConfirm={handleConfirmDelete}
        title={deleteConfig.type === 'catalog' ? "Удаление категории" : "Удаление товара"}
        message={deleteConfig.type === 'catalog' 
          ? "ВНИМАНИЕ: Вы удаляете тип оборудования из справочника. Это скроет все существующие товары этого типа. Продолжить?" 
          : "Вы уверены, что хотите удалить эту единицу товара? Она будет перемещена в корзину."}
        confirmVariant="danger"
      />

      <ItemDetailsDrawer 
        item={selectedDrawerItem}
        isOpen={!!selectedDrawerItem}
        onClose={() => setSelectedDrawerItem(null)}
        profile={profile}
        onAction={(action, item) => {
            setSelectedDrawerItem(null);
            if (action === 'return') onReturn(item);
            if (action === 'replace') onReplace(item);
            if (action === 'edit') onEdit(item, 'item');
        }}
      />
    </div>
  );
};

export default InventoryList;
