
import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { Input, Select, Button } from '../../../ui';
import { Product } from '../../../../types';

interface ProductFormProps {
  product: Product | null;
  categories: string[];
  existingTypes: string[];
  onSuccess: () => void;
}

export const ProductForm: React.FC<ProductFormProps> = ({ product, categories, existingTypes, onSuccess }) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    type: '',
    unit: 'шт',
    base_price: '',
    retail_price: '',
    description: '',
    manufacturer: '',
    origin_country: '',
    weight: '',
    has_serial: false,
    image_url: ''
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        sku: product.sku || '',
        category: product.category,
        type: product.type,
        unit: product.unit,
        base_price: product.base_price.toString(),
        retail_price: product.retail_price.toString(),
        description: product.description || '',
        manufacturer: product.manufacturer || '',
        origin_country: product.origin_country || '',
        weight: product.weight?.toString() || '',
        has_serial: product.has_serial,
        image_url: product.image_url || ''
      });
    } else {
        setFormData({
            name: '', sku: '', category: '', type: '', unit: 'шт', 
            base_price: '', retail_price: '', description: '', 
            manufacturer: '', origin_country: '', weight: '',
            has_serial: false, image_url: ''
        });
    }
  }, [product]);

  const mutation = useMutation({
    mutationFn: async () => {
        const payload = {
          ...formData,
          category: formData.category || 'Общее',
          type: formData.type || 'Товар',
          base_price: parseFloat(formData.base_price) || 0,
          retail_price: parseFloat(formData.retail_price) || 0,
          weight: formData.weight ? parseFloat(formData.weight) : null,
          manufacturer: formData.manufacturer || null,
          origin_country: formData.origin_country || null,
          image_url: formData.image_url || null
        };

        if (product) {
            await supabase.from('products').update(payload).eq('id', product.id);
        } else {
            await supabase.from('products').insert([payload]);
        }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onSuccess();
    },
    onError: (error: any) => {
      alert("Ошибка: " + error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        {formData.image_url && (
            <div className="flex justify-center mb-4">
                <img src={formData.image_url} alt="Preview" className="h-32 w-32 object-contain rounded-xl border border-slate-200 bg-white" />
            </div>
        )}

        <Input label="Название товара" required value={formData.name} onChange={(e:any) => setFormData({...formData, name: e.target.value})} />
        
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Категория</label>
                <input 
                    list="categories-list"
                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-base outline-none focus:border-blue-500"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    placeholder="Выберите или введите..."
                />
                <datalist id="categories-list">
                    {categories.map(c => <option key={c} value={c} />)}
                </datalist>
            </div>
            
            <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Тип товара</label>
                <input 
                    list="types-list"
                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-base outline-none focus:border-blue-500"
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    placeholder="Выберите или введите..."
                />
                <datalist id="types-list">
                    {existingTypes.map(t => <option key={t} value={t} />)}
                </datalist>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <Input label="Артикул (SKU)" value={formData.sku} onChange={(e:any) => setFormData({...formData, sku: e.target.value})} />
            <Select label="Ед. измерения" value={formData.unit} onChange={(e:any) => setFormData({...formData, unit: e.target.value})} options={[{value:'шт', label:'шт'}, {value:'м', label:'м'}, {value:'компл', label:'компл'}, {value:'упак', label:'упак'}]} />
        </div>

        <div className="grid grid-cols-3 gap-4">
            <Input label="Производитель" value={formData.manufacturer} onChange={(e:any) => setFormData({...formData, manufacturer: e.target.value})} />
            <Input label="Страна" value={formData.origin_country} onChange={(e:any) => setFormData({...formData, origin_country: e.target.value})} />
            <Input label="Вес (кг)" type="number" step="0.001" value={formData.weight} onChange={(e:any) => setFormData({...formData, weight: e.target.value})} />
        </div>

        <div className="w-full">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Описание</label>
            <textarea 
                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Характеристики, заметки..."
            />
        </div>

        <Input label="Ссылка на изображение (URL)" value={formData.image_url} onChange={(e:any) => setFormData({...formData, image_url: e.target.value})} icon="image" placeholder="https://example.com/image.jpg" />

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="grid grid-cols-2 gap-4 mb-4">
                <Input label="Закупка (BYN)" type="number" required value={formData.base_price} onChange={(e:any) => setFormData({...formData, base_price: e.target.value})} icon="payments" />
                <Input label="Продажа (BYN)" type="number" required value={formData.retail_price} onChange={(e:any) => setFormData({...formData, retail_price: e.target.value})} icon="sell" />
            </div>
            
            <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={formData.has_serial} onChange={(e) => setFormData({...formData, has_serial: e.target.checked})} className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" />
                <span className="text-sm font-bold text-slate-700">Требует Серийный Номер (S/N)</span>
            </label>
        </div>

        <Button type="submit" className="w-full h-12" loading={mutation.isPending}>Сохранить</Button>
    </form>
  );
};
