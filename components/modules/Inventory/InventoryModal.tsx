
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Modal, Input, Select, Button } from '../../ui';
import { InventoryCatalogItem, InventoryItem } from '../../../types';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create_catalog' | 'add_item' | 'deploy_item' | 'replace_item' | 'edit_catalog' | 'edit_item';
  catalog: InventoryCatalogItem[];
  objects: any[];
  items: InventoryItem[]; // All items for replacement logic
  selectedItem: any | null; // Can be InventoryItem or CatalogItem depending on mode
  profile: any;
  onSuccess: () => void;
}

const InventoryModal: React.FC<InventoryModalProps> = ({ 
  isOpen, onClose, mode, catalog, objects, items, selectedItem, profile, onSuccess 
}) => {
  const [loading, setLoading] = useState(false);
  const isAdmin = profile?.role === 'admin';
  
  // Create/Edit Catalog State
  const [catForm, setCatForm] = useState({ 
    name: '', sku: '', unit: 'шт', last_purchase_price: '', 
    description: '', warranty_period_months: '12', has_serial: false,
    item_type: 'product' as 'product' | 'material'
  });

  // Add/Edit Item State
  const [itemForm, setItemForm] = useState({ catalog_id: '', serial_number: '', quantity: '1', purchase_price: '' });

  // Deploy/Replace State
  const [deployForm, setDeployForm] = useState({ object_id: '', serial_number: '', quantity_to_deploy: '1' });
  const [replaceForm, setReplaceForm] = useState({ new_item_id: '' });

  // Reset/Init forms
  useEffect(() => {
    if (isOpen) {
       // Defaults
       setDeployForm({ 
         object_id: '', 
         serial_number: '', 
         quantity_to_deploy: selectedItem && selectedItem.quantity ? selectedItem.quantity.toString() : '1' 
       });
       setReplaceForm({ new_item_id: '' });
       setItemForm({ catalog_id: '', serial_number: '', quantity: '1', purchase_price: '' });
       setCatForm({ 
         name: '', sku: '', unit: 'шт', last_purchase_price: '', 
         description: '', warranty_period_months: '12', has_serial: false,
         item_type: 'product'
       });

       // Fill for edits
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
  }, [isOpen, selectedItem, mode]);

  // Update purchase price when catalog item is selected (only in add mode)
  useEffect(() => {
    if (mode === 'add_item' && itemForm.catalog_id) {
        const catItem = catalog.find(c => c.id === itemForm.catalog_id);
        if (catItem && catItem.last_purchase_price !== undefined) {
            setItemForm(prev => ({ ...prev, purchase_price: catItem.last_purchase_price!.toString() }));
        }
    }
  }, [itemForm.catalog_id, catalog, mode]);

  const handleCreateCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('inventory_catalog').insert([{
       ...catForm, 
       warranty_period_months: parseInt(catForm.warranty_period_months),
       last_purchase_price: parseFloat(catForm.last_purchase_price) || 0
    }]);
    setLoading(false);
    if (!error) onSuccess();
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

  const handleDeleteCatalog = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedItem || !window.confirm('Вы уверены, что хотите удалить этот тип оборудования? Все связанные товары на складе также будут удалены (скрыты).')) return;
    
    console.log('Начало удаления (Soft Delete)', selectedItem.id);
    setLoading(true);
    
    try {
        // 1. Cascade Soft Delete: Mark all items of this catalog as deleted
        await supabase.from('inventory_items')
          .update({ is_deleted: true })
          .eq('catalog_id', selectedItem.id);

        // 2. Soft Delete the catalog item itself
        const { error } = await supabase.from('inventory_catalog')
          .update({ is_deleted: true })
          .eq('id', selectedItem.id);
          
        if (error) throw error;
        
        onSuccess();
    } catch (e: any) {
        console.error('Error deleting catalog:', e);
        alert('Ошибка при удалении: ' + e.message);
    } finally {
        setLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.catalog_id) return;
    setLoading(true);
    
    const payload = {
        catalog_id: itemForm.catalog_id,
        serial_number: itemForm.serial_number || null,
        quantity: parseFloat(itemForm.quantity) || 1,
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
        onSuccess();
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

  const handleDeleteItem = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedItem || !window.confirm('Вы уверены? Единица товара будет перемещена в корзину.')) return;
    
    console.log('Начало удаления товара (Soft Delete)', selectedItem.id);
    setLoading(true);
    
    try {
        // Soft delete the item
        const { error: itemError } = await supabase.from('inventory_items')
          .update({ is_deleted: true })
          .eq('id', selectedItem.id);
          
        if (itemError) throw itemError;

        onSuccess();
    } catch (e: any) {
        console.error('Error deleting item:', e);
        alert('Ошибка при удалении: ' + e.message);
    } finally {
        setLoading(false);
    }
  };

  const handleDeployItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !deployForm.object_id) return;
    
    const qtyToDeploy = parseFloat(deployForm.quantity_to_deploy);
    if (isNaN(qtyToDeploy) || qtyToDeploy <= 0) {
        alert("Укажите корректное количество для отгрузки");
        return;
    }
    if (qtyToDeploy > selectedItem.quantity) {
        alert("Нельзя отгрузить больше, чем есть на складе");
        return;
    }

    setLoading(true);

    const now = new Date();
    const warrantyMonths = selectedItem.catalog?.warranty_period_months || 0;
    const warrantyEnd = new Date(now);
    warrantyEnd.setMonth(warrantyEnd.getMonth() + warrantyMonths);

    // Common fields for the deployed item
    const deployedStatus = {
        status: 'deployed',
        current_object_id: deployForm.object_id,
        warranty_start: now.toISOString(),
        warranty_end: warrantyEnd.toISOString(),
        serial_number: deployForm.serial_number || selectedItem.serial_number
    };

    let deployedItemId = selectedItem.id;

    // SPLIT LOGIC
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

        if (createError || !newItem) {
            alert('Ошибка при разделении позиции');
            setLoading(false);
            return;
        }
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

  const handleReplaceItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !replaceForm.new_item_id) return;
    setLoading(true);

    const newItem = items.find(i => i.id === replaceForm.new_item_id);
    if (!newItem) return;

    await supabase.from('inventory_items').update({
        status: 'scrapped',
        current_object_id: null
    }).eq('id', selectedItem.id);

    const now = new Date();
    const warrantyMonths = newItem.catalog?.warranty_period_months || 0;
    const warrantyEnd = new Date(now);
    warrantyEnd.setMonth(warrantyEnd.getMonth() + warrantyMonths);

    await supabase.from('inventory_items').update({
        status: 'deployed',
        current_object_id: selectedItem.current_object_id,
        warranty_start: now.toISOString(),
        warranty_end: warrantyEnd.toISOString()
    }).eq('id', newItem.id);

    await supabase.from('inventory_history').insert([
        {
            item_id: selectedItem.id,
            action_type: 'scrap',
            from_object_id: selectedItem.current_object_id,
            comment: `Заменен на ${newItem.serial_number || 'новый'}`,
            created_by: profile.id
        },
        {
            item_id: newItem.id,
            action_type: 'replace',
            to_object_id: selectedItem.current_object_id,
            comment: `Замена для ${selectedItem.serial_number || 'старого'}`,
            created_by: profile.id
        }
    ]);
    
    onSuccess();
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
          case 'deploy_item': return 'Отгрузка на объект';
          case 'replace_item': return 'Гарантийная замена';
      }
  };

  const units = [
      { value: 'шт', label: 'Штуки (шт)' },
      { value: 'м', label: 'Метры (м)' },
      { value: 'упак', label: 'Упаковки (упак)' },
      { value: 'компл', label: 'Комплекты (компл)' }
  ];

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
                
                <div className="flex gap-3 pt-2">
                    {mode === 'edit_catalog' && isAdmin && (
                        <Button type="button" variant="danger" className="w-full h-12" loading={loading} onClick={handleDeleteCatalog}>Удалить</Button>
                    )}
                    <Button type="submit" className="w-full h-12" loading={loading}>{mode === 'edit_catalog' ? 'Сохранить изменения' : 'Создать'}</Button>
                </div>
            </form>
        )}

        {(mode === 'add_item' || mode === 'edit_item') && (
            <form onSubmit={mode === 'add_item' ? handleAddItem : handleUpdateItem} className="space-y-4">
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
                        value={itemForm.quantity} 
                        onChange={(e:any) => setItemForm({...itemForm, quantity: e.target.value})} 
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
                <Input 
                    label="Серийный номер" 
                    value={itemForm.serial_number} 
                    onChange={(e:any) => setItemForm({...itemForm, serial_number: e.target.value})} 
                    placeholder="Необязательно"
                />
                
                <div className="flex gap-3 pt-2">
                    {mode === 'edit_item' && isAdmin && (
                        <Button type="button" variant="danger" className="w-full h-12" loading={loading} onClick={handleDeleteItem}>Удалить</Button>
                    )}
                    <Button type="submit" className="w-full h-12" loading={loading}>{mode === 'edit_item' ? 'Сохранить изменения' : 'Принять'}</Button>
                </div>
            </form>
        )}

        {mode === 'deploy_item' && selectedItem && (
             <form onSubmit={handleDeployItem} className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs text-slate-500 mb-1">Отгружаемый товар</p>
                            <p className="font-bold text-slate-900">{selectedItem.catalog?.name}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-500 mb-1">Доступно</p>
                            <p className="font-bold text-slate-900">{selectedItem.quantity} {selectedItem.catalog?.unit}</p>
                        </div>
                    </div>
                    {selectedItem.serial_number ? (
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

                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                    <Input 
                        label={`Количество к отгрузке (макс: ${selectedItem.quantity})`}
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

                <Select 
                    label="Объект назначения" 
                    required 
                    value={deployForm.object_id} 
                    onChange={(e:any) => setDeployForm({...deployForm, object_id: e.target.value})}
                    options={[{value: '', label: 'Выберите объект'}, ...objects.map(o => ({value: o.id, label: o.name}))]}
                    icon="home_work"
                />
                <Button type="submit" className="w-full h-12" loading={loading}>Отгрузить</Button>
             </form>
        )}

        {mode === 'replace_item' && selectedItem && (
             <form onSubmit={handleReplaceItem} className="space-y-4">
                <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                    <p className="text-xs text-red-500 mb-1 font-bold uppercase">Списываемый товар</p>
                    <p className="font-bold text-red-900">{selectedItem.catalog?.name}</p>
                    <p className="text-xs font-mono text-red-700">S/N: {selectedItem.serial_number || 'N/A'}</p>
                    <p className="text-xs mt-2">Будет установлен статус: <b>Scrapped</b></p>
                </div>
                
                <div className="flex justify-center"><span className="material-icons-round text-slate-300">arrow_downward</span></div>

                <Select 
                    label="На что меняем (со склада)" 
                    required 
                    value={replaceForm.new_item_id} 
                    onChange={(e:any) => setReplaceForm({...replaceForm, new_item_id: e.target.value})}
                    options={[
                        {value: '', label: 'Выберите товар на замену'}, 
                        ...compatibleItems.map(i => ({value: i.id, label: `${i.catalog?.name} (${i.quantity} ${i.catalog?.unit})`}))
                    ]}
                />
                {compatibleItems.length === 0 && (
                    <p className="text-xs text-red-500 font-bold">На складе нет товаров такого же типа!</p>
                )}

                <Button type="submit" className="w-full h-12" loading={loading} disabled={compatibleItems.length === 0}>Выполнить замену</Button>
             </form>
        )}
    </Modal>
  );
};

export default InventoryModal;
