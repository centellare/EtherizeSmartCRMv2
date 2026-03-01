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
  const [showLegalData, setShowLegalData] = useState(false);
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
    legal_name: '',
    rep_position_nom: '',
    rep_position_gen: '',
    rep_name_nom: '',
    rep_name_gen: '',
    rep_name_short: '',
    basis_of_authority: '',
    unp: '',
    bank_details: '',
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
        legal_name: initialData.legal_name || '',
        rep_position_nom: initialData.rep_position_nom || '',
        rep_position_gen: initialData.rep_position_gen || '',
        rep_name_nom: initialData.rep_name_nom || '',
        rep_name_gen: initialData.rep_name_gen || '',
        rep_name_short: initialData.rep_name_short || '',
        basis_of_authority: initialData.basis_of_authority || '',
        unp: initialData.unp || '',
        bank_details: initialData.bank_details || '',
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
      legal_name: formData.legal_name || null,
      rep_position_nom: formData.rep_position_nom || null,
      rep_position_gen: formData.rep_position_gen || null,
      rep_name_nom: formData.rep_name_nom || null,
      rep_name_gen: formData.rep_name_gen || null,
      rep_name_short: formData.rep_name_short || null,
      basis_of_authority: formData.basis_of_authority || null,
      unp: formData.unp || null,
      bank_details: formData.bank_details || null,
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

      {/* Юридические данные (скрываемая секция) */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowLegalData(!showLegalData)}
          className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-2 text-slate-700 font-medium">
            <span className="material-icons-round text-slate-400">gavel</span>
            Юридические данные
          </div>
          <span className={`material-icons-round text-slate-400 transition-transform ${showLegalData ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </button>
        
        {showLegalData && (
          <div className="p-4 space-y-4 bg-white border-t border-slate-200">
            <Input 
              label="Контрагент" 
              value={formData.legal_name} 
              onChange={(e: any) => setFormData({...formData, legal_name: e.target.value})} 
              icon="business" 
              placeholder="ООО «Ромашка»"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="Должность представителя (Кто?)" 
                value={formData.rep_position_nom} 
                onChange={(e: any) => setFormData({...formData, rep_position_nom: e.target.value})} 
                icon="work" 
                placeholder="Директор"
              />
              <Input 
                label="Должность представителя (Кого?)" 
                value={formData.rep_position_gen} 
                onChange={(e: any) => setFormData({...formData, rep_position_gen: e.target.value})} 
                icon="work_outline" 
                placeholder="Директора"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="Представитель (Кто?)" 
                value={formData.rep_name_nom} 
                onChange={(e: any) => setFormData({...formData, rep_name_nom: e.target.value})} 
                icon="person" 
                placeholder="Иванов Иван Иванович"
              />
              <Input 
                label="Представитель (Кого?)" 
                value={formData.rep_name_gen} 
                onChange={(e: any) => setFormData({...formData, rep_name_gen: e.target.value})} 
                icon="person_outline" 
                placeholder="Иванова Ивана Ивановича"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="Представитель (Кто?) сокр." 
                value={formData.rep_name_short} 
                onChange={(e: any) => setFormData({...formData, rep_name_short: e.target.value})} 
                icon="short_text" 
                placeholder="Иванов И.И."
              />
              <Input 
                label="На основании чего?" 
                value={formData.basis_of_authority} 
                onChange={(e: any) => setFormData({...formData, basis_of_authority: e.target.value})} 
                icon="description" 
                placeholder="Устава"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="УНП" 
                value={formData.unp} 
                onChange={(e: any) => setFormData({...formData, unp: e.target.value})} 
                icon="tag" 
                placeholder="123456789"
              />
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <span className="material-icons text-slate-400 text-[18px]">account_balance</span>
                    Реквизиты
                </label>
                <textarea 
                    value={formData.bank_details}
                    onChange={(e) => setFormData({...formData, bank_details: e.target.value})}
                    className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-sm"
                    placeholder="р/с BY... в банке..."
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <Button type="submit" className="w-full h-14" loading={isPending} icon="save">
        {mode === 'edit' ? 'Сохранить изменения' : 'Создать клиента'}
      </Button>
    </form>
  );
};
