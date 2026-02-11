
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Input, Select, Button } from '../../../ui';
import { InventoryCatalogItem } from '../../../../types';

interface CatalogFormProps {
  mode: 'create_catalog' | 'edit_catalog';
  selectedItem: InventoryCatalogItem | null;
  onSuccess: () => void;
}

export const CatalogForm: React.FC<CatalogFormProps> = ({ mode, selectedItem, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', sku: '', unit: 'шт', last_purchase_price: '', 
    description: '', warranty_period_months: '12', has_serial: false,
    item_type: 'product' as 'product' | 'material'
  });

  useEffect(() => {
    if (mode === 'edit_catalog' && selectedItem) {
      setFormData({
        name: selectedItem.name,
        sku: selectedItem.sku || '',
        unit: selectedItem.unit || 'шт',
        last_purchase_price: selectedItem.last_purchase_price?.toString() || '',
        description: selectedItem.description || '',
        warranty_period_months: selectedItem.warranty_period_months?.toString() || '12',
        has_serial: selectedItem.has_serial,
        item_type: selectedItem.item_type || 'product'
      });
    }
  }, [mode, selectedItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const payload = {
        name: formData.name,
        item_type: formData.item_type,
        sku: formData.sku || null,
        unit: formData.unit,
        last_purchase_price: parseFloat(formData.last_purchase_price) || 0,
        description: formData.description || null,
        has_serial: formData.has_serial,
        warranty_period_months: parseInt(formData.warranty_period_months) || 12
    };

    try {
      if (mode === 'edit_catalog' && selectedItem) {
        const { error } = await supabase.from('inventory_catalog').update(payload).eq('id', selectedItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('inventory_catalog').insert([payload]);
        if (error) throw error;
      }
      onSuccess();
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const units = [
      { value: 'шт', label: 'Штуки (шт)' },
      { value: 'м', label: 'Метры (м)' },
      { value: 'упак', label: 'Упаковки (упак)' },
      { value: 'компл', label: 'Комплекты (компл)' }
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <Input label="Название" required value={formData.name} onChange={(e: any) => setFormData({...formData, name: e.target.value})} />
            <Input label="Артикул (SKU)" value={formData.sku} onChange={(e: any) => setFormData({...formData, sku: e.target.value})} />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
            <Select 
                label="Тип ТМЦ" 
                value={formData.item_type} 
                onChange={(e: any) => setFormData({...formData, item_type: e.target.value as any})}
                options={[{value: 'product', label: 'Оборудование'}, {value: 'material', label: 'Материал'}]} 
            />
            <Select 
                label="Ед. измерения" 
                value={formData.unit} 
                onChange={(e: any) => setFormData({...formData, unit: e.target.value})}
                options={units} 
            />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <Input label="Цена закупки (справочно)" type="number" step="0.01" value={formData.last_purchase_price} onChange={(e: any) => setFormData({...formData, last_purchase_price: e.target.value})} />
            <Input label="Гарантия (мес)" type="number" required value={formData.warranty_period_months} onChange={(e: any) => setFormData({...formData, warranty_period_months: e.target.value})} />
        </div>
        
        <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl cursor-pointer">
            <input type="checkbox" checked={formData.has_serial} onChange={(e) => setFormData({...formData, has_serial: e.target.checked})} className="w-5 h-5 rounded" />
            <span className="text-sm font-bold text-slate-700">Обычно имеет серийный номер</span>
        </label>
        
        <div className="w-full">
            <label className="block text-xs font-medium text-[#444746] mb-1.5 ml-1">Описание</label>
            <textarea className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
        </div>
        
        <div className="pt-2">
            <Button type="submit" className="w-full h-12" loading={loading}>{mode === 'edit_catalog' ? 'Сохранить изменения' : 'Создать'}</Button>
        </div>
    </form>
  );
};
