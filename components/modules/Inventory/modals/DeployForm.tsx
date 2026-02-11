
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Input, Select, Button } from '../../../ui';
import { InventoryCatalogItem, InventoryItem } from '../../../../types';
import { CartItem } from '../index';

interface DeployFormProps {
  selectedItem: InventoryItem | null;
  cartItems: CartItem[];
  catalog: InventoryCatalogItem[];
  items: InventoryItem[]; // Stock items
  objects: any[];
  profile: any;
  onSuccess: () => void;
}

export const DeployForm: React.FC<DeployFormProps> = ({ selectedItem, cartItems, catalog, items, objects, profile, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ 
      object_id: '', 
      serial_number: '', 
      quantity_to_deploy: '1'
  });
  const [bulkSerials, setBulkSerials] = useState<Record<string, string[]>>({});

  const isBulk = !selectedItem && cartItems.length > 0;

  useEffect(() => {
    if (isBulk) {
       const initialSerials: Record<string, string[]> = {};
       cartItems.forEach(c => {
           const catItem = catalog.find(cat => cat.id === c.catalog_id);
           const qty = Math.floor(c.quantity); 
           if (catItem?.has_serial && qty > 0) {
               const baseArr = Array(qty).fill('');
               if (c.serial_number && qty === 1) baseArr[0] = c.serial_number;
               initialSerials[c.id] = baseArr;
           } else {
               initialSerials[c.id] = []; 
           }
       });
       setBulkSerials(initialSerials);
    } else if (selectedItem) {
        setFormData(prev => ({
            ...prev,
            quantity_to_deploy: selectedItem.quantity.toString(),
            serial_number: ''
        }));
    }
  }, [isBulk, selectedItem, cartItems, catalog]);

  const updateBulkSerial = (itemId: string, index: number, value: string) => {
      setBulkSerials(prev => {
          const newArr = [...(prev[itemId] || [])];
          newArr[index] = value;
          return { ...prev, [itemId]: newArr };
      });
  };

  // --- PRINT LOGIC ---
  const handlePrint = (includeSerials: boolean) => {
    const objectName = objects.find(o => o.id === formData.object_id)?.name || '_____________';
    
    // Helper to group data
    const grouped: Record<string, { name: string, quantity: number, unit: string, serials: string[] }> = {};
    const sourceItems = isBulk ? cartItems : (selectedItem ? [{ 
        id: selectedItem.id, 
        catalog_id: selectedItem.catalog_id, 
        catalog_name: selectedItem.catalog?.name || '', 
        quantity: parseFloat(formData.quantity_to_deploy),
        unit: selectedItem.catalog?.unit || 'шт',
        serial_number: formData.serial_number || selectedItem.serial_number
    }] : []);

    sourceItems.forEach((item: any) => {
        if (!grouped[item.catalog_id]) {
            grouped[item.catalog_id] = {
                name: item.catalog_name,
                quantity: 0,
                unit: item.unit,
                serials: []
            };
        }
        grouped[item.catalog_id].quantity += item.quantity;
        
        if (includeSerials) {
            if (isBulk && bulkSerials[item.id]) {
                const valid = bulkSerials[item.id].filter(s => s && s.trim() !== '');
                grouped[item.catalog_id].serials.push(...valid);
            } else if (!isBulk && item.serial_number) {
                grouped[item.catalog_id].serials.push(item.serial_number);
            }
        }
    });
    
    const printData = Object.values(grouped);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
        <html>
            <head>
                <title>Накладная на отгрузку</title>
                <style>
                    body { font-family: sans-serif; padding: 40px; color: #1c1b1f; max-width: 800px; margin: 0 auto; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                    th, td { border: 1px solid #e1e2e1; padding: 8px 12px; text-align: left; }
                    th { bg-color: #f8f9fa; font-weight: bold; }
                    .header { margin-bottom: 30px; border-bottom: 2px solid #1c1b1f; pb: 20px; }
                    .header h1 { margin: 0 0 10px 0; font-size: 24px; }
                    .info-row { margin-bottom: 5px; font-size: 14px; }
                    .footer { margin-top: 60px; display: flex; justify-content: space-between; font-size: 14px; }
                    .serial-list { font-size: 10px; color: #666; margin-top: 4px; font-family: monospace; line-height: 1.4; word-break: break-all; }
                    .signature-line { border-top: 1px solid #000; width: 200px; margin-top: 40px; }
                    @media print { @page { margin: 1.5cm; } body { padding: 0; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Акт приема-передачи оборудования</h1>
                    <div class="info-row"><strong>Объект:</strong> ${objectName}</div>
                    <div class="info-row"><strong>Дата:</strong> ${new Date().toLocaleDateString('ru-RU')}</div>
                    <div class="info-row"><strong>Ответственный:</strong> ${profile.full_name}</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 40px">№</th>
                            <th>Наименование</th>
                            <th style="width: 100px">Кол-во</th>
                            ${includeSerials ? '<th>Серийные номера</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${printData.map((item, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td>${item.name}</td>
                                <td>${item.quantity} ${item.unit}</td>
                                ${includeSerials ? `<td><div class="serial-list">${item.serials.join(', ') || '-'}</div></td>` : ''}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="footer">
                    <div><p>Отпустил:</p><div class="signature-line"></div><p style="font-size: 10px; margin-top: 5px;">(Подпись / ФИО)</p></div>
                    <div><p>Принял:</p><div class="signature-line"></div><p style="font-size: 10px; margin-top: 5px;">(Подпись / ФИО)</p></div>
                </div>
                <script>window.print();</script>
            </body>
        </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.object_id) { alert('Выберите объект'); return; }
    setLoading(true);
    const now = new Date();

    try {
        if (isBulk) {
            // ... (Logic for bulk deploy from original component)
            const itemsMissingSerials = cartItems.filter(item => {
                const catItem = catalog.find(c => c.id === item.catalog_id);
                if (!catItem?.has_serial) return false;
                const serials = bulkSerials[item.id] || [];
                return serials.filter(s => s.trim() !== '').length < item.quantity;
            });

            if (itemsMissingSerials.length > 0) {
                const confirmSkip = window.confirm(`Вы не указали серийные номера для некоторых товаров (${itemsMissingSerials.length} поз.). \n\nОтгрузить без серийников?`);
                if (!confirmSkip) { setLoading(false); return; }
            }

            for (const item of cartItems) {
                const catItem = catalog.find(c => c.id === item.catalog_id);
                const warrantyMonths = catItem?.warranty_period_months || 0;
                const warrantyEnd = new Date(now);
                warrantyEnd.setMonth(warrantyEnd.getMonth() + warrantyMonths);
                
                const serialsToCreate = (bulkSerials[item.id] || []).slice(0, Math.floor(item.quantity));
                const needsSplit = catItem?.has_serial && serialsToCreate.length > 0;

                const { data: currentStockItem } = await supabase.from('inventory_items').select('quantity').eq('id', item.id).single();
                
                if (currentStockItem) {
                    const newQty = currentStockItem.quantity - item.quantity;
                    if (newQty <= 0.0001) {
                        await supabase.from('inventory_items').update({ quantity: 0, is_deleted: true, deleted_at: now.toISOString() }).eq('id', item.id);
                    } else {
                        await supabase.from('inventory_items').update({ quantity: newQty }).eq('id', item.id);
                    }
                }

                if (needsSplit) {
                    for (const sn of serialsToCreate) {
                        const { data: newItem } = await supabase.from('inventory_items').insert({
                            catalog_id: item.catalog_id,
                            serial_number: sn || null,
                            quantity: 1,
                            purchase_price: item.purchase_price,
                            status: 'deployed',
                            current_object_id: formData.object_id,
                            assigned_to_id: profile.id,
                            warranty_start: now.toISOString(),
                            warranty_end: warrantyEnd.toISOString()
                        }).select('id').single();

                        if (newItem) {
                            await supabase.from('inventory_history').insert([{
                                item_id: newItem.id,
                                action_type: 'deploy',
                                to_object_id: formData.object_id,
                                created_by: profile.id,
                                comment: `Групповая отгрузка. S/N: ${sn || 'N/A'}`
                            }]);
                        }
                    }
                } else {
                    const { data: newItem } = await supabase.from('inventory_items').insert({
                        catalog_id: item.catalog_id,
                        serial_number: null,
                        quantity: item.quantity,
                        purchase_price: item.purchase_price,
                        status: 'deployed',
                        current_object_id: formData.object_id,
                        assigned_to_id: profile.id,
                        warranty_start: now.toISOString(),
                        warranty_end: warrantyEnd.toISOString()
                    }).select('id').single();

                    if (newItem) {
                        await supabase.from('inventory_history').insert([{
                            item_id: newItem.id,
                            action_type: 'deploy',
                            to_object_id: formData.object_id,
                            created_by: profile.id,
                            comment: `Групповая отгрузка. Кол-во: ${item.quantity}`
                        }]);
                    }
                }
            }
        } else if (selectedItem) {
            // ... (Logic for single deploy)
            const qtyToDeploy = parseFloat(formData.quantity_to_deploy);
            if (isNaN(qtyToDeploy) || qtyToDeploy <= 0) throw new Error("Укажите корректное количество");
            if (qtyToDeploy > selectedItem.quantity) throw new Error("Нельзя отгрузить больше, чем есть на складе");

            const warrantyMonths = selectedItem.catalog?.warranty_period_months || 0;
            const warrantyEnd = new Date(now);
            warrantyEnd.setMonth(warrantyEnd.getMonth() + warrantyMonths);

            const deployedStatus = {
                status: 'deployed',
                current_object_id: formData.object_id,
                warranty_start: now.toISOString(),
                warranty_end: warrantyEnd.toISOString(),
                serial_number: formData.serial_number || selectedItem.serial_number
            };

            let deployedItemId = selectedItem.id;

            if (qtyToDeploy < selectedItem.quantity) {
                const newStockQty = selectedItem.quantity - qtyToDeploy;
                await supabase.from('inventory_items').update({ quantity: newStockQty }).eq('id', selectedItem.id);

                const { data: newItem, error: createError } = await supabase.from('inventory_items').insert([{
                    catalog_id: selectedItem.catalog_id,
                    purchase_price: selectedItem.purchase_price,
                    quantity: qtyToDeploy,
                    assigned_to_id: profile.id,
                    ...deployedStatus
                }]).select('id').single();

                if (createError || !newItem) throw new Error('Ошибка при разделении позиции');
                deployedItemId = newItem.id;
            } else {
                const { error } = await supabase.from('inventory_items').update(deployedStatus).eq('id', selectedItem.id);
                if (error) throw error;
            }

            await supabase.from('inventory_history').insert([{
                item_id: deployedItemId,
                action_type: 'deploy',
                to_object_id: formData.object_id,
                created_by: profile.id,
                comment: `Отгрузка ${qtyToDeploy} ${selectedItem.catalog?.unit}. ${formData.serial_number ? `S/N: ${formData.serial_number}` : ''}`
            }]);
        }
        onSuccess();
    } catch (err: any) {
        console.error(err);
        alert('Ошибка при отгрузке: ' + err.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        {isBulk ? (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto bg-slate-50 p-3 rounded-2xl border border-slate-200">
                {cartItems.map(item => {
                    const catItem = catalog.find(c => c.id === item.catalog_id);
                    const requiresSerial = catItem?.has_serial;
                    const stockItem = items.find(i => i.id === item.id);
                    const maxAvailable = stockItem?.quantity || item.quantity;

                    return (
                        <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-all">
                            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-50">
                                <div className="min-w-0 flex-grow pr-4">
                                    <p className="text-sm font-bold text-slate-900 truncate">{item.catalog_name}</p>
                                    <p className="text-[10px] text-slate-400">На складе: {maxAvailable} {item.unit}</p>
                                </div>
                                <div className="w-24">
                                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Кол-во</label>
                                    <input 
                                        type="number"
                                        min="1"
                                        max={maxAvailable}
                                        value={item.quantity}
                                        onChange={(e) => {
                                            const val = Math.min(maxAvailable, Math.max(1, parseInt(e.target.value) || 1));
                                            item.quantity = val; 
                                            setBulkSerials(prev => ({
                                                ...prev,
                                                [item.id]: Array(val).fill('').map((_, i) => prev[item.id]?.[i] || '')
                                            }));
                                        }}
                                        className="w-full h-8 bg-blue-50 border border-blue-100 rounded-lg text-center text-sm font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                            
                            {requiresSerial ? (
                                <div className="grid grid-cols-1 gap-2 pl-3 border-l-2 border-blue-200">
                                    <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Серийные номера:</p>
                                    {(bulkSerials[item.id] || []).map((s, idx) => (
                                        <div key={idx} className="flex items-center gap-2 group">
                                            <span className="text-[9px] font-bold text-slate-300 w-8">#{idx + 1}</span>
                                            <Input 
                                                placeholder="S/N..." 
                                                value={s} 
                                                onChange={(e: any) => updateBulkSerial(item.id, idx, e.target.value)}
                                                className="!h-8 !text-xs flex-grow focus:border-blue-400"
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-slate-400 bg-slate-50 p-2 rounded-lg">
                                    <span className="material-icons-round text-sm">info</span>
                                    <p className="text-[10px] italic">Серийные номера не требуются</p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        ) : (
            <div className="bg-slate-50 p-4 rounded-2xl">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs text-slate-500 mb-1">Отгружаемый товар</p>
                        <p className="font-bold text-slate-900">{selectedItem?.catalog?.name}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-500 mb-1">Доступно</p>
                        <p className="font-bold text-slate-900">{selectedItem?.quantity} {selectedItem?.catalog?.unit}</p>
                    </div>
                </div>
                {selectedItem?.serial_number ? (
                    <p className="text-xs font-mono mt-2 bg-white inline-block px-2 py-1 rounded border border-slate-200">{selectedItem.serial_number}</p>
                ) : (
                    <div className="mt-3">
                        <Input 
                            label="Ввести Серийный Номер (при отгрузке)" 
                            placeholder="S/N сканера..."
                            value={formData.serial_number}
                            onChange={(e: any) => setFormData({...formData, serial_number: e.target.value})}
                            className="bg-white"
                        />
                    </div>
                )}
            </div>
        )}

        {!isBulk && (
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                <Input 
                    label={`Количество к отгрузке (макс: ${selectedItem?.quantity})`}
                    type="number"
                    step="0.01"
                    required
                    value={formData.quantity_to_deploy}
                    onChange={(e: any) => setFormData({...formData, quantity_to_deploy: e.target.value})}
                    className="bg-white"
                />
            </div>
        )}

        <Select 
            label="Объект назначения" 
            required 
            value={formData.object_id} 
            onChange={(e: any) => setFormData({...formData, object_id: e.target.value})}
            options={[{value: '', label: 'Выберите объект'}, ...objects.map(o => ({value: o.id, label: o.name}))]}
            icon="home_work"
        />

        {isBulk && (
            <div className="mt-6 p-4 bg-slate-100 rounded-2xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-3">Опции печати накладной</p>
                <div className="flex gap-2">
                    <Button 
                        type="button" 
                        variant="secondary" 
                        className="flex-1 text-[10px]" 
                        onClick={() => handlePrint(false)}
                        disabled={!formData.object_id}
                    >
                        <span className="material-icons-round text-sm mr-1">print</span> Без S/N
                    </Button>
                    <Button 
                        type="button" 
                        variant="secondary" 
                        className="flex-1 text-[10px]" 
                        onClick={() => handlePrint(true)}
                        disabled={!formData.object_id}
                    >
                        <span className="material-icons-round text-sm mr-1">receipt_long</span> С S/N
                    </Button>
                </div>
            </div>
        )}

        <Button type="submit" className="w-full h-12" loading={loading}>{isBulk ? 'Отгрузить всё' : 'Отгрузить'}</Button>
    </form>
  );
};
