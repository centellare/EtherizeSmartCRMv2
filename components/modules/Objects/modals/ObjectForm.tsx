
import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { Button, Input, Select } from '../../../ui';
import { createNotification } from '../../../../lib/notifications';

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
  const queryClient = useQueryClient();
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

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      let error;
      if (mode === 'edit' && initialData) {
        const res = await supabase.from('objects').update(payload).eq('id', initialData.id);
        error = res.error;

        // Notify responsible if changed
        if (initialData.responsible_id !== payload.responsible_id && payload.responsible_id && payload.responsible_id !== profile.id) {
          await createNotification(payload.responsible_id, `Вам назначен объект: ${payload.name}`, `#objects/${initialData.id}`);
        }
      } else {
        const { data: newObject, error: insertError } = await supabase.from('objects').insert([{ 
          ...payload, 
          created_by: profile.id, 
          current_stage: 'negotiation', 
          current_status: 'in_work' 
        }]).select('id').single();
        error = insertError;

        // Notify responsible
        if (newObject && payload.responsible_id && payload.responsible_id !== profile.id) {
          await createNotification(payload.responsible_id, `Вам назначен новый объект: ${payload.name}`, `#objects/${newObject.id}`);
        }
      }
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objects'] });
      onSuccess();
    },
    onError: (error: any) => {
      alert('Ошибка при сохранении: ' + error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData, updated_by: profile.id, updated_at: new Date().toISOString() };
    mutation.mutate(payload);
  };

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

      <Button type="submit" className="w-full h-14" loading={mutation.isPending} icon="save">
        {mode === 'edit' ? 'Сохранить изменения' : 'Создать объект'}
      </Button>
    </form>
  );
};
