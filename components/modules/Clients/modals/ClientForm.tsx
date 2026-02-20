
import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { Button, Input, Select } from '../../../ui';

interface ClientFormProps {
  mode: 'create' | 'edit';
  initialData?: any;
  staff: any[];
  profile: any;
  onSuccess: () => void;
}

const SOURCES = [
    { value: 'instagram', label: 'Instagram / Соцсети' },
    { value: 'website', label: 'Наш сайт (SEO/Ads)' },
    { value: 'referral', label: 'Рекомендация (Сарафан)' },
    { value: 'partner', label: 'Партнер (Дизайнер/Архитектор)' },
    { value: 'cold_call', label: 'Холодный поиск' },
    { value: 'exhibition', label: 'Выставка / Мероприятие' },
    { value: 'other', label: 'Другое' }
];

export const ClientForm: React.FC<ClientFormProps> = ({ mode, initialData, staff, profile, onSuccess }) => {
  const queryClient = useQueryClient();
  const [clients, setClients] = useState<any[]>([]); // For referral selection
  const [formData, setFormData] = useState({
    name: '',
    type: 'person' as 'person' | 'company',
    contact_person: '',
    contact_position: '',
    phone: '',
    email: '',
    requisites: '',
    comment: '',
    manager_id: profile?.id || '',
    lead_source: 'other',
    referred_by: ''
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
        manager_id: initialData.manager_id || profile?.id || '',
        lead_source: initialData.lead_source || 'other',
        referred_by: initialData.referred_by || ''
      });
    }
    
    // Fetch clients for referral list
    const fetchClients = async () => {
        const { data } = await supabase.from('clients').select('id, name').is('deleted_at', null).order('name');
        setClients(data || []);
    };
    fetchClients();
  }, [mode, initialData, profile]);

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      if (mode === 'edit') {
        const { error } = await supabase.from('clients').update(payload).eq('id', initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clients').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onSuccess();
    },
    onError: (error: any) => {
      alert('Ошибка при сохранении: ' + error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { 
        ...formData, 
        referred_by: formData.lead_source === 'referral' ? (formData.referred_by || null) : null, // Clear referral if source changed
        updated_at: new Date().toISOString(), 
        updated_by: profile.id 
    };
    if (mode === 'create') (payload as any).created_by = profile.id;
    
    // Для физлиц очищаем контактные данные
    if (formData.type === 'person') {
      payload.contact_person = '';
      payload.contact_position = '';
    }
    
    mutation.mutate(payload);
  };

  const managers = staff.filter(s => s.role === 'manager' || s.role === 'director');
  
  // Filter out current client from referral list (can't refer self)
  const potentialReferrers = clients.filter(c => c.id !== initialData?.id);

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

      {/* MARKETING BLOCK */}
      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 space-y-4">
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest ml-1">Маркетинг (Откуда пришел)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select 
                  label="Источник" 
                  value={formData.lead_source} 
                  onChange={(e: any) => setFormData({...formData, lead_source: e.target.value})}
                  options={SOURCES}
                  icon="campaign"
              />
              {formData.lead_source === 'referral' && (
                  <Select 
                      label="Кто порекомендовал?" 
                      value={formData.referred_by} 
                      onChange={(e: any) => setFormData({...formData, referred_by: e.target.value})}
                      options={[{value: '', label: 'Выберите клиента...'}, ...potentialReferrers.map(c => ({ value: c.id, label: c.name }))]}
                      icon="handshake"
                      className="animate-in fade-in slide-in-from-left-2"
                  />
              )}
          </div>
      </div>

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
      <Button type="submit" className="w-full h-14" loading={mutation.isPending} icon="save">
        {mode === 'edit' ? 'Сохранить изменения' : 'Создать клиента'}
      </Button>
    </form>
  );
};
