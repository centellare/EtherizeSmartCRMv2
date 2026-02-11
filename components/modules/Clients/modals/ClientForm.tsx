
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Button, Input, Select } from '../../../ui';

interface ClientFormProps {
  mode: 'create' | 'edit';
  initialData?: any;
  staff: any[];
  profile: any;
  onSuccess: () => void;
}

export const ClientForm: React.FC<ClientFormProps> = ({ mode, initialData, staff, profile, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'person' as 'person' | 'company',
    contact_person: '',
    contact_position: '',
    phone: '',
    email: '',
    requisites: '',
    comment: '',
    manager_id: profile?.id || ''
  });

  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setFormData({
        name: initialData.name,
        type: initialData.type,
        contact_person: initialData.contact_person || '',
        contact_position: initialData.contact_position || '',
        phone: initialData.phone || '',
        email: initialData.email || '',
        requisites: initialData.requisites || '',
        comment: initialData.comment || '',
        manager_id: initialData.manager_id || profile?.id || ''
      });
    }
  }, [mode, initialData, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = { ...formData, updated_at: new Date().toISOString(), updated_by: profile.id };
    if (mode === 'create') (payload as any).created_by = profile.id;
    
    // Для физлиц очищаем контактные данные
    if (formData.type === 'person') {
      payload.contact_person = '';
      payload.contact_position = '';
    }
    
    const { error } = mode === 'edit' 
      ? await supabase.from('clients').update(payload).eq('id', initialData.id) 
      : await supabase.from('clients').insert([payload]);
    
    if (!error) {
      onSuccess();
    } else {
        alert('Ошибка при сохранении: ' + error.message);
    }
    setLoading(false);
  };

  const managers = staff.filter(s => s.role === 'manager' || s.role === 'director');

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input 
        label="Имя / Название компании" 
        required 
        value={formData.name} 
        onChange={(e: any) => setFormData({...formData, name: e.target.value})} 
        icon="person" 
      />
      <div className="grid grid-cols-2 gap-4">
        <Select 
          label="Тип" 
          value={formData.type} 
          onChange={(e: any) => setFormData({...formData, type: e.target.value as 'person' | 'company'})}
          options={[{ value: 'person', label: 'Физлицо' }, { value: 'company', label: 'Компания' }]}
          icon="category"
        />
        <Select 
          label="Менеджер" 
          value={formData.manager_id} 
          onChange={(e: any) => setFormData({...formData, manager_id: e.target.value})}
          options={[{ value: '', label: 'Не выбран' }, ...managers.map(s => ({ value: s.id, label: s.full_name }))]}
          icon="support_agent"
        />
      </div>

      {formData.type === 'company' && (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Представитель компании</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="ФИО контактного лица" value={formData.contact_person} onChange={(e: any) => setFormData({...formData, contact_person: e.target.value})} icon="account_box" placeholder="Напр: Иванов Иван" />
                <Input label="Должность" value={formData.contact_position} onChange={(e: any) => setFormData({...formData, contact_position: e.target.value})} icon="work_outline" placeholder="Напр: Гендиректор" />
            </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Input label="Телефон" value={formData.phone} onChange={(e: any) => setFormData({...formData, phone: e.target.value})} icon="phone" />
        <Input label="Email" type="email" value={formData.email} onChange={(e: any) => setFormData({...formData, email: e.target.value})} icon="alternate_email" />
      </div>
      <div className="w-full">
        <label className="block text-xs font-medium text-[#444746] mb-1.5 ml-1">Реквизиты</label>
        <textarea 
          className="w-full bg-transparent border border-[#747775] rounded-xl px-4 py-3 text-base text-[#1c1b1f] outline-none transition-all focus:border-[#005ac1] focus:ring-1 focus:ring-[#005ac1] min-h-[120px]"
          value={formData.requisites}
          onChange={(e) => setFormData({...formData, requisites: e.target.value})}
          placeholder="ИНН, КПП, банковские реквизиты..."
        />
      </div>
      <div className="w-full">
        <label className="block text-xs font-medium text-[#444746] mb-1.5 ml-1">Комментарий</label>
        <textarea 
          className="w-full bg-transparent border border-[#747775] rounded-xl px-4 py-3 text-base text-[#1c1b1f] outline-none transition-all focus:border-[#005ac1] focus:ring-1 focus:ring-[#005ac1] min-h-[80px]"
          value={formData.comment}
          onChange={(e) => setFormData({...formData, comment: e.target.value})}
          placeholder="Дополнительная информация о клиенте..."
        />
      </div>
      <Button type="submit" className="w-full h-14" loading={loading} icon="save">
        {mode === 'edit' ? 'Сохранить изменения' : 'Создать клиента'}
      </Button>
    </form>
  );
};
