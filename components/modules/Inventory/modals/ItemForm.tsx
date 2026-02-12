
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Input, Select, Button, ConfirmModal } from '../../../ui';
import { Product, InventoryItem } from '../../../../types';

interface ItemFormProps {
  mode: 'add_item' | 'edit_item' | 'receive_supply';
  selectedItem: any | null; // Can be InventoryItem OR SupplyOrderItem
  products?: Product[];
  profile: any;
  onSuccess: (keepOpen?: boolean) => void;
}

export const ItemForm: React.FC<ItemFormProps> = ({ mode, selectedItem, products = [], profile, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ product_id: '', serial_number: '', quantity: '1', purchase_price: '' });
  const [splitBulk, setSplitBulk] = useState(false); // New: Split into individual items
  
  // Warning State for ConfirmModal
  const [warningOpen, setWarningOpen] = useState(false);
  const [pendingKeepOpen, setPendingKeepOpen] = useState(false);

  useEffect(() => {
    if (mode === 'edit_item' && selectedItem) {
      setFormData({
        product_id: selectedItem.product_id,
        serial_number: selectedItem.serial_number || '',
        quantity: selectedItem.quantity?.toString() || '1',
        purchase_price: selectedItem.purchase_price?.toString() || ''
      });
    } else if (mode === 'receive_supply' && selectedItem) {
        // Pre-fill from Supply Order Item
        setFormData({
            product_id: selectedItem.product_id,
            serial_number: '',
            quantity: selectedItem.quantity_needed?.toString() || '1',
            purchase_price: selectedItem.product?.base_price?.toString() || ''
        });
    } else {
      setFormData({ product_id: '', serial_number: '', quantity: '1', purchase_price: '' });
    }
  }, [mode, selectedItem]);

  const selectedProduct = useMemo(() => products.find(p => p.id === formData.product_id), [formData.product_id, products]);

  // Auto-fill price only for clean add
  useEffect(() => {
    if (mode === 'add_item' && selectedProduct?.base_price && !formData.purchase_price) {
      setFormData(prev => ({ ...prev, purchase_price: selectedProduct.base_price.toString() }));
    }
  }, [selectedProduct, mode]);

  const handleSerialChange = (val: string) => {
      setFormData(prev => {
          const isSerialEntered = val.trim().length > 0;
          return {
            ...prev, 
            serial_number: val,
            quantity: isSerialEntered ? '1' : prev.quantity
          };
      });
  };

  const handleFormSubmit = (e: React.FormEvent, keepOpen = false) => {
    e.preventDefault();
    
    const qty = parseFloat(formData.quantity);
    if (isNaN(qty) || qty <= 0) {
        alert("Введите корректное количество");
        return;
    }

    const hasSerialEntered = formData.serial_number.trim().length > 0;
    const requiresSerial = selectedProduct?.has_serial;

    if (hasSerialEntered && qty !== 1) {
        alert("Ошибка: При вводе конкретного серийного номера количество должно быть равно 1.");
        return;
    }

    // New validation for bulk split
    if (splitBulk && (qty <= 1 || qty > 100)) { // Safety limit 100
        alert("Для разбиения партии количество должно быть больше 1 и не более 100.");
        return;
    }

    if (requiresSerial && !hasSerialEntered && !splitBulk) {
        setPendingKeepOpen(keepOpen);
        setWarningOpen(true);
        return; 
    }

    executeSave(keepOpen);
  };

  const executeSave = async (keepOpen: boolean) => {
    setLoading(true);
    setWarningOpen(false); 
    
    const qty = parseFloat(formData.quantity);
    
    try {
      if (mode === 'edit_item' && selectedItem) {
        // Update existing stock item
        const { error } = await supabase.from('inventory_items').update({
            serial_number: formData.serial_number || null,
            quantity: qty,
            purchase_price: parseFloat(formData.purchase_price) || 0
        }).eq('id', selectedItem.id);
        
        if (error) throw error;
        onSuccess();

      } else {
        // Create new stock item(s)
        const commonData = {
            product_id: formData.product_id,
            purchase_price: parseFloat(formData.purchase_price) || 0,
            status: 'in_stock',
            assigned_to_id: profile.id
        };

        if (splitBulk && qty > 1) {
            // Create multiple items with quantity 1
            const itemsToInsert = Array.from({ length: Math.floor(qty) }).map(() => ({
                ...commonData,
                quantity: 1,
                serial_number: null // Will be entered later
            }));
            
            const { data, error } = await supabase.from('inventory_items').insert(itemsToInsert).select('id');
            if (error) throw error;

            // Log history for bulk
            if (data) {
                const historyLog = data.map(item => ({
                    item_id: item.id,
                    action_type: 'receive',
                    created_by: profile.id,
                    comment: `Массовая приемка (разбиение). Партия ${qty} шт.`
                }));
                await supabase.from('inventory_history').insert(historyLog);
            }

        } else {
            // Standard single item (bulk qty or 1 with SN)
            const { data, error } = await supabase.from('inventory_items').insert([{
                ...commonData,
                quantity: qty,
                serial_number: formData.serial_number || null
            }]).select('id').single();
            
            if (error) throw error;

            if (data) {
                const comment = mode === 'receive_supply' 
                    ? `Приемка по заказу (дефицит). Кол-во: ${qty}` 
                    : `Приемка на склад. Кол-во: ${qty}`;

                await supabase.from('inventory_history').insert([{
                    item_id: data.id,
                    action_type: 'receive',
                    created_by: profile.id,
                    comment: comment
                }]);
            }
        }

        // --- PARTIAL SUPPLY ORDER LOGIC ---
        if (mode === 'receive_supply' && selectedItem?.id) {
            const needed = selectedItem.quantity_needed;
            
            if (qty < needed) {
                // Partial reception: Create a new pending item for the remainder
                const remainder = needed - qty;
                
                // 1. Update current item to received (with received qty)
                await supabase.from('supply_order_items')
                    .update({ 
                        status: 'received', 
                        quantity_ordered: qty, // Store what was actually received here if schema supported it, but we reuse needed or just mark done
                        // Better: Update needed to what was received to close it out properly
                        quantity_needed: qty 
                    })
                    .eq('id', selectedItem.id);

                // 2. Create new item for remainder
                await supabase.from('supply_order_items').insert({
                    supply_order_id: selectedItem.supply_order_id,
                    product_id: selectedItem.product_id,
                    quantity_needed: remainder,
                    status: 'pending'
                });

            } else {
                // Full reception
                await supabase.from('supply_order_items')
                    .update({ status: 'received' })
                    .eq('id', selectedItem.id);
            }
        }
        
        if (keepOpen && mode === 'add_item') {
            setFormData(prev => ({ ...prev, serial_number: '', quantity: '1' }));
            onSuccess(true);
        } else {
            onSuccess(false);
        }
      }
    } catch (error: any) {
      alert('Ошибка при сохранении: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
        <form onSubmit={(e) => handleFormSubmit(e, false)} className="space-y-4">
            {mode === 'add_item' ? (
                <Select 
                    label="Выберите товар из номенклатуры" 
                    required 
                    value={formData.product_id} 
                    onChange={(e: any) => setFormData({...formData, product_id: e.target.value})}
                    options={[{value: '', label: 'Поиск товара...'}, ...products.map(p => ({value: p.id, label: p.name}))]}
                />
            ) : (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <p className="text-xs text-blue-500 font-bold uppercase">{mode === 'receive_supply' ? 'Приемка заказа' : 'Редактирование'}</p>
                    <p className="font-bold text-blue-900 text-lg">{selectedProduct?.name || selectedItem?.product?.name}</p>
                    {mode === 'receive_supply' && (
                        <p className="text-xs text-slate-500 mt-1">Ожидалось: {selectedItem?.quantity_needed} шт.</p>
                    )}
                </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                    <Input 
                        label="Количество (факт)" 
                        type="number" 
                        step="0.01" 
                        required 
                        value={formData.quantity} 
                        onChange={(e: any) => setFormData({...formData, quantity: e.target.value})} 
                        disabled={!!formData.serial_number} 
                    />
                    {!!formData.serial_number && (
                        <span className="absolute right-0 top-0 text-[9px] text-orange-500 font-bold bg-white px-1 border border-orange-200 rounded">1 шт (S/N)</span>
                    )}
                </div>
                <Input label="Цена закупки (факт)" type="number" step="0.01" required value={formData.purchase_price} onChange={(e: any) => setFormData({...formData, purchase_price: e.target.value})} />
            </div>

            {mode !== 'edit_item' && parseFloat(formData.quantity) > 1 && (
                <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer">
                    <input type="checkbox" checked={splitBulk} onChange={(e) => setSplitBulk(e.target.checked)} className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" />
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800">Разбить на отдельные записи</span>
                        <span className="text-[10px] text-slate-500">Удобно для последующего ввода S/N для каждой единицы</span>
                    </div>
                </label>
            )}
            
            <Input 
                label={selectedProduct?.has_serial ? "Серийный номер (Требуется)" : "Серийный номер (S/N)"}
                value={formData.serial_number} 
                onChange={(e: any) => handleSerialChange(e.target.value)} 
                placeholder={selectedProduct?.has_serial ? "Введите S/N" : "Не обязательно"}
                disabled={splitBulk}
                className={selectedProduct?.has_serial && !formData.serial_number && !splitBulk ? "border-amber-400 bg-amber-50/30" : ""}
            />

            <div className="pt-2 flex gap-3">
                {mode === 'add_item' ? (
                    <>
                        <Button type="button" variant="secondary" className="flex-1" loading={loading} onClick={(e) => handleFormSubmit(e, true)}>Сохранить и еще</Button>
                        <Button type="submit" className="flex-1" loading={loading}>Сохранить и закрыть</Button>
                    </>
                ) : (
                    <Button type="submit" className="w-full h-12" loading={loading}>{mode === 'receive_supply' ? 'Принять на склад' : 'Сохранить изменения'}</Button>
                )}
            </div>
        </form>

        <ConfirmModal 
            isOpen={warningOpen}
            onClose={() => setWarningOpen(false)}
            onConfirm={() => executeSave(pendingKeepOpen)}
            title="Отсутствует серийный номер"
            message={`В номенклатуре для "${selectedProduct?.name}" указано требование серийного номера.\n\nВы уверены, что хотите принять партию (${formData.quantity} шт.) без ввода S/N? Вам придется внести их вручную при отгрузке.`}
            confirmLabel="Да, принять без S/N"
            cancelLabel="Отмена"
            confirmVariant="danger"
        />
    </>
  );
};
