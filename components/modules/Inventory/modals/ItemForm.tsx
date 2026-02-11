
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

    if (requiresSerial && !hasSerialEntered) {
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
        // Create new stock item (add_item OR receive_supply)
        const { data, error } = await supabase.from('inventory_items').insert([{
            product_id: formData.product_id,
            serial_number: formData.serial_number || null,
            quantity: qty,
            purchase_price: parseFloat(formData.purchase_price) || 0,
            status: 'in_stock',
            assigned_to_id: profile.id
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

            // If coming from Supply Orders, close the order item
            if (mode === 'receive_supply' && selectedItem?.id) {
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
            
            <Input 
                label={selectedProduct?.has_serial ? "Серийный номер (Требуется по регламенту)" : "Серийный номер (S/N)"}
                value={formData.serial_number} 
                onChange={(e: any) => handleSerialChange(e.target.value)} 
                placeholder={selectedProduct?.has_serial ? "Введите S/N" : "Не обязательно"}
                className={selectedProduct?.has_serial && !formData.serial_number ? "border-amber-400 bg-amber-50/30" : ""}
            />

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
