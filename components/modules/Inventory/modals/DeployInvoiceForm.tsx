
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Button, Select, Input } from '../../../ui';
import { formatDate } from '../../../../lib/dateUtils';

interface DeployInvoiceFormProps {
  profile: any;
  onSuccess: () => void;
  onClose: () => void;
}

export const DeployInvoiceForm: React.FC<DeployInvoiceFormProps> = ({ profile, onSuccess, onClose }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  
  // Data for Step 2
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [shippingMap, setShippingMap] = useState<Record<string, number>>({});
  const [stockInfo, setStockInfo] = useState<Record<string, { reserved: number, free: number, total: number }>>({});
  const [targetObject, setTargetObject] = useState<any>(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('invoices')
      .select('id, number, status, created_at, client:clients(name)')
      .in('status', ['sent', 'paid'])
      // @ts-ignore
      .neq('shipping_status', 'shipped')
      .order('created_at', { ascending: false });
    
    setInvoices(data || []);
    setLoading(false);
  };

  const handleInvoiceSelect = async () => {
    if (!selectedInvoiceId) return;
    setLoading(true);
    
    try {
        const { data: inv } = await supabase.from('invoices').select('*, client:clients(id, name)').eq('id', selectedInvoiceId).single();
        if (!inv) throw new Error('Счет не найден');

        const { data: obj } = await supabase.from('objects').select('id, name').eq('client_id', inv.client_id || '').is('is_deleted', false).order('updated_at', { ascending: false }).limit(1).maybeSingle();
        setTargetObject(obj);

        const { data: items } = await supabase.from('invoice_items').select('*, product:products(id, name, has_serial)').eq('invoice_id', selectedInvoiceId);
        
        // Filter out Bundle Headers (items without product_id)
        // Only real products can be shipped
        const shippableItems = (items || []).filter((i: any) => !!i.product_id);
        
        setInvoiceItems(shippableItems);

        if (shippableItems.length > 0) {
            const productIds = shippableItems.map((i: any) => i.product_id).filter(Boolean);
            
            const { data: stockData } = await supabase.from('inventory_items')
                .select('product_id, status, reserved_for_invoice_id, quantity')
                .in('product_id', productIds)
                .in('status', ['in_stock', 'reserved'])
                .is('deleted_at', null);

            const map: Record<string, { reserved: number, free: number, total: number }> = {};
            
            stockData?.forEach((row: any) => {
                const pid = row.product_id;
                if (!map[pid]) map[pid] = { reserved: 0, free: 0, total: 0 };
                const qty = row.quantity || 0;
                if (row.status === 'reserved' && row.reserved_for_invoice_id === selectedInvoiceId) {
                    map[pid].reserved += qty;
                } else if (row.status === 'in_stock') {
                    map[pid].free += qty;
                }
                map[pid].total = map[pid].reserved + map[pid].free;
            });
            setStockInfo(map);

            const initialShip: Record<string, number> = {};
            shippableItems.forEach((i: any) => {
                const info = map[i.product_id] || { reserved: 0, free: 0 };
                const canShip = info.reserved + info.free;
                initialShip[i.product_id] = Math.min(i.quantity, canShip);
            });
            setShippingMap(initialShip);
        }
        setStep(2);
    } catch (e) {
        console.error(e);
        alert('Ошибка загрузки');
    } finally {
        setLoading(false);
    }
  };

  const handleShip = async () => {
      if (!targetObject) { alert('Объект не найден'); return; }
      setLoading(true);
      try {
          for (const item of invoiceItems) {
              const qtyToShip = shippingMap[item.product_id] || 0;
              if (qtyToShip <= 0) continue;

              let remainingToShip = qtyToShip;

              // 1. Reserved
              const { data: reservedItems } = await supabase.from('inventory_items')
                  .select('id, quantity, serial_number')
                  .eq('product_id', item.product_id)
                  .eq('status', 'reserved')
                  .eq('reserved_for_invoice_id', selectedInvoiceId)
                  .is('deleted_at', null);
              
              if (reservedItems) {
                  for (const rItem of reservedItems) {
                      if (remainingToShip <= 0) break;
                      const rQty = rItem.quantity || 0;
                      const take = Math.min(rQty, remainingToShip);
                      
                      if (take === rQty) {
                          await supabase.from('inventory_items').update({
                              status: 'deployed',
                              current_object_id: targetObject.id,
                              reserved_for_invoice_id: null,
                              assigned_to_id: profile.id
                          }).eq('id', rItem.id);
                      } else {
                          await supabase.from('inventory_items').update({ quantity: rQty - take }).eq('id', rItem.id);
                          await supabase.from('inventory_items').insert({
                              product_id: item.product_id,
                              quantity: take,
                              status: 'deployed',
                              current_object_id: targetObject.id,
                              assigned_to_id: profile.id
                          });
                      }
                      await supabase.from('inventory_history').insert({
                          item_id: rItem.id, 
                          action_type: 'deploy',
                          to_object_id: targetObject.id,
                          created_by: profile.id,
                          comment: `Отгрузка по счету (Резерв).`
                      });
                      remainingToShip -= take;
                  }
              }

              // 2. Free
              if (remainingToShip > 0) {
                  const { data: freeItems } = await supabase.from('inventory_items')
                    .select('id, quantity')
                    .eq('product_id', item.product_id)
                    .eq('status', 'in_stock')
                    .is('deleted_at', null);
                  
                  if (freeItems) {
                      for (const fItem of freeItems) {
                          if (remainingToShip <= 0) break;
                          const fQty = fItem.quantity || 0;
                          const take = Math.min(fQty, remainingToShip);
                          
                          if (take === fQty) {
                              await supabase.from('inventory_items').update({
                                  status: 'deployed',
                                  current_object_id: targetObject.id,
                                  assigned_to_id: profile.id
                              }).eq('id', fItem.id);
                          } else {
                              await supabase.from('inventory_items').update({ quantity: fQty - take }).eq('id', fItem.id);
                              await supabase.from('inventory_items').insert({
                                  product_id: item.product_id,
                                  quantity: take,
                                  status: 'deployed',
                                  current_object_id: targetObject.id,
                                  assigned_to_id: profile.id
                              });
                          }
                          await supabase.from('inventory_history').insert({
                            item_id: fItem.id,
                            action_type: 'deploy',
                            to_object_id: targetObject.id,
                            created_by: profile.id,
                            comment: `Отгрузка по счету (Свободный).`
                        });
                          remainingToShip -= take;
                      }
                  }
              }
          }
          // @ts-ignore
          await supabase.from('invoices').update({ shipping_status: 'partial' }).eq('id', selectedInvoiceId);
          onSuccess();
      } catch (e: any) {
          console.error(e);
          alert('Ошибка: ' + e.message);
      } finally {
          setLoading(false);
      }
  };

  if (step === 1) {
      return (
          <div className="space-y-4">
              <Select 
                  label="Счет на оплату" 
                  value={selectedInvoiceId}
                  onChange={(e: any) => setSelectedInvoiceId(e.target.value)}
                  options={[{ value: '', label: 'Выберите счет...' }, ...invoices.map(i => ({ value: i.id, label: `№${i.number} от ${formatDate(i.created_at)} (${i.client?.name})` }))]}
              />
              <Button onClick={handleInvoiceSelect} disabled={!selectedInvoiceId} loading={loading} className="w-full h-12">Далее</Button>
          </div>
      );
  }

  return (
      <div className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
              <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Клиент / Объект</p>
                  <p className="font-bold text-slate-900 text-sm">{targetObject ? targetObject.name : <span className="text-red-500">Объект не найден!</span>}</p>
              </div>
              <Button variant="ghost" onClick={() => setStep(1)} className="text-xs h-8">Сменить счет</Button>
          </div>

          <div className="max-h-[50vh] overflow-y-auto border rounded-xl border-slate-200">
              <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-500 font-bold sticky top-0">
                      <tr>
                          <th className="p-3">Товар</th>
                          <th className="p-3 text-center">Нужно</th>
                          <th className="p-3 text-center">Склад</th>
                          <th className="p-3 w-24">К отгрузке</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {invoiceItems.map(item => {
                          const info = stockInfo[item.product_id] || { reserved: 0, free: 0 };
                          const qty = shippingMap[item.product_id] || 0;
                          const hasEnough = info.reserved + info.free >= item.quantity;
                          const isDeficit = item.quantity > (info.reserved + info.free);

                          return (
                              <tr key={item.id} className={isDeficit ? "bg-red-50/50" : ""}>
                                  <td className="p-3">
                                      <p className="font-medium">{item.name}</p>
                                      {item.product?.has_serial && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded">S/N</span>}
                                  </td>
                                  <td className="p-3 text-center font-bold">{item.quantity}</td>
                                  <td className="p-3 text-center text-blue-600 font-bold">{info.reserved + info.free}</td>
                                  <td className="p-3">
                                      <input 
                                          type="number" 
                                          className={`w-full h-8 border rounded text-center font-bold outline-none focus:ring-2 ${hasEnough ? 'border-blue-200 focus:ring-blue-200' : 'border-red-300 bg-white text-red-600'}`}
                                          value={qty}
                                          onChange={(e) => setShippingMap({...shippingMap, [item.product_id]: parseFloat(e.target.value) || 0})}
                                          max={info.reserved + info.free}
                                      />
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>

          <Button onClick={handleShip} loading={loading} disabled={!targetObject} className="w-full h-12" icon="local_shipping">Выполнить отгрузку</Button>
      </div>
  );
};
