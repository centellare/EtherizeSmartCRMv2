import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { Button, Input, Select } from '../../../ui';
import { useObjectMutations } from '../../../../hooks/useObjectMutations';

interface ObjectFormProps {
  mode: 'create' | 'edit';
  initialData?: any;
  clients: any[];
  staff: any[];
  profile: any;
  initialClientId?: string | null;
  onSuccess: () => void;
}

export const ObjectForm: React.FC<ObjectFormProps> = ({ 
  mode, initialData, clients, staff, profile, initialClientId, onSuccess 
}) => {
  const { createObject, updateObject } = useObjectMutations();
  
  const [formData, setFormData] = useState({ 
    name: '', 
    address: '', 
    client_id: '', 
    responsible_id: '', 
    comment: '' 
  });

  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setFormData({ 
        name: initialData.name, 
        address: initialData.address || '', 
        client_id: initialData.client_id, 
        responsible_id: initialData.responsible_id, 
        comment: initialData.comment || '' 
      });
    } else {
      // Create mode defaults
      setFormData({
        name: '',
        address: '',
        client_id: initialClientId || '',
        responsible_id: profile?.id || '',
        comment: ''
      });
    }
  }, [mode, initialData, initialClientId, profile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanPayload = {
      name: formData.name,
      address: formData.address || null,
      client_id: formData.client_id,
      responsible_id: formData.responsible_id,
      comment: formData.comment || null
    };

    if (mode === 'create') {
      createObject.mutate({
        payload: {
          ...cleanPayload,
          created_by: profile.id
        },
        clients,
        staff,
        profile
      }, {
        onSuccess: onSuccess
      });
    } else {
      updateObject.mutate({
        payload: {
          id: initialData.id,
          ...cleanPayload,
          updated_by: profile.id
        },
        initialData,
        clients,
        staff,
        profile
      }, {
        onSuccess: onSuccess
      });
    }
  };

  const isPending = createObject.isPending || updateObject.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Название объекта" required value={formData.name} onChange={(e: any) => setFormData({...formData, name: e.target.value})} icon="business" />
      <Input label="Адрес" value={formData.address} onChange={(e: any) => setFormData({...formData, address: e.target.value})} icon="place" />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select 
            label="Клиент" 
            required 
            value={formData.client_id} 
            onChange={(e: any) => setFormData({...formData, client_id: e.target.value})} 
            options={[{ value: '', label: 'Выберите клиента' }, ...clients.map(c => ({ value: c.id, label: c.name }))]} 
            icon="person" 
            disabled={!!initialClientId && mode === 'create'} 
        />
        <Select label="Ответственный" required value={formData.responsible_id} onChange={(e: any) => setFormData({...formData, responsible_id: e.target.value})} options={[{ value: '', label: 'Выберите ответственного' }, ...staff.map(s => ({ value: s.id, label: s.full_name }))]} icon="support_agent" />
      </div>

      <div className="w-full">
        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Комментарий / Заметки</label>
        <textarea 
          className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-base text-[#1c1b1f] outline-none transition-all focus:border-[#005ac1] focus:ring-4 focus:ring-[#005ac1]/5 min-h-[100px]"
          value={formData.comment}
          onChange={(e) => setFormData({...formData, comment: e.target.value})}
          placeholder="Дополнительная информация по объекту..."
        />
      </div>

      <Button type="submit" className="w-full h-14" loading={isPending} icon="save">
        {mode === 'edit' ? 'Сохранить изменения' : 'Создать объект'}
      </Button>
    </form>
  );
};
