
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { Input, Select, Button } from '../../../ui';
import { InventoryItem } from '../../../../types';

interface ReturnFormProps {
  selectedItem: InventoryItem | null;
  objects: any[];
  profile: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export const ReturnForm: React.FC<ReturnFormProps> = ({ selectedItem, objects, profile, onSuccess, onCancel }) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ 
      quantity_to_return: selectedItem ? selectedItem.quantity.toString() : '1',
      return_reason: 'surplus'
  });

  if (!selectedItem) return null;

  const mutation = useMutation({
    mutationFn: async () => {
        const qtyToReturn = parseFloat(formData.quantity_to_return); 
        const reasonText = {
            surplus: 'Излишек (не пригодилось)',
            cancellation: 'Отказ клиента',
            wrong_item: 'Ошибочная отгрузка',
            repair: 'Демонтаж для ремонта'
        }[formData.return_reason] || 'Возврат';

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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_items'] });
      onSuccess();
    },
    onError: (error: any) => {
      console.error(error);
      alert("Ошибка при возврате товара");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qtyToReturn = parseFloat(formData.quantity_to_return); 
    if (isNaN(qtyToReturn) || qtyToReturn <= 0) {
        alert("Укажите корректное количество для возврата");
        return;
    }
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
                value={formData.quantity_to_return}
                onChange={(e: any) => setFormData({...formData, quantity_to_return: e.target.value})}
            />
            <Select 
                label="Причина возврата" 
                required 
                value={formData.return_reason} 
                onChange={(e: any) => setFormData({...formData, return_reason: e.target.value})}
                options={[
                    { value: 'surplus', label: 'Излишек (не пригодилось)' },
                    { value: 'cancellation', label: 'Отказ клиента' },
                    { value: 'wrong_item', label: 'Ошибочная отгрузка' },
                    { value: 'repair', label: 'Демонтаж для ремонта' }
                ]}
            />
        </div>
        
        <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">Отмена</Button>
            <Button type="submit" className="flex-1" loading={mutation.isPending}>Подтвердить возврат</Button>
        </div>
    </form>
  );
};
