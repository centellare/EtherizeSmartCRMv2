import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { Button, Input, Select } from '../../../ui';
import { useClientMutations } from '../../../../hooks/useClientMutations';

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
  const { createClient, updateClient } = useClientMutations();

  const [partners, setPartners] = useState<any[]>([]); 
  const [formData, setFormData] = useState({
    name: '',
    type: 'person' as 'person' | 'company',
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanPayload = {
      name: formData.name,
      type: formData.type,
      contact_person: formData.contact_person || null,
      phone: formData.phone || null,
      email: formData.email || null,
      requisites: formData.requisites || null,
      lead_source: formData.lead_source || null,
      partner_id: formData.lead_source === 'partner' && formData.partner_id ? formData.partner_id : null,
      manager_id: formData.manager_id || null,
    };

    if (mode === 'create') {
      createClient.mutate({
        payload: {
          ...cleanPayload,
          created_by: profile.id
        },
        staff,
        profile
      }, {
        onSuccess: onSuccess
      });
    } else {
      updateClient.mutate({
        payload: {
          id: initialData.id,
          ...cleanPayload,
          updated_by: profile.id
        },
        initialData,
        staff,
        profile
      }, {
        onSuccess: onSuccess
      });
    }
  };

  const isPending = createClient.isPending || updateClient.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Имя / Название" required value={formData.name} onChange={(e: any) => setFormData({...formData, name: e.target.value})} icon="badge" />
        <Select 
            label="Тип клиента" 
            value={formData.type} 
            onChange={(e: any) => setFormData({...formData, type: e.target.value})} 
            options={[
                { value: 'person', label: 'Физическое лицо' }, 
                { value: 'company', label: 'Юридическое лицо' }
            ]} 
            icon="category" 
        />
      </div>

      {formData.type === 'company' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Контактное лицо" value={formData.contact_person} onChange={(e: any) => setFormData({...formData, contact_person: e.target.value})} icon="person" />
            <Input label="Реквизиты (УНП)" value={formData.requisites} onChange={(e: any) => setFormData({...formData, requisites: e.target.value})} icon="description" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Телефон" type="tel" value={formData.phone} onChange={(e: any) => setFormData({...formData, phone: e.target.value})} icon="phone" />
        <Input label="Email" type="email" value={formData.email} onChange={(e: any) => setFormData({...formData, email: e.target.value})} icon="email" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select 
            label="Источник лида" 
            value={formData.lead_source} 
            onChange={(e: any) => setFormData({...formData, lead_source: e.target.value})} 
            options={SOURCES} 
            icon="campaign" 
        />
        
        {formData.lead_source === 'partner' ? (
            <Select 
                label="Выберите партнера" 
                value={formData.partner_id} 
                onChange={(e: any) => setFormData({...formData, partner_id: e.target.value})} 
                options={[{value: '', label: 'Не выбран'}, ...partners.map(p => ({value: p.id, label: p.name}))]} 
                icon="handshake" 
            />
        ) : (
            <Select 
                label="Менеджер" 
                value={formData.manager_id} 
                onChange={(e: any) => setFormData({...formData, manager_id: e.target.value})} 
                options={[{value: '', label: 'Без менеджера'}, ...staff.map(s => ({value: s.id, label: s.full_name}))]} 
                icon="support_agent" 
            />
        )}
      </div>

      <Button type="submit" className="w-full h-14" loading={isPending} icon="save">
        {mode === 'edit' ? 'Сохранить изменения' : 'Создать клиента'}
      </Button>
    </form>
  );
};
