
import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { Input, Select, Button } from '../../../ui';
import { Product, InventoryItem } from '../../../../types';
import { CartItem } from '../index';

interface DeployFormProps {
  selectedItem: InventoryItem | null;
  cartItems: CartItem[];
  catalog: Product[]; 
  items: InventoryItem[]; // Stock items
  objects: any[];
  profile: any;
  onSuccess: () => void;
}

export const DeployForm: React.FC<DeployFormProps> = ({ selectedItem, cartItems, catalog, items, objects, profile, onSuccess }) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ 
      object_id: '', 
      serial_number: '', 
      quantity_to_deploy: '1'
  });
  const [bulkSerials, setBulkSerials] = useState<Record<string, string[]>>({});
  
  // NEW: Bulk Text Input State
  const [bulkTextInput, setBulkTextInput] = useState('');
  const [bulkModeActive, setBulkModeActive] = useState<string | null>(null); // itemId that is being bulk-edited

  const isBulk = !selectedItem && cartItems.length > 0;

  useEffect(() => {
    if (isBulk) {
       const initialSerials: Record<string, string[]> = {};
       cartItems.forEach(c => {
           const catItem = catalog.find(cat => cat.id === c.product_id); 
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

  const handleBulkTextParse = (itemId: string) => {
      if (!bulkTextInput.trim()) {
          setBulkModeActive(null);
          return;
      }
      // Split by newlines, commas, or spaces
      const serials = bulkTextInput.split(/[\n,]+/).map(s => s.trim()).filter(s => s !== '');
      const currentArr = bulkSerials[itemId] || [];
      const maxSlots = currentArr.length;
      
      const newArr = [...currentArr];
      for(let i = 0; i < Math.min(serials.length, maxSlots); i++) {
          newArr[i] = serials[i];
      }
      
      setBulkSerials(prev => ({ ...prev, [itemId]: newArr }));
      setBulkTextInput('');
      setBulkModeActive(null);
  };

  const handlePrint = (includeSerials: boolean) => {
    // ... (Printing logic remains same)
    const objectName = objects.find(o => o.id === formData.object_id)?.name || '_____________';
    
    const grouped: Record<string, { name: string, quantity: number, unit: string, serials: string[] }> = {};
    const sourceItems = isBulk ? cartItems : (selectedItem ? [{ 
        id: selectedItem.id, 
        product_id: selectedItem.product_id, 
        product_name: selectedItem.product?.name || '', 
        quantity: parseFloat(formData.quantity_to_deploy),
        unit: selectedItem.product?.unit || 'шт',
        serial_number: formData.serial_number || selectedItem.serial_number
    }] : []);

    sourceItems.forEach((item: any) => {
        if (!grouped[item.product_id]) {
            grouped[item.product_id] = {
                name: item.product_name,
                quantity: 0,
                unit: item.unit,
                serials: []
            };
        }
        grouped[item.product_id].quantity += item.quantity;
        
        if (includeSerials) {
            if (isBulk && bulkSerials[item.id]) {
                const valid = bulkSerials[item.id].filter(s => s && s.trim() !== '');
                grouped[item.product_id].serials.push(...valid);
            } else if (!isBulk && item.serial_number) {
                grouped[item.product_id].serials.push(item.serial_number);
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

  const mutation = useMutation({
    mutationFn: async () => {
        const now = new Date();
        if (isBulk) {
            // ... (Same Bulk Logic)
            const itemsMissingSerials = cartItems.filter(item => {
                const catItem = catalog.find(c => c.id === item.product_id);
                if (!catItem?.has_serial) return false;
                const serials = bulkSerials[item.id] || [];
                return serials.filter(s => s.trim() !== '').length < item.quantity;
            });

            if (itemsMissingSerials.length > 0) {
                const confirmSkip = window.confirm(`Вы не указали серийные номера для некоторых товаров (${itemsMissingSerials.length} поз.). \n\nОтгрузить без серийников?`);
                if (!confirmSkip) return;
            }

            for (const item of cartItems) {
                const catItem = catalog.find(c => c.id === item.product_id);
                const warrantyDays = catItem?.warranty_days || 365;
                const warrantyEnd = new Date(now);
                warrantyEnd.setDate(warrantyEnd.getDate() + warrantyDays);
                
                const serialsToCreate = (bulkSerials[item.id] || []).slice(0, Math.floor(item.quantity));
                const needsSplit = catItem?.has_serial && serialsToCreate.length > 0;

                const { data: currentStockItem } = await supabase.from('inventory_items').select('quantity').eq('id', item.id).single();
                
                if (currentStockItem) {
                    const currentQty = currentStockItem.quantity ?? 0;
                    const newQty = currentQty - item.quantity;
                    if (newQty <= 0.0001) {
                        await supabase.from('inventory_items').update({ quantity: 0, deleted_at: now.toISOString() }).eq('id', item.id);
                    } else {
                        await supabase.from('inventory_items').update({ quantity: newQty }).eq('id', item.id);
                    }
                }

                if (needsSplit) {
                    for (const sn of serialsToCreate) {
                        const { data: newItem } = await supabase.from('inventory_items').insert({
                            product_id: item.product_id,
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
                        product_id: item.product_id,
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
            // ... (Same Single Logic)
            const qtyToDeploy = parseFloat(formData.quantity_to_deploy);
            if (isNaN(qtyToDeploy) || qtyToDeploy <= 0) throw new Error("Укажите корректное количество");
            if (qtyToDeploy > selectedItem.quantity) throw new Error("Нельзя отгрузить больше, чем есть на складе");

            const warrantyDays = selectedItem.product?.warranty_days || 365;
            const warrantyEnd = new Date(now);
            warrantyEnd.setDate(warrantyEnd.getDate() + warrantyDays);

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
                    product_id: selectedItem.product_id,
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
                comment: `Отгрузка ${qtyToDeploy} ${selectedItem.product?.unit}. ${formData.serial_number ? `S/N: ${formData.serial_number}` : ''}`
            }]);
        }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_items'] });
      onSuccess();
    },
    onError: (error: any) => {
      console.error(error);
      alert('Ошибка при отгрузке: ' + error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.object_id) { alert('Выберите объект'); return; }
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        {isBulk ? (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto bg-slate-50 p-3 rounded-2xl border border-slate-200">
                {cartItems.map(item => {
                    const catItem = catalog.find(c => c.id === item.product_id);
                    const requiresSerial = catItem?.has_serial;
                    const stockItem = items.find(i => i.id === item.id);
                    const maxAvailable = stockItem?.quantity || item.quantity;
                    const serialsCount = (bulkSerials[item.id] || []).length;

                    return (
                        <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-all">
                            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-50">
                                <div className="min-w-0 flex-grow pr-4">
                                    <p className="text-sm font-bold text-slate-900 truncate">{item.product_name}</p>
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
                                <div>
                                    {bulkModeActive === item.id ? (
                                        <div className="animate-in fade-in zoom-in-95 duration-200">
                                            <textarea 
                                                autoFocus
                                                value={bulkTextInput}
                                                onChange={(e) => setBulkTextInput(e.target.value)}
                                                className="w-full h-32 p-3 bg-slate-50 border border-blue-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-200 outline-none"
                                                placeholder={`Вставьте ${serialsCount} S/N (каждый с новой строки)`}
                                            />
                                            <div className="flex gap-2 mt-2">
                                                <Button type="button" onClick={() => handleBulkTextParse(item.id)} className="h-8 text-xs">Применить список</Button>
                                                <Button type="button" variant="ghost" onClick={() => setBulkModeActive(null)} className="h-8 text-xs">Отмена</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-1 gap-2 pl-3 border-l-2 border-blue-200">
                                                <div className="flex justify-between items-center mb-1">
                                                    <p className="text-[10px] font-bold text-blue-600 uppercase">Серийные номера:</p>
                                                    <button type="button" onClick={() => { setBulkModeActive(item.id); setBulkTextInput((bulkSerials[item.id] || []).join('\n')); }} className="text-[10px] font-bold text-blue-500 hover:underline flex items-center gap-1">
                                                        <span className="material-icons-round text-sm">playlist_add</span> Массовый ввод
                                                    </button>
                                                </div>
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
                                        </>
                                    )}
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
            // ... (Single Item UI)
            <div className="bg-slate-50 p-4 rounded-2xl">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs text-slate-500 mb-1">Отгружаемый товар</p>
                        <p className="font-bold text-slate-900">{selectedItem?.product?.name}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-500 mb-1">Доступно</p>
                        <p className="font-bold text-slate-900">{selectedItem?.quantity} {selectedItem?.product?.unit}</p>
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

        <Button type="submit" className="w-full h-12" loading={mutation.isPending}>{isBulk ? 'Отгрузить всё' : 'Отгрузить'}</Button>
    </form>
  );
};
