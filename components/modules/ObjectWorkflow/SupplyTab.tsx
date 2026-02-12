
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Badge, Input, Button } from '../../ui';
import InventoryModal from '../Inventory/InventoryModal'; // Import modal

interface SupplyTabProps {
  object: any;
  profile: any;
}

export const SupplyTab: React.FC<SupplyTabProps> = ({ object, profile }) => {
  const [loading, setLoading] = useState(false);
  const [planItems, setPlanItems] = useState<any[]>([]); 
  const [shippedItems, setShippedItems] = useState<any[]>([]); 
  const [search, setSearch] = useState('');
  
  // Return Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [itemToReturn, setItemToReturn] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Plan (Invoices linked to THIS object)
      // Logic: Prioritize invoices with explicit object_id. Fallback to client_id if needed, but prefer object_id.
      
      let invoiceQuery = supabase
        .from('invoices')
        .select('id, number, status, items:invoice_items(*, product:products(name, unit, category))')
        .neq('status', 'cancelled');

      // Use explicit object link if migration applied
      if (object.id) {
          invoiceQuery = invoiceQuery.eq('object_id', object.id);
      } else {
          // Fallback legacy behavior
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
      // We also fetch the current Inventory Item status to know if we can return it (it might be already returned)
      // Actually, getting 'deployed' items currently assigned to this object is more accurate for "Returnable" list.
      const { data: deployedItems } = await supabase
        .from('inventory_items')
        .select('id, quantity, serial_number, purchase_price, product_id, product:products(name, unit, category)')
        .eq('current_object_id', object.id)
        .eq('status', 'deployed');

      const allShipped: any[] = [];
      deployedItems?.forEach(item => {
          if (item.product) {
              allShipped.push({
                  id: item.id, // Inventory Item ID needed for return
                  product_id: item.product_id,
                  product_name: item.product.name,
                  unit: item.product.unit,
                  quantity: item.quantity,
                  serial_number: item.serial_number,
                  purchase_price: item.purchase_price,
                  category: item.product.category,
                  // Pass full item structure for ReturnForm
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
        if (!map.has(key)) map.set(key, { name: p.product_name, unit: p.unit, category: p.category, planned: 0, shippedQty: 0, shippedItemsList: [] });
        map.get(key)!.planned += p.quantity;
    });

    shippedItems.forEach(s => {
        const key = getKey(s);
        if (!map.has(key)) map.set(key, { name: s.product_name, unit: s.unit, category: s.category, planned: 0, shippedQty: 0, shippedItemsList: [] });
        const entry = map.get(key)!;
        entry.shippedQty += s.quantity; 
        entry.shippedItemsList.push(s);
    });

    return Array.from(map.values()).filter(i => 
        i.name.toLowerCase().includes(search.toLowerCase())
    ).sort((a,b) => b.planned - a.planned);
  }, [planItems, shippedItems, search]);

  const handleReturnClick = (item: any) => {
      // Reconstruct InventoryItem shape expected by Modal
      const invItem = {
          ...item.fullItem,
          catalog: item.fullItem.product // Legacy compat
      };
      setItemToReturn(invItem);
      setIsReturnModalOpen(true);
  };

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h4 className="text-xl font-medium">Снабжение объекта</h4>
            <div className="w-64">
                <Input placeholder="Поиск товара..." value={search} onChange={(e:any) => setSearch(e.target.value)} icon="search" className="h-10 text-sm" />
            </div>
        </div>

        <div className="bg-white rounded-[24px] border border-slate-200 overflow-hidden">
            <div className="p-4 bg-blue-50 border-b border-blue-100 flex items-center gap-2 text-sm text-blue-800">
                <span className="material-icons-round text-base">info</span>
                <span>План рассчитывается на основе выставленных счетов по этому объекту.</span>
            </div>
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                        <th className="p-4 font-bold text-slate-500 uppercase text-xs">Наименование</th>
                        <th className="p-4 font-bold text-slate-500 uppercase text-xs text-center w-24">План</th>
                        <th className="p-4 font-bold text-slate-500 uppercase text-xs text-center w-24">Факт</th>
                        <th className="p-4 font-bold text-slate-500 uppercase text-xs text-center w-24">Баланс</th>
                        <th className="p-4 font-bold text-slate-500 uppercase text-xs w-32">Статус</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {supplySummary.length === 0 ? (
                        <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">Нет данных о снабжении</td></tr>
                    ) : (
                        supplySummary.map((row, idx) => {
                            const balance = row.planned - row.shippedQty;
                            const isComplete = row.shippedQty >= row.planned && row.planned > 0;
                            const percent = row.planned > 0 ? (row.shippedQty / row.planned) * 100 : 0;
                            const isExpanded = false; // Could add expansion logic to see specific items

                            return (
                                <React.Fragment key={idx}>
                                    <tr className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <p className="font-bold text-slate-900">{row.name}</p>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-tight">{row.category}</p>
                                            
                                            {/* List actual items for Return action */}
                                            {row.shippedItemsList.length > 0 && (
                                                <div className="mt-2 space-y-1">
                                                    {row.shippedItemsList.map((item: any) => (
                                                        <div key={item.id} className="flex items-center gap-2 text-xs bg-slate-100 px-2 py-1 rounded w-fit">
                                                            <span className="font-mono text-slate-600">{item.quantity} {item.unit}</span>
                                                            {item.serial_number && <span className="text-[10px] bg-white px-1 border rounded text-slate-500">{item.serial_number}</span>}
                                                            <button 
                                                                onClick={() => handleReturnClick(item)}
                                                                className="ml-2 text-orange-500 hover:text-orange-700 hover:bg-orange-50 rounded px-1 transition-colors"
                                                                title="Вернуть на склад"
                                                            >
                                                                <span className="material-icons-round text-xs align-middle">settings_backup_restore</span>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-center font-medium text-slate-600">
                                            {row.planned} {row.unit}
                                        </td>
                                        <td className="p-4 text-center font-bold text-blue-600">
                                            {row.shippedQty} {row.unit}
                                        </td>
                                        <td className="p-4 text-center font-medium text-slate-500">
                                            {balance > 0 ? balance : 0} {row.unit}
                                        </td>
                                        <td className="p-4">
                                            {row.planned === 0 ? (
                                                <Badge color="amber">Вне плана</Badge>
                                            ) : isComplete ? (
                                                <Badge color="emerald">Комплект</Badge>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex-grow">
                                                        <div className="bg-blue-500 h-full transition-all" style={{ width: `${Math.min(100, percent)}%` }}></div>
                                                    </div>
                                                    <span className="text-[9px] font-bold text-slate-400">{Math.round(percent)}%</span>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
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
