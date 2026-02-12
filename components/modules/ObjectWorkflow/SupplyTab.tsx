
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Badge, Input } from '../../ui';

interface SupplyTabProps {
  object: any;
  profile: any;
}

export const SupplyTab: React.FC<SupplyTabProps> = ({ object }) => {
  const [loading, setLoading] = useState(false);
  const [planItems, setPlanItems] = useState<any[]>([]); // From Invoices (Draft, Sent, Paid)
  const [shippedItems, setShippedItems] = useState<any[]>([]); // From Inventory History
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Plan (ALL Invoice Items for this object)
        // We link invoices to objects usually via CP -> Client, but also check direct object_id link in transactions logic
        // Ideally invoices should link to Objects directly, but current schema links to Client.
        // We will fetch invoices for this client that are likely related.
        // Or better: We assume standard flow creates Invoices for Client.
        
        // FIX: In a real system, Invoice should link to Object. 
        // For now, we fetch Invoices for the Client of this Object.
        
        const { data: invData } = await supabase
          .from('invoices')
          .select('id, number, status, items:invoice_items(*, product:products(name, unit, category))')
          .eq('client_id', object.client_id)
          .neq('status', 'cancelled'); // Exclude cancelled

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
        const { data: historyData } = await supabase
          .from('inventory_history')
          .select('item_id, created_at, item:inventory_items(product_id, product:products(name, unit, category))')
          .eq('action_type', 'deploy')
          .eq('to_object_id', object.id);

        const allShipped: any[] = [];
        (historyData as any[])?.forEach(h => {
            if (h.item && h.item.product) {
                allShipped.push({
                    product_id: h.item.product_id,
                    product_name: h.item.product.name,
                    unit: h.item.product.unit,
                    quantity: 1, // History records represent single actions usually, but check logic
                    category: h.item.product.category
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
    fetchData();
  }, [object.id, object.client_id]);

  const supplySummary = useMemo(() => {
    const map = new Map<string, { name: string, unit: string, category: string, planned: number, shipped: number }>();

    const getKey = (p: any) => p.product_id || p.product_name;

    planItems.forEach(p => {
        const key = getKey(p);
        if (!map.has(key)) map.set(key, { name: p.product_name, unit: p.unit, category: p.category, planned: 0, shipped: 0 });
        map.get(key)!.planned += p.quantity;
    });

    shippedItems.forEach(s => {
        const key = getKey(s);
        if (!map.has(key)) map.set(key, { name: s.product_name, unit: s.unit, category: s.category, planned: 0, shipped: 0 });
        map.get(key)!.shipped += s.quantity; 
    });

    return Array.from(map.values()).filter(i => 
        i.name.toLowerCase().includes(search.toLowerCase())
    ).sort((a,b) => b.planned - a.planned);
  }, [planItems, shippedItems, search]);

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
                <span>План рассчитывается на основе выставленных счетов клиенту (кроме отмененных).</span>
            </div>
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                        <th className="p-4 font-bold text-slate-500 uppercase text-xs">Наименование</th>
                        <th className="p-4 font-bold text-slate-500 uppercase text-xs text-center w-24">План (Счета)</th>
                        <th className="p-4 font-bold text-slate-500 uppercase text-xs text-center w-24">Отгружено</th>
                        <th className="p-4 font-bold text-slate-500 uppercase text-xs text-center w-24">Остаток</th>
                        <th className="p-4 font-bold text-slate-500 uppercase text-xs w-32">Статус</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {supplySummary.length === 0 ? (
                        <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">Нет данных о снабжении</td></tr>
                    ) : (
                        supplySummary.map((row, idx) => {
                            const balance = row.planned - row.shipped;
                            const isComplete = row.shipped >= row.planned && row.planned > 0;
                            const percent = row.planned > 0 ? (row.shipped / row.planned) * 100 : 0;
                            
                            return (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4">
                                        <p className="font-bold text-slate-900">{row.name}</p>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-tight">{row.category}</p>
                                    </td>
                                    <td className="p-4 text-center font-medium text-slate-600">
                                        {row.planned} {row.unit}
                                    </td>
                                    <td className="p-4 text-center font-bold text-blue-600">
                                        {row.shipped} {row.unit}
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
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );
};
