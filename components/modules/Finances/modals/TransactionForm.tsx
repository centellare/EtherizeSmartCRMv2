
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Button, Input, Select } from '../../../ui';
import { getMinskISODate } from '../../../../lib/dateUtils';

interface TransactionFormProps {
  mode: 'create' | 'edit';
  initialData?: any;
  objects: any[];
  profile: any;
  onSuccess: () => void;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({ mode, initialData, objects, profile, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const isSpecialist = profile.role === 'specialist';
  
  const [formData, setFormData] = useState({ 
    object_id: '', 
    amount: '', 
    planned_date: getMinskISODate(),
    type: 'expense' as 'income' | 'expense',
    category: '',
    description: '',
    doc_link: '',
    doc_name: ''
  });

  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setFormData({
        object_id: initialData.object_id,
        amount: (initialData.type === 'expense' ? (initialData.requested_amount || initialData.amount) : initialData.amount).toString(),
        planned_date: initialData.planned_date ? getMinskISODate(initialData.planned_date) : getMinskISODate(),
        type: initialData.type,
        category: initialData.category,
        description: initialData.description || '',
        doc_link: initialData.doc_link || '',
        doc_name: initialData.doc_name || ''
      });
    } else if (mode === 'create') {
        // Инициализация (например, если пришли из кнопки "План прихода")
        if (initialData?.type) {
            setFormData(prev => ({ ...prev, type: initialData.type }));
        }
        // Auto-select object if passed (e.g. from ObjectWorkflow)
        if (objects.length === 1) {
            setFormData(prev => ({ ...prev, object_id: objects[0].id }));
        }
    }
  }, [mode, initialData, objects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
        alert('Введите корректную сумму');
        setLoading(false);
        return;
    }

    const type = isSpecialist ? 'expense' : formData.type;
    
    try {
        const payload = {
            object_id: formData.object_id,
            type: type,
            amount: amount,
            // Для прихода plan = amount. Для расхода request = amount.
            planned_amount: type === 'income' ? amount : null,
            requested_amount: type === 'expense' ? amount : null,
            // Теперь planned_date сохраняем для обоих типов!
            planned_date: formData.planned_date, 
            category: formData.category,
            description: formData.description,
            doc_link: formData.doc_link || null,
            doc_name: formData.doc_name || null
        };

        if (mode === 'edit' && initialData) {
            const { error } = await supabase.from('transactions').update(payload).eq('id', initialData.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('transactions').insert([{
                ...payload,
                status: 'pending',
                created_by: profile.id
            }]);
            if (error) throw error;
        }
        onSuccess();
    } catch (err: any) {
        alert('Ошибка: ' + err.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        {!isSpecialist && (mode === 'create' || !initialData) && (
             <Select 
                label="Объект" 
                required 
                value={formData.object_id} 
                onChange={(e:any) => setFormData({ ...formData, object_id: e.target.value })} 
                options={[{value: '', label: 'Выберите объект'}, ...objects.map(o => ({value: o.id, label: o.name}))]} 
                icon="business" 
             />
        )}
        {(isSpecialist || mode === 'edit') && (
             <Select 
                label="Объект" 
                required 
                value={formData.object_id} 
                onChange={(e:any) => setFormData({ ...formData, object_id: e.target.value })} 
                options={[{value: '', label: 'Выберите объект'}, ...objects.map(o => ({value: o.id, label: o.name}))]} 
                icon="business" 
             />
        )}

        <div className="grid grid-cols-2 gap-4">
            <Input label="Сумма" type="number" step="0.01" required value={formData.amount} onChange={(e:any) => setFormData({ ...formData, amount: e.target.value })} icon="payments" />
            <Input 
                label={formData.type === 'income' ? "Дата поступления (план)" : "Дата расхода (план)"} 
                type="date" 
                required 
                value={formData.planned_date} 
                onChange={(e:any) => setFormData({ ...formData, planned_date: e.target.value })} 
                icon="event" 
            />
        </div>
        <Input label="Категория" required value={formData.category} onChange={(e:any) => setFormData({ ...formData, category: e.target.value })} icon="category" placeholder="Напр: Логистика, Монтаж..." />
        
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Документация (опц.)</p>
            <div className="grid grid-cols-2 gap-4">
            <Input label="Имя документа" value={formData.doc_name} onChange={(e:any) => setFormData({ ...formData, doc_name: e.target.value })} icon="description" />
            <Input label="Ссылка" value={formData.doc_link} onChange={(e:any) => setFormData({ ...formData, doc_link: e.target.value })} icon="link" />
            </div>
        </div>

        <div className="w-full">
            <label className="block text-xs font-medium text-[#444746] mb-1.5 ml-1">Описание</label>
            <textarea className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:border-blue-500" rows={3} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
        </div>
        
        <Button type="submit" className="w-full h-14" loading={loading} icon="save">{mode === 'edit' ? 'Сохранить изменения' : 'Создать запись'}</Button>
    </form>
  );
};
