
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Input, Select, Button } from '../../../ui';
import { InventoryCatalogItem, InventoryItem } from '../../../../types';

interface ItemFormProps {
  mode: 'add_item' | 'edit_item';
  selectedItem: InventoryItem | null;
  catalog: InventoryCatalogItem[];
  profile: any;
  onSuccess: (keepOpen?: boolean) => void;
}

export const ItemForm: React.FC<ItemFormProps> = ({ mode, selectedItem, catalog, profile, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [skipSerial, setSkipSerial] = useState(false);
  const [formData, setFormData] = useState({ catalog_id: '', serial_number: '', quantity: '1', purchase_price: '' });

  useEffect(() => {
    if (mode === 'edit_item' && selectedItem) {
      setFormData({
        catalog_id: selectedItem.catalog_id,
        serial_number: selectedItem.serial_number || '',
        quantity: selectedItem.quantity?.toString() || '1',
        purchase_price: selectedItem.purchase_price?.toString() || ''
      });
    } else {
      setFormData({ catalog_id: '', serial_number: '', quantity: '1', purchase_price: '' });
      setSkipSerial(false);
    }
  }, [mode, selectedItem]);

  const selectedCatalogItem = useMemo(() => 
    catalog.find(c => c.id === formData.catalog_id), 
  [formData.catalog_id, catalog]);

  const isSerialRequired = selectedCatalogItem?.has_serial && !skipSerial;

  // Force quantity to 1 if serial required
  useEffect(() => {
    if (mode === 'add_item' && isSerialRequired) {
      setFormData(prev => ({ ...prev, quantity: '1' }));
    }
  }, [isSerialRequired, mode]);

  // Update price default
  useEffect(() => {
    if (mode === 'add_item' && selectedCatalogItem?.last_purchase_price) {
      setFormData(prev => ({ ...prev, purchase_price: selectedCatalogItem.last_purchase_price!.toString() }));
    }
  }, [selectedCatalogItem, mode]);

  const handleSubmit = async (e: React.FormEvent, keepOpen = false) => {
    e.preventDefault();
    if (!formData.catalog_id) return;

    const qty = parseFloat(formData.quantity);
    if (isNaN(qty) || qty <= 0) {
        alert('Укажите корректное количество');
        return;
    }

    if (isSerialRequired) {
        if (!formData.serial_number.trim()) {
            alert('Необходимо ввести серийный номер');
            return;
        }
        if (qty !== 1) {
            alert('Для товаров с S/N количество должно быть равно 1');
            return;
        }
    }

    setLoading(true);
    const finalSerial = skipSerial ? '[БЕЗ S/N]' : (formData.serial_number.trim() || null);

    try {
      if (mode === 'edit_item' && selectedItem) {
        const { error } = await supabase.from('inventory_items').update({
            serial_number: formData.serial_number || null,
            quantity: qty,
            purchase_price: parseFloat(formData.purchase_price) || 0
        }).eq('id', selectedItem.id);
        if (error) throw error;
        onSuccess();
      } else {
        const payload = {
            catalog_id: formData.catalog_id,
            serial_number: finalSerial,
            quantity: qty,
            purchase_price: parseFloat(formData.purchase_price) || 0,
            status: 'in_stock',
            assigned_to_id: profile.id
        };
        const { data, error } = await supabase.from('inventory_items').insert([payload]).select('id').single();
        if (error) throw error;
        
        if (data) {
            await supabase.from('inventory_history').insert([{
                item_id: data.id,
                action_type: 'receive',
                created_by: profile.id,
                comment: `Приемка. Кол-во: ${qty}`
            }]);
        }
        
        if (keepOpen) {
            setFormData(prev => ({ ...prev, serial_number: '' }));
            alert('Товар добавлен. Можно добавить следующий.');
            onSuccess(true); // Signal refresh but keep modal
        } else {
            onSuccess();
        }
      }
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
        {mode === 'add_item' ? (
            <Select 
                label="Тип оборудования" 
                required 
                value={formData.catalog_id} 
                onChange={(e: any) => setFormData({...formData, catalog_id: e.target.value})}
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
                value={formData.quantity} 
                onChange={(e: any) => setFormData({...formData, quantity: e.target.value})}
                className={isSerialRequired && mode === 'add_item' ? 'bg-slate-100 text-slate-500' : ''} 
            />
            <Input 
                label="Цена закупки (за ед.)"
                type="number"
                step="0.01"
                required
                value={formData.purchase_price}
                onChange={(e: any) => setFormData({...formData, purchase_price: e.target.value})}
            />
        </div>
        
        <div className="mb-2">
            <Input 
                label="Серийный номер" 
                value={formData.serial_number} 
                onChange={(e: any) => setFormData({...formData, serial_number: e.target.value})} 
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
                        onClick={(e) => handleSubmit(e, true)}
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
  );
};
