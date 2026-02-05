
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Modal, Input, Select, Button } from '../../ui';
import { InventoryCatalogItem, InventoryItem } from '../../../types';
import { CartItem } from './index';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create_catalog' | 'add_item' | 'deploy_item' | 'replace_item' | 'edit_catalog' | 'edit_item' | 'return_item';
  catalog: InventoryCatalogItem[];
  objects: any[];
  items: InventoryItem[]; // All items for replacement logic
  selectedItem: any | null; // Can be InventoryItem or CatalogItem depending on mode
  cartItems?: CartItem[]; // New prop for bulk actions
  profile: any;
  onSuccess: (keepOpen?: boolean) => void;
}

const InventoryModal: React.FC<InventoryModalProps> = ({ 
  isOpen, onClose, mode, catalog, objects, items, selectedItem, cartItems = [], profile, onSuccess 
}) => {
  const [loading, setLoading] = useState(false);
  const [skipSerial, setSkipSerial] = useState(false);
  
  // Local state for bulk serials editing: Map<ItemID, Array<SerialNumber>>
  const [bulkSerials, setBulkSerials] = useState<Record<string, string[]>>({});

  // Create/Edit Catalog State
  const [catForm, setCatForm] = useState({ 
    name: '', sku: '', unit: 'шт', last_purchase_price: '', 
    description: '', warranty_period_months: '12', has_serial: false,
    item_type: 'product' as 'product' | 'material'
  });

  // Add/Edit Item State
  const [itemForm, setItemForm] = useState({ catalog_id: '', serial_number: '', quantity: '1', purchase_price: '' });

  // Deploy/Return State
  const [deployForm, setDeployForm] = useState({ 
      object_id: '', 
      serial_number: '', 
      quantity_to_deploy: '1',
      return_reason: 'surplus'
  });

  // Replace State
  const [replaceForm, setReplaceForm] = useState({ 
      new_item_id: '', 
      old_quantity: '1', 
      new_quantity: '1',
      reason: 'defect',
      comment: ''
  });

  // Computed properties
  const selectedCatalogItem = useMemo(() => 
    catalog.find(c => c.id === itemForm.catalog_id), 
  [itemForm.catalog_id, catalog]);

  const isSerialRequired = selectedCatalogItem?.has_serial && !skipSerial;
  const isBulkDeploy = mode === 'deploy_item' && cartItems.length > 0 && !selectedItem;

  // Reset/Init forms
  useEffect(() => {
    if (isOpen) {
       setSkipSerial(false);
       setBulkSerials({});
       
       // Initialize bulk serials structure
       if (isBulkDeploy) {
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
       }

       setDeployForm({ 
         object_id: '', 
         serial_number: '', 
         quantity_to_deploy: selectedItem && selectedItem.quantity ? selectedItem.quantity.toString() : '1',
         return_reason: 'surplus'
       });
       
       // Reset Replace Form
       setReplaceForm({ 
           new_item_id: '', 
           old_quantity: selectedItem && selectedItem.quantity ? selectedItem.quantity.toString() : '1',
           new_quantity: '1',
           reason: 'defect',
           comment: ''
       });

       setItemForm({ catalog_id: '', serial_number: '', quantity: '1', purchase_price: '' });
       setCatForm({ 
         name: '', sku: '', unit: 'шт', last_purchase_price: '', 
         description: '', warranty_period_months: '12', has_serial: false,
         item_type: 'product'
       });

       if (mode === 'edit_catalog' && selectedItem) {
         setCatForm({
           name: selectedItem.name,
           sku: selectedItem.sku || '',
           unit: selectedItem.unit,
           last_purchase_price: selectedItem.last_purchase_price?.toString() || '',
           description: selectedItem.description || '',
           warranty_period_months: selectedItem.warranty_period_months?.toString() || '12',
           has_serial: selectedItem.has_serial,
           item_type: selectedItem.item_type || 'product'
         });
       } else if (mode === 'edit_item' && selectedItem) {
         setItemForm({
           catalog_id: selectedItem.catalog_id,
           serial_number: selectedItem.serial_number || '',
           quantity: selectedItem.quantity?.toString() || '1',
           purchase_price: selectedItem.purchase_price?.toString() || ''
         });
       }
    }
  }, [isOpen, selectedItem, mode, cartItems, isBulkDeploy, catalog]);

  // Force quantity to 1 if serial number is required
  useEffect(() => {
    if (mode === 'add_item' && isSerialRequired) {
      setItemForm(prev => ({ ...prev, quantity: '1' }));
    }
  }, [isSerialRequired, mode]);

  // Update purchase price when catalog item is selected
  useEffect(() => {
    if (mode === 'add_item' && itemForm.catalog_id) {
        const catItem = catalog.find(c => c.id === itemForm.catalog_id);
        if (catItem && catItem.last_purchase_price !== undefined) {
            setItemForm(prev => ({ ...prev, purchase_price: catItem.last_purchase_price!.toString() }));
        }
    }
  }, [itemForm.catalog_id, catalog, mode]);

  // --- PRINT LOGIC START ---
  const preparePrintData = (items: CartItem[], includeSerials: boolean) => {
    const grouped: Record<string, { 
        name: string, 
        quantity: number, 
        unit: string, 
        serials: string[] 
    }> = {};

    items.forEach(item => {
        if (!grouped[item.catalog_id]) {
            grouped[item.catalog_id] = {
                name: item.catalog_name,
                quantity: 0,
                unit: item.unit,
                serials: []
            };
        }
        grouped[item.catalog_id].quantity += item.quantity;
        if (includeSerials && bulkSerials[item.id]) {
            // Filter valid serials
            const validSerials = bulkSerials[item.id].filter(s => s && s.trim() !== '');
            grouped[item.catalog_id].serials.push(...validSerials);
        }
    });

    return Object.values(grouped);
  };

  const handlePrint = (includeSerials: boolean) => {
    const printData = preparePrintData(cartItems, includeSerials);
    const objectName = objects.find(o => o.id === deployForm.object_id)?.name || '_____________';
    
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
                    @media print {
                        @page { margin: 1.5cm; }
                        body { padding: 0; }
                    }
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
                    <div>
                        <p>Отпустил:</p>
                        <div class="signature-line"></div>
                        <p style="font-size: 10px; margin-top: 5px;">(Подпись / ФИО)</p>
                    </div>
                    <div>
                        <p>Принял:</p>
                        <div class="signature-line"></div>
                        <p style="font-size: 10px; margin-top: 5px;">(Подпись / ФИО)</p>
                    </div>
                </div>
                <script>window.print();</script>
            </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };
  // --- PRINT LOGIC END ---

  const handleCreateCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
        name: catForm.name,
        item_type: catForm.item_type || 'product',
        sku: catForm.sku || null,
        unit: catForm.unit || 'шт',
        last_purchase_price: parseFloat(catForm.last_purchase_price) || 0,
        description: catForm.description || null,
        has_serial: catForm.has_serial,
        warranty_period_months: parseInt(catForm.warranty_period_months) || 12
    };
    const { error } = await supabase.from('inventory_catalog').insert([payload]);
    setLoading(false);
    if (error) {
        alert('Ошибка создания: ' + JSON.stringify(error));
    } else {
        onSuccess();
    }
  };

  const handleUpdateCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setLoading(true);
    const { error } = await supabase.from('inventory_catalog').update({
        ...catForm, 
        warranty_period_months: parseInt(catForm.warranty_period_months),
        last_purchase_price: parseFloat(catForm.last_purchase_price) || 0
    }).eq('id', selectedItem.id);
    setLoading(false);
    if (!error) onSuccess();
  };

  const handleAddItem = async (e?: React.FormEvent, keepOpen = false) => {
    if (e) e.preventDefault();
    if (!itemForm.catalog_id) return;
    
    const qty = parseFloat(itemForm.quantity);
    if (isNaN(qty) || qty <= 0) {
        alert('Укажите корректное количество');
        return;
    }

    if (isSerialRequired) {
        if (!itemForm.serial_number.trim()) {
            alert('Необходимо ввести серийный номер');
            return;
        }
        if (qty !== 1) {
            alert('Для товаров с S/N количество должно быть равно 1');
            return;
        }
    }

    setLoading(true);
    const finalSerial = skipSerial ? '[БЕЗ S/N]' : (itemForm.serial_number.trim() || null);

    const payload = {
        catalog_id: itemForm.catalog_id,
        serial_number: finalSerial,
        quantity: qty,
        purchase_price: parseFloat(itemForm.purchase_price) || 0,
        status: 'in_stock',
        assigned_to_id: profile.id
    };

    const { data, error } = await supabase.from('inventory_items').insert([payload]).select('id').single();
    
    if (!error && data) {
        await supabase.from('inventory_history').insert([{
            item_id: data.id,
            action_type: 'receive',
            created_by: profile.id,
            comment: `Приемка. Кол-во: ${payload.quantity}`
        }]);
        onSuccess(keepOpen);
        if (keepOpen) setItemForm(prev => ({ ...prev, serial_number: '' }));
    } else if (error) {
        alert("Ошибка при сохранении: " + error.message);
    }
    setLoading(false);
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setLoading(true);
    const { error } = await supabase.from('inventory_items').update({
        serial_number: itemForm.serial_number || null,
        quantity: parseFloat(itemForm.quantity) || 1,
        purchase_price: parseFloat(itemForm.purchase_price) || 0
    }).eq('id', selectedItem.id);
    setLoading(false);
    if (!error) onSuccess();
  };

  const handleDeployItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deployForm.object_id) return;
    
    // --- BULK DEPLOY LOGIC ---
    if (isBulkDeploy) {
        // 1. Check Serials
        const itemsMissingSerials = cartItems.filter(item => {
            const catItem = catalog.find(c => c.id === item.catalog_id);
            if (!catItem?.has_serial) return false;
            
            const serials = bulkSerials[item.id] || [];
            return serials.filter(s => s.trim() !== '').length < item.quantity;
        });

        if (itemsMissingSerials.length > 0) {
            const confirmSkip = window.confirm(
                `Вы не указали серийные номера для некоторых товаров (${itemsMissingSerials.length} поз.). \n\nОтгрузить без серийников?`
            );
            if (!confirmSkip) return;
        }

        setLoading(true);
        const now = new Date();
        
        try {
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
                            current_object_id: deployForm.object_id,
                            assigned_to_id: profile.id,
                            warranty_start: now.toISOString(),
                            warranty_end: warrantyEnd.toISOString()
                        }).select('id').single();

                        if (newItem) {
                            await supabase.from('inventory_history').insert([{
                                item_id: newItem.id,
                                action_type: 'deploy',
                                to_object_id: deployForm.object_id,
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
                        current_object_id: deployForm.object_id,
                        assigned_to_id: profile.id,
                        warranty_start: now.toISOString(),
                        warranty_end: warrantyEnd.toISOString()
                    }).select('id').single();

                    if (newItem) {
                        await supabase.from('inventory_history').insert([{
                            item_id: newItem.id,
                            action_type: 'deploy',
                            to_object_id: deployForm.object_id,
                            created_by: profile.id,
                            comment: `Групповая отгрузка. Кол-во: ${item.quantity}`
                        }]);
                    }
                }
            }
            onSuccess();
        } catch (err) {
            console.error(err);
            alert('Ошибка при групповой отгрузке');
        }
        setLoading(false);
        return;
    }

    // --- SINGLE ITEM DEPLOY LOGIC ---
    if (!selectedItem) return;
    
    const qtyToDeploy = parseFloat(deployForm.quantity_to_deploy);
    if (isNaN(qtyToDeploy) || qtyToDeploy <= 0) { alert("Укажите корректное количество"); return; }
    if (qtyToDeploy > selectedItem.quantity) { alert("Нельзя отгрузить больше, чем есть на складе"); return; }

    setLoading(true);
    const now = new Date();
    const warrantyMonths = selectedItem.catalog?.warranty_period_months || 0;
    const warrantyEnd = new Date(now);
    warrantyEnd.setMonth(warrantyEnd.getMonth() + warrantyMonths);

    const deployedStatus = {
        status: 'deployed',
        current_object_id: deployForm.object_id,
        warranty_start: now.toISOString(),
        warranty_end: warrantyEnd.toISOString(),
        serial_number: deployForm.serial_number || selectedItem.serial_number
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

        if (createError || !newItem) { alert('Ошибка при разделении позиции'); setLoading(false); return; }
        deployedItemId = newItem.id;
    } else {
        const { error } = await supabase.from('inventory_items').update(deployedStatus).eq('id', selectedItem.id);
        if (error) { setLoading(false); return; }
    }

    await supabase.from('inventory_history').insert([{
        item_id: deployedItemId,
        action_type: 'deploy',
        to_object_id: deployForm.object_id,
        created_by: profile.id,
        comment: `Отгрузка ${qtyToDeploy} ${selectedItem.catalog?.unit}. ${deployForm.serial_number ? `S/N: ${deployForm.serial_number}` : ''}`
    }]);

    onSuccess();
    setLoading(false);
  };

  const handleReturnItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    
    const qtyToReturn = parseFloat(deployForm.quantity_to_deploy); 
    if (isNaN(qtyToReturn) || qtyToReturn <= 0) {
        alert("Укажите корректное количество для возврата");
        return;
    }

    setLoading(true);
    const reasonText = {
        surplus: 'Излишек (не пригодилось)',
        cancellation: 'Отказ клиента',
        wrong_item: 'Ошибочная отгрузка',
        repair: 'Демонтаж для ремонта'
    }[deployForm.return_reason] || 'Возврат';

    try {
        if (qtyToReturn < selectedItem.quantity) {
            // Partial Return
            await supabase.from('inventory_items')
                .update({ quantity: selectedItem.quantity - qtyToReturn })
                .eq('id', selectedItem.id);

            const { data: returnedItem } = await supabase.from('inventory_items').insert([{
                catalog_id: selectedItem.catalog_id,
                serial_number: selectedItem.serial_number,
                quantity: qtyToReturn,
                purchase_price: selectedItem.purchase_price,
                status: 'in_stock',
                assigned_to_id: profile.id,
                current_object_id: null
            }]).select().single();

            if (returnedItem) {
                await supabase.from('inventory_history').insert([{
                    item_id: returnedItem.id,
                    action_type: 'receive', 
                    created_by: profile.id,
                    comment: `Возврат с объекта. Причина: ${reasonText}`
                }]);
            }
        } else {
            // Full Return
            await supabase.from('inventory_items').update({
                status: 'in_stock',
                current_object_id: null,
                assigned_to_id: profile.id
            }).eq('id', selectedItem.id);

            await supabase.from('inventory_history').insert([{
                item_id: selectedItem.id,
                action_type: 'receive',
                created_by: profile.id,
                comment: `Полный возврат на склад. Причина: ${reasonText}`
            }]);
        }
        onSuccess();
    } catch (err) {
        console.error(err);
        alert("Ошибка при возврате товара");
    } finally {
        setLoading(false);
    }
  };

  const handleReplaceItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !replaceForm.new_item_id) return;
    
    const qtyOld = parseFloat(replaceForm.old_quantity);
    const qtyNew = parseFloat(replaceForm.new_quantity);
    
    if (isNaN(qtyOld) || qtyOld <= 0 || qtyOld > selectedItem.quantity) { alert('Некорректное кол-во к списанию'); return; }
    if (isNaN(qtyNew) || qtyNew <= 0) { alert('Некорректное кол-во к установке'); return; }

    setLoading(true);
    const now = new Date();

    const stockItem = items.find(i => i.id === replaceForm.new_item_id);
    if (!stockItem || stockItem.quantity < qtyNew) {
        alert('Недостаточно выбранного товара на складе!');
        setLoading(false);
        return;
    }

    try {
        // 1. Process OLD item (Scrap/Dismantle)
        if (qtyOld < selectedItem.quantity) {
            // Partial scrap
            await supabase.from('inventory_items').update({ quantity: selectedItem.quantity - qtyOld }).eq('id', selectedItem.id);
            // Create record for history tracking (scrapped part)
            await supabase.from('inventory_items').insert({
                catalog_id: selectedItem.catalog_id,
                serial_number: selectedItem.serial_number,
                quantity: qtyOld,
                purchase_price: selectedItem.purchase_price,
                status: 'scrapped',
                current_object_id: null,
                assigned_to_id: profile.id
            });

            await supabase.from('inventory_history').insert([{
                item_id: selectedItem.id,
                action_type: 'scrap',
                from_object_id: selectedItem.current_object_id,
                created_by: profile.id,
                comment: `Частичное списание (${qtyOld} ед). Причина: ${replaceForm.reason}. ${replaceForm.comment}`
            }]);
        } else {
            // Full scrap
            await supabase.from('inventory_items').update({
                status: 'scrapped',
                current_object_id: null,
                quantity: qtyOld
            }).eq('id', selectedItem.id);

            await supabase.from('inventory_history').insert([{
                item_id: selectedItem.id,
                action_type: 'scrap',
                from_object_id: selectedItem.current_object_id,
                created_by: profile.id,
                comment: `Демонтаж. Причина: ${replaceForm.reason}. ${replaceForm.comment}`
            }]);
        }

        // 2. Process NEW item (Install)
        const warrantyMonths = stockItem.catalog?.warranty_period_months || 0;
        const warrantyEnd = new Date(now);
        warrantyEnd.setMonth(warrantyEnd.getMonth() + warrantyMonths);

        // Deduct from stock
        const newStockQty = stockItem.quantity - qtyNew;
        if (newStockQty <= 0.0001) {
             await supabase.from('inventory_items').update({ quantity: 0, is_deleted: true, deleted_at: now.toISOString() }).eq('id', stockItem.id);
        } else {
             await supabase.from('inventory_items').update({ quantity: newStockQty }).eq('id', stockItem.id);
        }

        // Create new deployed record
        const { data: deployedNew } = await supabase.from('inventory_items').insert({
            catalog_id: stockItem.catalog_id,
            serial_number: stockItem.serial_number, 
            quantity: qtyNew,
            purchase_price: stockItem.purchase_price,
            status: 'deployed',
            current_object_id: selectedItem.current_object_id,
            assigned_to_id: profile.id,
            warranty_start: now.toISOString(),
            warranty_end: warrantyEnd.toISOString()
        }).select().single();

        if (deployedNew) {
            await supabase.from('inventory_history').insert([{
                item_id: deployedNew.id,
                action_type: 'deploy',
                to_object_id: selectedItem.current_object_id,
                created_by: profile.id,
                comment: `Замена для ${selectedItem.catalog?.name} (S/N: ${selectedItem.serial_number || 'N/A'})`
            }]);
        }

        onSuccess();
    } catch (e) {
        console.error(e);
        alert('Ошибка при замене');
    }
    setLoading(false);
  };

  const compatibleItems = selectedItem 
    ? items.filter(i => i.status === 'in_stock' && i.catalog_id === selectedItem.catalog_id)
    : [];

  const getTitle = () => {
      switch(mode) {
          case 'create_catalog': return 'Новый тип оборудования';
          case 'edit_catalog': return 'Редактирование справочника';
          case 'add_item': return 'Приемка на склад';
          case 'edit_item': return 'Корректировка партии';
          case 'deploy_item': return isBulkDeploy ? `Массовая отгрузка (${cartItems.length} поз.)` : 'Отгрузка на объект';
          case 'replace_item': return 'Гарантийная замена';
          case 'return_item': return 'Возврат на склад';
      }
  };

  const units = [
      { value: 'шт', label: 'Штуки (шт)' },
      { value: 'м', label: 'Метры (м)' },
      { value: 'упак', label: 'Упаковки (упак)' },
      { value: 'компл', label: 'Комплекты (компл)' }
  ];

  const updateBulkSerial = (itemId: string, index: number, value: string) => {
      setBulkSerials(prev => {
          const newArr = [...(prev[itemId] || [])];
          newArr[index] = value;
          return { ...prev, [itemId]: newArr };
      });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getTitle()}>
        {(mode === 'create_catalog' || mode === 'edit_catalog') && (
            <form onSubmit={mode === 'create_catalog' ? handleCreateCatalog : handleUpdateCatalog} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Название" required value={catForm.name} onChange={(e:any) => setCatForm({...catForm, name: e.target.value})} />
                    <Input label="Артикул (SKU)" value={catForm.sku} onChange={(e:any) => setCatForm({...catForm, sku: e.target.value})} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <Select 
                        label="Тип ТМЦ" 
                        value={catForm.item_type} 
                        onChange={(e:any) => setCatForm({...catForm, item_type: e.target.value as any})}
                        options={[{value: 'product', label: 'Оборудование'}, {value: 'material', label: 'Материал'}]} 
                    />
                    <Select 
                        label="Ед. измерения" 
                        value={catForm.unit} 
                        onChange={(e:any) => setCatForm({...catForm, unit: e.target.value})}
                        options={units} 
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Input label="Цена закупки (справочно)" type="number" step="0.01" value={catForm.last_purchase_price} onChange={(e:any) => setCatForm({...catForm, last_purchase_price: e.target.value})} />
                    <Input label="Гарантия (мес)" type="number" required value={catForm.warranty_period_months} onChange={(e:any) => setCatForm({...catForm, warranty_period_months: e.target.value})} />
                </div>
                
                <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl cursor-pointer">
                    <input type="checkbox" checked={catForm.has_serial} onChange={(e) => setCatForm({...catForm, has_serial: e.target.checked})} className="w-5 h-5 rounded" />
                    <span className="text-sm font-bold text-slate-700">Обычно имеет серийный номер</span>
                </label>
                
                <div className="w-full">
                    <label className="block text-xs font-medium text-[#444746] mb-1.5 ml-1">Описание</label>
                    <textarea className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm" value={catForm.description} onChange={(e) => setCatForm({...catForm, description: e.target.value})} />
                </div>
                
                <div className="pt-2">
                    <Button type="submit" className="w-full h-12" loading={loading}>{mode === 'edit_catalog' ? 'Сохранить изменения' : 'Создать'}</Button>
                </div>
            </form>
        )}

        {(mode === 'add_item' || mode === 'edit_item') && (
            <form onSubmit={mode === 'add_item' ? (e) => handleAddItem(e, false) : handleUpdateItem} className="space-y-4">
                {mode === 'add_item' ? (
                    <Select 
                        label="Тип оборудования" 
                        required 
                        value={itemForm.catalog_id} 
                        onChange={(e:any) => setItemForm({...itemForm, catalog_id: e.target.value})}
                        options={[{value: '', label: 'Выберите тип'}, ...catalog.map(c => ({value: c.id, label: c.name}))]}
                    />
                ) : (
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-2">
                        <p className="text-xs text-blue-500 font-bold uppercase mb-1">Редактирование партии</p>
                        <p className="font-bold text-blue-900">{selectedItem?.catalog?.name}</p>
                    </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                    <Input 
                        label="Количество" 
                        type="number"
                        step="0.01"
                        required
                        disabled={isSerialRequired && mode === 'add_item'}
                        value={itemForm.quantity} 
                        onChange={(e:any) => setItemForm({...itemForm, quantity: e.target.value})}
                        className={isSerialRequired && mode === 'add_item' ? 'bg-slate-100 text-slate-500' : ''} 
                    />
                    <Input 
                        label="Цена закупки (за ед.)"
                        type="number"
                        step="0.01"
                        required
                        value={itemForm.purchase_price}
                        onChange={(e:any) => setItemForm({...itemForm, purchase_price: e.target.value})}
                    />
                </div>
                
                <div className="mb-2">
                    <Input 
                        label="Серийный номер" 
                        value={itemForm.serial_number} 
                        onChange={(e:any) => setItemForm({...itemForm, serial_number: e.target.value})} 
                        placeholder={isSerialRequired ? "Сканируйте S/N..." : "Номер не обязателен"}
                        disabled={skipSerial && mode === 'add_item'}
                        required={isSerialRequired}
                        className={skipSerial ? 'bg-slate-50 opacity-60' : ''}
                    />
                    {selectedCatalogItem?.has_serial && mode === 'add_item' && (
                        <label className="flex items-center gap-2 mt-2 cursor-pointer group">
                            <input 
                                type="checkbox" 
                                checked={skipSerial} 
                                onChange={(e) => setSkipSerial(e.target.checked)} 
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-xs font-bold text-slate-500 group-hover:text-blue-600 transition-colors">Принять без ввода S/N</span>
                        </label>
                    )}
                </div>
                
                <div className="pt-2 flex gap-3">
                    {mode === 'add_item' ? (
                        <>
                            <Button 
                                type="button" 
                                variant="secondary" 
                                className="flex-1" 
                                loading={loading}
                                onClick={(e) => { e.preventDefault(); handleAddItem(undefined, true); }}
                            >
                                Добавить и еще
                            </Button>
                            <Button type="submit" className="flex-1" loading={loading}>
                                Добавить и закрыть
                            </Button>
                        </>
                    ) : (
                        <Button type="submit" className="w-full h-12" loading={loading}>Сохранить изменения</Button>
                    )}
                </div>
            </form>
        )}

        {mode === 'deploy_item' && (selectedItem || isBulkDeploy) && (
             <form onSubmit={handleDeployItem} className="space-y-4">
                
                {isBulkDeploy ? (
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
                                                        onChange={(e:any) => updateBulkSerial(item.id, idx, e.target.value)}
                                                        className="!h-8 !text-xs flex-grow focus:border-blue-400"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-slate-400 bg-slate-50 p-2 rounded-lg">
                                            <span className="material-icons-round text-sm">info</span>
                                            <p className="text-[10px] italic">Серийные номера не требуются для этого типа товара</p>
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
                                    value={deployForm.serial_number}
                                    onChange={(e:any) => setDeployForm({...deployForm, serial_number: e.target.value})}
                                    className="bg-white"
                                />
                            </div>
                        )}
                    </div>
                )}

                {!isBulkDeploy && (
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                        <Input 
                            label={`Количество к отгрузке (макс: ${selectedItem?.quantity})`}
                            type="number"
                            step="0.01"
                            required
                            value={deployForm.quantity_to_deploy}
                            onChange={(e:any) => setDeployForm({...deployForm, quantity_to_deploy: e.target.value})}
                            className="bg-white"
                        />
                        <p className="text-[10px] text-blue-600 mt-2 ml-1">
                            * Если указать меньше доступного, позиция будет разделена на две части.
                        </p>
                    </div>
                )}

                <Select 
                    label="Объект назначения" 
                    required 
                    value={deployForm.object_id} 
                    onChange={(e:any) => setDeployForm({...deployForm, object_id: e.target.value})}
                    options={[{value: '', label: 'Выберите объект'}, ...objects.map(o => ({value: o.id, label: o.name}))]}
                    icon="home_work"
                />

                {/* Print Options for Bulk Deploy */}
                {isBulkDeploy && (
                    <div className="mt-6 p-4 bg-slate-100 rounded-2xl border border-slate-200">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-3">Опции печати накладной</p>
                        <div className="flex gap-2">
                            <Button 
                                type="button" 
                                variant="secondary" 
                                className="flex-1 text-[10px]" 
                                onClick={() => handlePrint(false)}
                                disabled={!deployForm.object_id}
                            >
                                <span className="material-icons-round text-sm mr-1">print</span> Без S/N
                            </Button>
                            <Button 
                                type="button" 
                                variant="secondary" 
                                className="flex-1 text-[10px]" 
                                onClick={() => handlePrint(true)}
                                disabled={!deployForm.object_id}
                            >
                                <span className="material-icons-round text-sm mr-1">receipt_long</span> С S/N
                            </Button>
                        </div>
                    </div>
                )}

                <Button type="submit" className="w-full h-12" loading={loading}>{isBulkDeploy ? 'Отгрузить всё' : 'Отгрузить'}</Button>
             </form>
        )}

        {mode === 'return_item' && selectedItem && (
            <form onSubmit={handleReturnItem} className="space-y-4">
                <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                    <p className="text-xs text-orange-600 font-bold uppercase mb-1">Возврат на склад</p>
                    <p className="font-bold text-slate-900">{selectedItem.catalog?.name}</p>
                    <p className="text-xs text-slate-500">
                        Объект: {objects.find(o => o.id === selectedItem.current_object_id)?.name}
                    </p>
                    {selectedItem.serial_number && (
                        <p className="text-xs font-mono mt-1 bg-white inline-block px-2 py-0.5 rounded border border-orange-200 text-orange-800">
                            S/N: {selectedItem.serial_number}
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Input 
                        label={`Кол-во к возврату (макс: ${selectedItem.quantity})`}
                        type="number"
                        step="0.01"
                        required
                        value={deployForm.quantity_to_deploy}
                        onChange={(e:any) => setDeployForm({...deployForm, quantity_to_deploy: e.target.value})}
                    />
                    <Select 
                        label="Причина возврата" 
                        required 
                        value={deployForm.return_reason} 
                        onChange={(e:any) => setDeployForm({...deployForm, return_reason: e.target.value})}
                        options={[
                            { value: 'surplus', label: 'Излишек (не пригодилось)' },
                            { value: 'cancellation', label: 'Отказ клиента' },
                            { value: 'wrong_item', label: 'Ошибочная отгрузка' },
                            { value: 'repair', label: 'Демонтаж для ремонта' }
                        ]}
                    />
                </div>
                
                <div className="p-3 border-2 border-dashed border-slate-200 rounded-xl text-center">
                    <span className="material-icons-round text-slate-300 text-xl">add_a_photo</span>
                    <p className="text-[10px] text-slate-400">Прикрепить фото (скоро)</p>
                </div>

                <div className="flex gap-3 pt-2">
                    <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Отмена</Button>
                    <Button type="submit" className="flex-1" loading={loading}>Подтвердить возврат</Button>
                </div>
            </form>
        )}

        {mode === 'replace_item' && selectedItem && (
             <form onSubmit={handleReplaceItem} className="space-y-4">
                {/* БЛОК 1: ЧТО ЗАМЕНЯЕМ (ДЕМОНТАЖ) */}
                <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                    <p className="text-[10px] text-red-500 mb-1 font-bold uppercase tracking-wider">Демонтаж / Списание</p>
                    <p className="font-bold text-slate-900">{selectedItem.catalog?.name}</p>
                    <p className="text-[10px] font-mono text-red-700 mb-3">S/N: {selectedItem.serial_number || 'N/A'}</p>
                    
                    <div className="flex items-end gap-3">
                        <div className="flex-1">
                            <Input 
                                label="Кол-во к списанию" 
                                type="number"
                                step="0.01"
                                max={selectedItem.quantity}
                                value={replaceForm.old_quantity} 
                                onChange={(e:any) => setReplaceForm({...replaceForm, old_quantity: e.target.value})}
                            />
                        </div>
                        <div className="mb-2">
                            <span className="text-xs text-slate-400 font-bold uppercase">{selectedItem.catalog?.unit}</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-center -my-2 relative z-10">
                    <div className="bg-white rounded-full p-1 border border-slate-200 shadow-sm">
                        <span className="material-icons-round text-slate-400 block">expand_more</span>
                    </div>
                </div>

                {/* БЛОК 2: НА ЧТО МЕНЯЕМ (МОНТАЖ) */}
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <p className="text-[10px] text-blue-500 mb-3 font-bold uppercase tracking-wider">Установка аналога/замены</p>
                    
                    <Select 
                        label="Выберите товар со склада" 
                        required 
                        value={replaceForm.new_item_id} 
                        onChange={(e:any) => {
                            const newItem = items.find(i => i.id === e.target.value);
                            setReplaceForm({
                                ...replaceForm, 
                                new_item_id: e.target.value,
                                new_quantity: '1' 
                            });
                        }}
                        options={[
                            {value: '', label: 'Поиск товара...'}, 
                            ...items.filter(i => i.status === 'in_stock').map(i => ({
                                value: i.id, 
                                label: `${i.catalog?.name} | S/N: ${i.serial_number || 'нет'} | Остаток: ${i.quantity}`
                            }))
                        ]}
                    />

                    {replaceForm.new_item_id && (
                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <Input 
                                label="Кол-во к установке" 
                                type="number"
                                step="0.01"
                                value={replaceForm.new_quantity}
                                onChange={(e:any) => setReplaceForm({...replaceForm, new_quantity: e.target.value})}
                            />
                            <div className="flex items-end mb-2">
                                <span className="text-[10px] text-blue-600 font-bold">
                                    {items.find(i => i.id === replaceForm.new_item_id)?.catalog?.unit}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* БЛОК 3: ПРИЧИНА */}
                <div className="space-y-3">
                    <Select 
                        label="Причина замены" 
                        required 
                        value={replaceForm.reason} 
                        onChange={(e:any) => setReplaceForm({...replaceForm, reason: e.target.value})}
                        options={[
                            { value: 'defect', label: 'Заводской брак (Гарантия)' },
                            { value: 'damage', label: 'Повреждение при монтаже' },
                            { value: 'upgrade', label: 'Модернизация (Апгрейд)' },
                            { value: 'error', label: 'Ошибка подбора оборудования' }
                        ]}
                    />
                    <Input 
                        placeholder="Дополнительный комментарий (необязательно)..."
                        value={replaceForm.comment}
                        onChange={(e:any) => setReplaceForm({...replaceForm, comment: e.target.value})}
                    />
                </div>

                <Button 
                    type="submit" 
                    className="w-full h-12 mt-4" 
                    loading={loading} 
                    disabled={!replaceForm.new_item_id}
                >
                    Выполнить замену
                </Button>
             </form>
        )}
    </Modal>
  );
};

export default InventoryModal;
