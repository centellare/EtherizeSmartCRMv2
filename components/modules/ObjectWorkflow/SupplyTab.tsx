
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Badge, Input, Button } from '../../ui';
import InventoryModal from '../Inventory/InventoryModal'; // Import modal

interface SupplyTabProps {
  object: any;
  profile: any;
  onCreateCP?: () => void; // Optional callback to create CP
}

export const SupplyTab: React.FC<SupplyTabProps> = ({ object, profile, onCreateCP }) => {
  const [loading, setLoading] = useState(false);
  const [planItems, setPlanItems] = useState<any[]>([]); 
  const [shippedItems, setShippedItems] = useState<any[]>([]); 
  const [search, setSearch] = useState('');
  
  // UI State
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Return Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [itemToReturn, setItemToReturn] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Plan (Invoices linked to THIS object)
      let invoiceQuery = supabase
        .from('invoices')
        .select('id, number, status, items:invoice_items(*, product:products(name, unit, category))')
        .neq('status', 'cancelled');

      if (object.id) {
          invoiceQuery = invoiceQuery.eq('object_id', object.id);
      } else {
          invoiceQuery = invoiceQuery.eq('client_id', object.client_id);
      }

      const { data: invData } = await invoiceQuery;

      const allPlan: any[] = [];
      invData?.forEach(inv => {
          inv.items.forEach((item: any) => {
              allPlan.push({
                  invoice_number: inv.number,
                  product_id: item.product_id,
                  product_name: item.name || item.product?.name || 'Unknown',
                  unit: item.unit || item.product?.unit || 'шт',
                  quantity: item.quantity,
                  category: item.product?.category || 'General'
              });
          });
      });

      // 2. Fetch Fact (Inventory History -> Deployed to THIS object)
      const { data: deployedItems } = await supabase
        .from('inventory_items')
        .select('id, quantity, serial_number, purchase_price, product_id, created_at, product:products(name, unit, category)')
        .eq('current_object_id', object.id)
        .eq('status', 'deployed')
        .order('created_at', { ascending: false });

      const allShipped: any[] = [];
      deployedItems?.forEach(item => {
          if (item.product) {
              allShipped.push({
                  id: item.id, 
                  product_id: item.product_id,
                  product_name: item.product.name,
                  unit: item.product.unit,
                  quantity: item.quantity,
                  serial_number: item.serial_number,
                  purchase_price: item.purchase_price,
                  category: item.product.category,
                  created_at: item.created_at,
                  fullItem: item 
              });
          }
      });

      setPlanItems(allPlan);
      setShippedItems(allShipped);

    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [object.id]);

  const supplySummary = useMemo(() => {
    const map = new Map<string, { 
        id: string,
        name: string, 
        unit: string, 
        category: string, 
        planned: number, 
        shippedQty: number,
        shippedItemsList: any[] 
    }>();

    const getKey = (p: any) => p.product_id || p.product_name;

    planItems.forEach(p => {
        const key = getKey(p);
        if (!map.has(key)) map.set(key, { id: key, name: p.product_name, unit: p.unit, category: p.category, planned: 0, shippedQty: 0, shippedItemsList: [] });
        map.get(key)!.planned += p.quantity;
    });

    shippedItems.forEach(s => {
        const key = getKey(s);
        if (!map.has(key)) map.set(key, { id: key, name: s.product_name, unit: s.unit, category: s.category, planned: 0, shippedQty: 0, shippedItemsList: [] });
        const entry = map.get(key)!;
        entry.shippedQty += s.quantity; 
        entry.shippedItemsList.push(s);
    });

    return Array.from(map.values()).filter(i => 
        i.name.toLowerCase().includes(search.toLowerCase())
    ).sort((a,b) => {
        // Sort priorities: 
        // 1. Balance exists (planned > shipped) - Needs attention
        // 2. Has shipment
        const balanceA = a.planned - a.shippedQty;
        const balanceB = b.planned - b.shippedQty;
        if (balanceA > 0 && balanceB <= 0) return -1;
        if (balanceB > 0 && balanceA <= 0) return 1;
        return b.planned - a.planned;
    });
  }, [planItems, shippedItems, search]);

  const handleReturnClick = (item: any) => {
      const invItem = {
          ...item.fullItem,
          catalog: item.fullItem.product 
      };
      setItemToReturn(invItem);
      setIsReturnModalOpen(true);
  };

  const toggleRow = (id: string) => {
      setExpandedRows(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
      });
  };

  return (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h4 className="text-xl font-medium">Снабжение объекта</h4>
            
            <div className="flex gap-2 w-full md:w-auto">
                <div className="w-full md:w-64">
                    <Input placeholder="Поиск товара..." value={search} onChange={(e:any) => setSearch(e.target.value)} icon="search" className="h-10 text-sm" />
                </div>
                {onCreateCP && (
                    <Button onClick={onCreateCP} icon="add_card" className="h-10 text-xs shrink-0 shadow-lg shadow-blue-100">
                        Новое КП
                    </Button>
                )}
            </div>
        </div>

        <div className="bg-white rounded-[24px] border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 bg-blue-50 border-b border-blue-100 flex items-center gap-2 text-sm text-blue-800">
                <span className="material-icons-round text-base">info</span>
                <span>План рассчитывается на основе выставленных счетов по этому объекту.</span>
            </div>
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                        <th className="p-4 w-12"></th>
                        <th className="p-4 font-bold text-slate-500 uppercase text-xs">Наименование</th>
                        <th className="p-4 font-bold text-slate-500 uppercase text-xs text-center w-24">План</th>
                        <th className="p-4 font-bold text-slate-500 uppercase text-xs text-center w-24">Факт</th>
                        <th className="p-4 font-bold text-slate-500 uppercase text-xs text-center w-24">Баланс</th>
                        <th className="p-4 font-bold text-slate-500 uppercase text-xs w-32">Статус</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {supplySummary.length === 0 ? (
                        <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">Нет данных о снабжении</td></tr>
                    ) : (
                        supplySummary.map((row) => {
                            const balance = row.planned - row.shippedQty;
                            const isComplete = row.shippedQty >= row.planned && row.planned > 0;
                            const percent = row.planned > 0 ? (row.shippedQty / row.planned) * 100 : 0;
                            const isExpanded = expandedRows.has(row.id);
                            const hasItems = row.shippedItemsList.length > 0;

                            return (
                                <React.Fragment key={row.id}>
                                    <tr 
                                        className={`transition-colors group ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50 cursor-pointer'}`}
                                        onClick={() => hasItems && toggleRow(row.id)}
                                    >
                                        <td className="p-4 text-center">
                                            {hasItems ? (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); toggleRow(row.id); }}
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isExpanded ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}
                                                >
                                                    <span className={`material-icons-round text-sm transition-transform ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                                                </button>
                                            ) : (
                                                <span className="material-icons-round text-slate-200 text-sm">remove</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <p className="font-bold text-slate-900">{row.name}</p>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-tight">{row.category}</p>
                                        </td>
                                        <td className="p-4 text-center font-medium text-slate-600">
                                            {row.planned > 0 ? `${row.planned} ${row.unit}` : '—'}
                                        </td>
                                        <td className="p-4 text-center font-bold text-blue-600">
                                            {row.shippedQty > 0 ? `${row.shippedQty} ${row.unit}` : '—'}
                                        </td>
                                        <td className="p-4 text-center font-medium text-slate-500">
                                            {balance > 0 ? <span className="text-amber-600 font-bold">{balance} {row.unit}</span> : (balance === 0 && row.planned > 0 ? <span className="text-emerald-500 material-icons-round text-sm">check</span> : '—')}
                                        </td>
                                        <td className="p-4">
                                            {row.planned === 0 ? (
                                                <Badge color="amber">Вне плана</Badge>
                                            ) : isComplete ? (
                                                <Badge color="emerald">Комплект</Badge>
                                            ) : (
                                                <div className="flex items-center gap-2" title={`${Math.round(percent)}%`}>
                                                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex-grow min-w-[60px]">
                                                        <div className={`h-full transition-all ${percent > 100 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, percent)}%` }}></div>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                    
                                    {/* Expanded Details Row */}
                                    {isExpanded && (
                                        <tr className="bg-slate-50 border-b border-slate-100 shadow-inner">
                                            <td colSpan={6} className="p-0">
                                                <div className="p-4 pl-16">
                                                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Состав отгрузки ({row.shippedItemsList.length} поз.)</p>
                                                        
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                                            {row.shippedItemsList.map((item: any) => (
                                                                <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-blue-200 hover:shadow-sm transition-all group/item">
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-baseline gap-1">
                                                                            <span className="font-bold text-slate-700 text-sm">{item.quantity} {item.unit}</span>
                                                                            {item.serial_number ? (
                                                                                <span className="text-[9px] font-mono text-blue-600 bg-blue-50 px-1 rounded truncate max-w-[100px] block" title={item.serial_number}>
                                                                                    {item.serial_number}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-[9px] text-slate-400 italic">Без S/N</span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-[9px] text-slate-400 mt-0.5">
                                                                            {new Date(item.created_at).toLocaleDateString()}
                                                                        </p>
                                                                    </div>
                                                                    
                                                                    <button 
                                                                        onClick={() => handleReturnClick(item)}
                                                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                                                                        title="Вернуть на склад"
                                                                    >
                                                                        <span className="material-icons-round text-sm">settings_backup_restore</span>
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>

        <InventoryModal 
            isOpen={isReturnModalOpen}
            onClose={() => setIsReturnModalOpen(false)}
            mode="return_item"
            selectedItem={itemToReturn}
            objects={[object]}
            items={[]}
            profile={profile}
            onSuccess={() => { setIsReturnModalOpen(false); fetchData(); }}
        />
    </div>
  );
};
