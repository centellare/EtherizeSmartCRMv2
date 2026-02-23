import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { Button, Input, Select } from '../../../ui';
import { createNotification } from '../../../../lib/notifications';

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

  const [partners, setPartners] = useState<any[]>([]); 
  const [formData, setFormData] = useState({
    name: '',
    type: 'person' as 'person' | 'company', // Изменено на person
    contact_person: '',
    phone: '',
    email: '',
    requisites: '',
    lead_source: 'other',
    partner_id: '',
    manager_id: profile?.id || '',
  });

  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setFormData({
        name: initialData.name,
        // Если прилетит старый кэш с individual, сразу мапим в person
        type: initialData.type === 'individual' ? 'person' : initialData.type, 
        contact_person: initialData.contact_person || '',
        phone: initialData.phone || '',
        email: initialData.email || '',
        requisites: initialData.requisites || '',
        lead_source: initialData.lead_source || 'other',
        partner_id: initialData.partner_id || '',
        manager_id: initialData.manager_id || profile?.id || '',
      });
    }
    
    const fetchPartners = async () => {
        const { data } = await supabase.from('partners').select('id, name').eq('status', 'active').order('name');
        setPartners(data || []);
    };
    fetchPartners();
  }, [mode, initialData, profile]);

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const cleanPayload = {
        name: payload.name,
        type: payload.type, // Теперь тут всегда person или company
        contact_person: payload.contact_person,
        phone: payload.phone,
        email: payload.email,
        requisites: payload.requisites,
        lead_source: payload.lead_source,
        partner_id: payload.lead_source === 'partner' && payload.partner_id ? payload.partner_id : null,
        manager_id: payload.manager_id || null,
        updated_at: new Date().toISOString(),
        updated_by: profile.id
      };

      if (mode === 'create') {
        (cleanPayload as any).created_by = profile.id;
      }

      if (mode === 'edit') {
        const { error } = await supabase.from('clients').update(cleanPayload).eq('id', initialData.id);
        if (error) throw error;

        // Notify manager if changed
        if (initialData.manager_id !== payload.manager_id && payload.manager_id && payload.manager_id !== profile.id) {
          await createNotification(payload.manager_id, `Вам назначен клиент: ${payload.name}`, `#clients/${initialData.id}`);
        }
      } else {
        const { data, error } = await supabase.from('clients').insert([cleanPayload]).select('id').single();
        if (error) throw error;

        // Notify manager
        if (payload.manager_id && payload.manager_id !== profile.id) {
          await createNotification(payload.manager_id, `Вам назначен новый клиент: ${payload.name}`, `#clients/${data.id}`);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onSuccess();
    },
    onError: (error: any) => {
      console.error('Client save error:', error);
      alert('Ошибка при сохранении: ' + error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
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
          onChange={(e: any) => setFormData({...formData, type: e.target.value as 'person' | 'company'})} // Изменено
          options={[{ value: 'person', label: 'Физлицо' }, { value: 'company', label: 'Компания' }]} // Изменено
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
        <Input label="Контактное лицо" value={formData.contact_person} onChange={(e: any) => setFormData({...formData, contact_person: e.target.value})} icon="account_box" placeholder="Напр: Иванов Иван" />
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
              {formData.lead_source === 'partner' && (
                  <Select 
                      label="Выберите партнера" 
                      value={formData.partner_id} 
                      onChange={(e: any) => setFormData({...formData, partner_id: e.target.value})}
                      options={[{value: '', label: 'Выберите...'}, ...partners.map(p => ({ value: p.id, label: p.name }))]}
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
      
      <Input label="Адрес / Реквизиты" value={formData.requisites} onChange={(e: any) => setFormData({...formData, requisites: e.target.value})} icon="location_on" />

      <Button type="submit" className="w-full h-14" loading={mutation.isPending} icon="save">
        {mode === 'edit' ? 'Сохранить изменения' : 'Создать клиента'}
      </Button>
    </form>
  );
};