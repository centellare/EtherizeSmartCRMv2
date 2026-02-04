
import React, { useState, useMemo } from 'react';
import { InventoryCatalogItem, InventoryItem } from '../../../types';
import { Badge, Input, Select } from '../../ui';
import { formatDate, getMinskISODate } from '../../../lib/dateUtils';

interface InventoryListProps {
  activeTab: 'catalog' | 'stock' | 'warranty';
  catalog: InventoryCatalogItem[];
  items: InventoryItem[];
  loading: boolean;
  onDeploy: (item: InventoryItem) => void;
  onReplace: (item: InventoryItem) => void;
}

const InventoryList: React.FC<InventoryListProps> = ({ activeTab, catalog, items, loading, onDeploy, onReplace }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filteredItems = useMemo(() => {
    let list = items;
    if (activeTab === 'warranty') {
      list = items.filter(i => i.status === 'deployed');
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

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('ru-BY', { style: 'currency', currency: 'BYN', maximumFractionDigits: 2 }).format(val);

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
            <div key={c.id} className="bg-white p-5 rounded-[24px] border border-slate-200">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex gap-2 mb-1">
                    <Badge color={c.item_type === 'product' ? 'blue' : 'amber'}>{c.item_type === 'product' ? 'Оборудование' : 'Материал'}</Badge>
                    {c.sku && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">SKU: {c.sku}</span>}
                  </div>
                  <h4 className="font-bold text-slate-900 mt-1">{c.name}</h4>
                </div>
                <Badge color="slate">{c.warranty_period_months} мес.</Badge>
              </div>
              <p className="text-sm text-slate-500 mb-4">{c.description || 'Нет описания'}</p>
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row justify-between items-end gap-4">
        <div className="flex flex-col xl:flex-row gap-4 flex-grow w-full">
            <Input 
            placeholder={activeTab === 'warranty' ? "Поиск по S/N..." : "Название, SKU, S/N, объект..."} 
            value={search} 
            onChange={(e: any) => setSearch(e.target.value)} 
            icon="search" 
            className="flex-grow"
            />
            
            <div className="flex gap-2 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0">
            {activeTab === 'stock' && (
                <div className="min-w-[140px]">
                <Select 
                    value={statusFilter}
                    onChange={(e: any) => setStatusFilter(e.target.value)}
                    options={[
                    { value: 'all', label: 'Все статусы' },
                    { value: 'in_stock', label: 'На складе' },
                    { value: 'deployed', label: 'Установлен' },
                    { value: 'scrapped', label: 'Списан' },
                    { value: 'maintenance', label: 'В ремонте' }
                    ]}
                />
                </div>
            )}
            <div className="min-w-[140px]">
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
            <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 min-w-fit h-[50px] xl:h-auto">
                <Input type="date" value={dateFrom} onChange={(e:any) => setDateFrom(e.target.value)} className="!border-0 !p-0 h-10 w-28 text-xs" />
                <span className="text-slate-300">-</span>
                <Input type="date" value={dateTo} onChange={(e:any) => setDateTo(e.target.value)} className="!border-0 !p-0 h-10 w-28 text-xs" />
            </div>
            </div>
        </div>
        
        {/* Total Summary Block */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-6 py-3 flex flex-col items-end shrink-0 min-w-[200px]">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Итого (остаток)</span>
            <span className="text-xl font-bold text-blue-900">{formatCurrency(totalSum)}</span>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase">Оборудование / SKU</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase">
                    {activeTab === 'warranty' ? 'Дата отгрузки' : 'Дата приемки'}
                </th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase">Кол-во</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase">Цена / Сумма</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase">S/N</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase">Статус / Объект</th>
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
                
                // Приоритет цены: Партия -> Каталог -> 0
                const unitPrice = item.purchase_price || item.catalog?.last_purchase_price || 0;
                const totalValue = item.quantity * unitPrice;
                
                // Дата для отображения
                const dateDisplay = activeTab === 'warranty' ? item.warranty_start : item.created_at;

                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <p className="font-bold text-slate-900">{item.catalog?.name}</p>
                      <div className="flex gap-1 mt-1">
                        <Badge color={isMaterial ? 'amber' : 'blue'}>{isMaterial ? 'Мат' : 'Об'}</Badge>
                        {item.catalog?.sku && <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 rounded">{item.catalog.sku}</span>}
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
                       <div className="flex flex-col items-start gap-1">
                         <Badge color={
                           item.status === 'in_stock' ? 'emerald' :
                           item.status === 'deployed' ? 'blue' :
                           item.status === 'scrapped' ? 'red' : 'amber'
                         }>
                           {item.status === 'in_stock' ? 'На складе' :
                            item.status === 'deployed' ? 'Установлен' :
                            item.status === 'scrapped' ? 'Списан' : 'В ремонте'}
                         </Badge>
                         {item.object && (
                           <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
                             <span className="material-icons-round text-[10px]">home_work</span>
                             {item.object.name}
                           </span>
                         )}
                       </div>
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
                      {activeTab === 'stock' && item.status === 'in_stock' && (
                        <button 
                          onClick={() => onDeploy(item)}
                          className="h-8 px-3 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all text-xs font-bold inline-flex items-center gap-1"
                        >
                          <span className="material-icons-round text-sm">rocket_launch</span>
                          Отгрузить
                        </button>
                      )}
                      {activeTab === 'warranty' && item.status === 'deployed' && !isMaterial && (
                         <button 
                           onClick={() => onReplace(item)}
                           className="h-8 px-3 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white transition-all text-xs font-bold inline-flex items-center gap-1"
                         >
                           <span className="material-icons-round text-sm">autorenew</span>
                           Замена
                         </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InventoryList;
