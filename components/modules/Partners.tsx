import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Button, Input, Modal, Badge, useToast } from '../ui';
import { Partner } from '../../types';
import { PartnerStats } from './Partners/PartnerStats'; // NEW

interface PartnersProps {
  profile: any;
}

const Partners: React.FC<PartnersProps> = ({ profile }) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'list' | 'stats'>('list');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [formData, setFormData] = useState<Partial<Partner>>({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    default_commission_percent: 10,
    status: 'active',
    notes: ''
  });

  // Fetch Partners
  const { data: partners = [], isLoading } = useQuery({
    queryKey: ['partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select('*, clients(count)')
        .order('name');
      
      if (error) throw error;
      return data.map(p => ({
        ...p,
        total_clients: (p.clients?.[0] as any)?.count || 0,
        clients: [], // Initialize as empty array to match type
        created_at: p.created_at || new Date().toISOString(),
        updated_at: p.updated_at || new Date().toISOString()
      }));
    }
  });

  // Create/Update Mutation
  const mutation = useMutation({
    mutationFn: async (data: Partial<Partner>) => {
      if (editingPartner) {
        const { error } = await supabase
          .from('partners')
          .update(data)
          .eq('id', editingPartner.id);
        if (error) throw error;
      } else {
        // Ensure name is present for insert
        if (!data.name) throw new Error('Name is required');
        
        const { error } = await supabase
          .from('partners')
          .insert([data as any]); // Cast to any to bypass strict type check for now
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      setIsModalOpen(false);
      setEditingPartner(null);
      setFormData({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        default_commission_percent: 10,
        status: 'active',
        notes: ''
      });
      toast.success(editingPartner ? 'Партнер обновлен' : 'Партнер создан');
    },
    onError: (error: any) => {
      toast.error('Ошибка: ' + error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return toast.error('Введите название');
    mutation.mutate(formData);
  };

  const handleEdit = (partner: Partner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      contact_person: partner.contact_person || '',
      phone: partner.phone || '',
      email: partner.email || '',
      default_commission_percent: partner.default_commission_percent,
      status: partner.status,
      notes: partner.notes || ''
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Партнеры</h2>
          <p className="text-slate-500 text-sm">Управление партнерской сетью и агентами</p>
        </div>
        <Button icon="add" onClick={() => { setEditingPartner(null); setIsModalOpen(true); }}>Добавить партнера</Button>
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'list' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Список
        </button>
        <button 
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'stats' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Статистика
        </button>
      </div>

      {activeTab === 'list' ? (
        <>
          {isLoading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
          ) : partners.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-300">
              <span className="material-icons-round text-4xl text-slate-300 mb-2">handshake</span>
              <p className="text-slate-500">Список партнеров пуст</p>
              <Button variant="ghost" className="mt-2 text-blue-600" onClick={() => setIsModalOpen(true)}>Добавить первого</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {partners.map((partner: any) => (
                <div key={partner.id} className="bg-white p-6 rounded-[24px] border border-slate-200 hover:shadow-md transition-all group relative">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                        {partner.name[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 leading-tight">{partner.name}</h3>
                        <p className="text-xs text-slate-500">{partner.contact_person || 'Нет контакта'}</p>
                      </div>
                    </div>
                    <Badge color={partner.status === 'active' ? 'emerald' : 'slate'}>
                      {partner.status === 'active' ? 'Активен' : 'Неактивен'}
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-4">
                    {partner.phone && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="material-icons-round text-slate-400 text-base">phone</span>
                        {partner.phone}
                      </div>
                    )}
                    {partner.email && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="material-icons-round text-slate-400 text-base">email</span>
                        {partner.email}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 py-3 border-t border-slate-100">
                    <div className="text-center">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Клиентов</p>
                      <p className="text-lg font-bold text-slate-900">{partner.total_clients}</p>
                    </div>
                    <div className="w-[1px] h-8 bg-slate-100"></div>
                    <div className="text-center">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Комиссия</p>
                      <p className="text-lg font-bold text-indigo-600">{partner.default_commission_percent}%</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleEdit(partner)}
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-600"
                  >
                    <span className="material-icons-round">edit</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <PartnerStats partners={partners} />
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingPartner ? 'Редактирование партнера' : 'Новый партнер'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Название / Компания" required value={formData.name} onChange={(e: any) => setFormData({...formData, name: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Контактное лицо" value={formData.contact_person || ''} onChange={(e: any) => setFormData({...formData, contact_person: e.target.value})} />
            <Input label="Телефон" value={formData.phone || ''} onChange={(e: any) => setFormData({...formData, phone: e.target.value})} />
          </div>
          <Input label="Email" type="email" value={formData.email || ''} onChange={(e: any) => setFormData({...formData, email: e.target.value})} />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Комиссия по умолчанию (%)</label>
              <input 
                type="number" 
                min="0" 
                max="100" 
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-indigo-600"
                value={formData.default_commission_percent}
                onChange={(e) => setFormData({...formData, default_commission_percent: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Статус</label>
              <select 
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-all"
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value as any})}
              >
                <option value="active">Активен</option>
                <option value="inactive">Неактивен</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Заметки</label>
            <textarea 
              className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-all min-h-[80px] text-sm"
              value={formData.notes || ''}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Реквизиты, особенности работы..."
            />
          </div>

          <div className="pt-4 flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setIsModalOpen(false)}>Отмена</Button>
            <Button type="submit" className="flex-1" loading={mutation.isPending}>Сохранить</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Partners;
