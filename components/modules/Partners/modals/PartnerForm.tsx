import React, { useState, useEffect } from 'react';
import { Button, Input, Select } from '../../../ui';
import { usePartnerMutations } from '../../../../hooks/usePartnerMutations';
import { PartnerDTO } from '../../../../types/dto';

interface PartnerFormProps {
  mode: 'create' | 'edit';
  initialData?: PartnerDTO | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const PartnerForm: React.FC<PartnerFormProps> = ({ mode, initialData, onSuccess, onCancel }) => {
  const { createPartner, updatePartner } = usePartnerMutations();
  
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    default_commission_percent: 10,
    status: 'active' as 'active' | 'inactive',
    notes: ''
  });

  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setFormData({
        name: initialData.name,
        contact_person: initialData.contact_person || '',
        phone: initialData.phone || '',
        email: initialData.email || '',
        default_commission_percent: initialData.default_commission_percent,
        status: initialData.status,
        notes: initialData.notes || ''
      });
    } else {
      setFormData({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        default_commission_percent: 10,
        status: 'active',
        notes: ''
      });
    }
  }, [mode, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Введите название партнера');
      return;
    }

    const payload = {
      name: formData.name,
      contact_person: formData.contact_person || null,
      phone: formData.phone || null,
      email: formData.email || null,
      default_commission_percent: formData.default_commission_percent,
      status: formData.status,
      notes: formData.notes || null
    };

    if (mode === 'edit' && initialData) {
      updatePartner.mutate({
        id: initialData.id,
        ...payload
      }, {
        onSuccess
      });
    } else {
      createPartner.mutate(payload, {
        onSuccess
      });
    }
  };

  const isPending = createPartner.isPending || updatePartner.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Название / Компания" required value={formData.name} onChange={(e: any) => setFormData({...formData, name: e.target.value})} icon="badge" />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Контактное лицо" value={formData.contact_person} onChange={(e: any) => setFormData({...formData, contact_person: e.target.value})} icon="person" />
        <Input label="Телефон" type="tel" value={formData.phone} onChange={(e: any) => setFormData({...formData, phone: e.target.value})} icon="phone" />
      </div>

      <Input label="Email" type="email" value={formData.email} onChange={(e: any) => setFormData({...formData, email: e.target.value})} icon="email" />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 ml-1 uppercase tracking-wider">Комиссия (%)</label>
          <div className="relative">
            <input 
              type="number" 
              min="0" 
              max="100" 
              className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-indigo-600"
              value={formData.default_commission_percent}
              onChange={(e) => setFormData({...formData, default_commission_percent: parseFloat(e.target.value) || 0})}
            />
            <span className="material-icons-round absolute left-3 top-2.5 text-slate-400 text-lg">percent</span>
          </div>
        </div>
        
        <Select 
          label="Статус" 
          value={formData.status} 
          onChange={(e: any) => setFormData({...formData, status: e.target.value})} 
          options={[
            { value: 'active', label: 'Активен' },
            { value: 'inactive', label: 'Неактивен' }
          ]} 
          icon="toggle_on" 
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1 ml-1 uppercase tracking-wider">Заметки</label>
        <textarea 
          className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-all min-h-[80px] text-sm"
          value={formData.notes}
          onChange={(e) => setFormData({...formData, notes: e.target.value})}
          placeholder="Реквизиты, особенности работы..."
        />
      </div>

      <div className="pt-2 flex gap-3">
        <Button variant="secondary" className="flex-1 h-12" onClick={onCancel}>Отмена</Button>
        <Button type="submit" className="flex-1 h-12" loading={isPending} icon="save">Сохранить</Button>
      </div>
    </form>
  );
};
