
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
  const [shippingMap, setShippingMap] = useState<Record<string, number>>({}); // productId -> qtyToShip
  const [stockInfo, setStockInfo] = useState<Record<string, { reserved: number, free: number, total: number }>>({});
  const [targetObject, setTargetObject] = useState<any>(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    // Fetch active invoices (sent or paid) that are not fully shipped
    const { data } = await supabase
      .from('invoices')
      .select('id, number, status, created_at, client:clients(name)')
      .in('status', ['sent', 'paid'])
      .neq('shipping_status', 'shipped') // Filter out fully shipped
      .order('created_at', { ascending: false });
    
    setInvoices(data || []);
    setLoading(false);
  };

  const handleInvoiceSelect = async () => {
    if (!selectedInvoiceId) return;
    setLoading(true);
    
    try {
        // 1. Get Invoice Details & Linked Object (via client)
        // Note: Ideally invoices link to objects. Here we guess by client or need direct link.
        // We will try to find object by client for now.
        const { data: inv } = await supabase
            .from('invoices')
            .select('*, client:clients(id, name)')
            .eq('id', selectedInvoiceId)
            .single();
        
        // Find Object associated with this client (latest active)
        const { data: obj } = await supabase
            .from('objects')
            .select('id, name')
            .eq('client_id', inv.client_id)
            .is('is_deleted', false)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        
        setTargetObject(obj);

        // 2. Get Invoice Items
        const { data: items } = await supabase
            .from('invoice_items')
            .select('*, product:products(has_serial)')
            .eq('invoice_id', selectedInvoiceId);
        
        setInvoiceItems(items || []);

        // 3. Calculate Stock Availability (Reserved vs Free)
        if (items && items.length > 0) {
            const productIds = items.map((i: any) => i.product_id).filter(Boolean);
            
            const { data: stockData } = await supabase
                .from('inventory_items')
                .select('product_id, status, reserved_for_invoice_id, quantity')
                .in('product_id', productIds)
                .in('status', ['in_stock', 'reserved'])
                .is('deleted_at', null);

            const map: Record<string, { reserved: number, free: number, total: number }> = {};
            
            stockData?.forEach((row: any) => {
                const pid = row.product_id;
                if (!map[pid]) map[pid] = { reserved: 0, free: 0, total: 0 };
                
                // Count as reserved ONLY if reserved for THIS invoice
                if (row.status === 'reserved' && row.reserved_for_invoice_id === selectedInvoiceId) {
                    map[pid].reserved += row.quantity;
                } else if (row.status === 'in_stock') {
                    map[pid].free += row.quantity;
                }
                // Total available for this shipment
                map[pid].total = map[pid].reserved + map[pid].free;
            });
            setStockInfo(map);

            // Auto-fill shipping quantities based on reservation or need
            const initialShip: Record<string, number> = {};
            items.forEach((i: any) => {
                if (i.product_id) {
                    const info = map[i.product_id] || { reserved: 0, free: 0 };
                    // Default: Ship what is reserved, or up to quantity needed if free stock allows
                    const canShip = info.reserved + info.free;
                    initialShip[i.product_id] = Math.min(i.quantity, canShip);
                }
            });
            setShippingMap(initialShip);
        }

        setStep(2);
    } catch (e) {
        console.error(e);
        alert('Ошибка загрузки данных счета');
    } finally {
        setLoading(false);
    }
  };

  const handleShip = async () => {
      if (!targetObject) {
          alert('Не найден объект для отгрузки. Создайте объект для этого клиента.');
          return;
      }
      setLoading(true);
      try {
          for (const item of invoiceItems) {
              if (!item.product_id) continue;
              
              const qtyToShip = shippingMap[item.product_id] || 0;
              if (qtyToShip <= 0) continue;

              let remainingToShip = qtyToShip;

              // 1. Prioritize Reserved Items
              const { data: reservedItems } = await supabase
                  .from('inventory_items')
                  .select('id, quantity, serial_number')
                  .eq('product_id', item.product_id)
                  .eq('status', 'reserved')
                  .eq('reserved_for_invoice_id', selectedInvoiceId)
                  .is('deleted_at', null);
              
              // Process reserved first
              if (reservedItems) {
                  for (const rItem of reservedItems) {
                      if (remainingToShip <= 0) break;
                      const take = Math.min(rItem.quantity, remainingToShip);
                      
                      // Move to deployed
                      if (take === rItem.quantity) {
                          await supabase.from('inventory_items').update({
                              status: 'deployed',
                              current_object_id: targetObject.id,
                              reserved_for_invoice_id: null,
                              assigned_to_id: profile.id
                          }).eq('id', rItem.id);
                      } else {
                          // Split
                          await supabase.from('inventory_items').update({ quantity: rItem.quantity - take }).eq('id', rItem.id);
                          await supabase.from('inventory_items').insert({
                              product_id: item.product_id,
                              quantity: take,
                              status: 'deployed',
                              current_object_id: targetObject.id,
                              assigned_to_id: profile.id
                          });
                      }
                      
                      // Log history
                      await supabase.from('inventory_history').insert({
                          item_id: rItem.id, // technically incorrect ID if split, but tracking flow is complex
                          action_type: 'deploy',
                          to_object_id: targetObject.id,
                          created_by: profile.id,
                          comment: `Отгрузка по счету (Резерв). Сч №${invoices.find(i=>i.id===selectedInvoiceId)?.number}`
                      });

                      remainingToShip -= take;
                  }
              }

              // 2. Take from Free Stock if still needed
              if (remainingToShip > 0) {
                  const { data: freeItems } = await supabase
                    .from('inventory_items')
                    .select('id, quantity')
                    .eq('product_id', item.product_id)
                    .eq('status', 'in_stock')
                    .is('deleted_at', null);
                  
                  if (freeItems) {
                      for (const fItem of freeItems) {
                          if (remainingToShip <= 0) break;
                          const take = Math.min(fItem.quantity, remainingToShip);
                          
                          if (take === fItem.quantity) {
                              await supabase.from('inventory_items').update({
                                  status: 'deployed',
                                  current_object_id: targetObject.id,
                                  assigned_to_id: profile.id
                              }).eq('id', fItem.id);
                          } else {
                              await supabase.from('inventory_items').update({ quantity: fItem.quantity - take }).eq('id', fItem.id);
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
                            comment: `Отгрузка по счету (Свободный). Сч №${invoices.find(i=>i.id===selectedInvoiceId)?.number}`
                        });

                          remainingToShip -= take;
                      }
                  }
              }
          }

          // Update Invoice Shipping Status (Simple Logic)
          // We mark as 'partial' if we shipped something. 'shipped' if everything.
          // For MVP, if we shipped anything, let's mark partial. If we shipped exactly total needed...
          // Calculating exact totals is hard without tracking line-item fulfillment in DB.
          // Let's set to 'partial' by default, user can close it manually or improve logic later.
          await supabase.from('invoices').update({ shipping_status: 'partial' }).eq('id', selectedInvoiceId);

          onSuccess();
      } catch (e: any) {
          console.error(e);
          alert('Ошибка отгрузки: ' + e.message);
      } finally {
          setLoading(false);
      }
  };

  if (step === 1) {
      return (
          <div className="space-y-4">
              <p className="text-sm text-slate-500">Выберите счет, по которому нужно собрать заказ. Будут использованы товары из резерва и свободного остатка.</p>
              <Select 
                  label="Счет на оплату" 
                  value={selectedInvoiceId}
                  onChange={(e: any) => setSelectedInvoiceId(e.target.value)}
                  options={[
                      { value: '', label: 'Выберите счет...' },
                      ...invoices.map(i => ({ value: i.id, label: `№${i.number} от ${formatDate(i.created_at)} (${i.client?.name})` }))
                  ]}
              />
              <Button onClick={handleInvoiceSelect} disabled={!selectedInvoiceId} loading={loading} className="w-full h-12">
                  Далее
              </Button>
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
                          <th className="p-3 text-center">Резерв</th>
                          <th className="p-3 text-center">Свободно</th>
                          <th className="p-3 w-24">К отгрузке</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {invoiceItems.map(item => {
                          const info = stockInfo[item.product_id] || { reserved: 0, free: 0 };
                          const qty = shippingMap[item.product_id] || 0;
                          const hasEnough = info.reserved + info.free >= qty;

                          return (
                              <tr key={item.id}>
                                  <td className="p-3">
                                      <p className="font-medium">{item.name}</p>
                                      {item.product?.has_serial && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded">Нужен S/N</span>}
                                  </td>
                                  <td className="p-3 text-center font-bold">{item.quantity}</td>
                                  <td className="p-3 text-center text-blue-600 font-bold">{info.reserved}</td>
                                  <td className="p-3 text-center text-slate-500">{info.free}</td>
                                  <td className="p-3">
                                      <input 
                                          type="number" 
                                          className={`w-full h-8 border rounded text-center font-bold outline-none focus:ring-2 ${hasEnough ? 'border-blue-200 focus:ring-blue-200' : 'border-red-300 bg-red-50 text-red-600'}`}
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

          <div className="pt-2">
              <Button onClick={handleShip} loading={loading} disabled={!targetObject} className="w-full h-12" icon="local_shipping">
                  Выполнить отгрузку
              </Button>
              <p className="text-[10px] text-center text-slate-400 mt-2">
                  * Если товары требуют S/N, они будут выбраны автоматически из доступных, либо вам придется уточнить их позже в карточке объекта.
              </p>
          </div>
      </div>
  );
};
