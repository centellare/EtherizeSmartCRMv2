
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { Input, Select, Button } from '../../../ui';
import { InventoryItem } from '../../../../types';

interface ReplaceFormProps {
  selectedItem: InventoryItem | null;
  items: InventoryItem[]; // Stock items
  profile: any;
  onSuccess: () => void;
}

export const ReplaceForm: React.FC<ReplaceFormProps> = ({ selectedItem, items, profile, onSuccess }) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ 
      new_item_id: '', 
      old_quantity: selectedItem ? selectedItem.quantity.toString() : '1', 
      new_quantity: '1',
      reason: 'defect',
      comment: ''
  });

  if (!selectedItem) return null;

  const mutation = useMutation({
    mutationFn: async () => {
        const qtyOld = parseFloat(formData.old_quantity);
        const qtyNew = parseFloat(formData.new_quantity);
        const now = new Date();

        const stockItem = items.find(i => i.id === formData.new_item_id);
        if (!stockItem || stockItem.quantity < qtyNew) {
            throw new Error('Недостаточно выбранного товара на складе!');
        }

        // 1. Process OLD item (Scrap/Dismantle)
        if (qtyOld < selectedItem.quantity) {
            // Partial scrap
            await supabase.from('inventory_items').update({ quantity: selectedItem.quantity - qtyOld }).eq('id', selectedItem.id);
            // Create record for history tracking
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
                comment: `Частичное списание (${qtyOld} ед). Причина: ${formData.reason}. ${formData.comment}`
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
                comment: `Демонтаж. Причина: ${formData.reason}. ${formData.comment}`
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_items'] });
      onSuccess();
    },
    onError: (error: any) => {
      console.error(error);
      alert('Ошибка при замене: ' + error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.new_item_id) return;
    
    const qtyOld = parseFloat(formData.old_quantity);
    const qtyNew = parseFloat(formData.new_quantity);
    
    if (isNaN(qtyOld) || qtyOld <= 0 || qtyOld > selectedItem.quantity) { alert('Некорректное кол-во к списанию'); return; }
    if (isNaN(qtyNew) || qtyNew <= 0) { alert('Некорректное кол-во к установке'); return; }

    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
                        value={formData.old_quantity} 
                        onChange={(e: any) => setFormData({...formData, old_quantity: e.target.value})}
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
                value={formData.new_item_id} 
                onChange={(e: any) => {
                    setFormData({
                        ...formData, 
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

            {formData.new_item_id && (
                <div className="grid grid-cols-2 gap-3 mt-4">
                    <Input 
                        label="Кол-во к установке" 
                        type="number"
                        step="0.01"
                        value={formData.new_quantity}
                        onChange={(e: any) => setFormData({...formData, new_quantity: e.target.value})}
                    />
                    <div className="flex items-end mb-2">
                        <span className="text-[10px] text-blue-600 font-bold">
                            {items.find(i => i.id === formData.new_item_id)?.catalog?.unit}
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
                value={formData.reason} 
                onChange={(e: any) => setFormData({...formData, reason: e.target.value})}
                options={[
                    { value: 'defect', label: 'Заводской брак (Гарантия)' },
                    { value: 'damage', label: 'Повреждение при монтаже' },
                    { value: 'upgrade', label: 'Модернизация (Апгрейд)' },
                    { value: 'error', label: 'Ошибка подбора оборудования' }
                ]}
            />
            <Input 
                placeholder="Дополнительный комментарий (необязательно)..."
                value={formData.comment}
                onChange={(e: any) => setFormData({...formData, comment: e.target.value})}
            />
        </div>

        <Button 
            type="submit" 
            className="w-full h-12 mt-4" 
            loading={mutation.isPending} 
            disabled={!formData.new_item_id}
        >
            Выполнить замену
        </Button>
    </form>
  );
};
