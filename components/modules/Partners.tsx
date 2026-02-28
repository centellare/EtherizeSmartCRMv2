import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Modal, Badge, useToast } from '../ui';
import { PartnerDTO } from '../../types/dto';
import { PartnerStats } from './Partners/PartnerStats';
import { usePartners } from '../../hooks/usePartners';
import { usePartnerMutations } from '../../hooks/usePartnerMutations';
import { PartnerForm } from './Partners/modals/PartnerForm';

interface PartnersProps {
  profile: any;
}

const Partners: React.FC<PartnersProps> = ({ profile }) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'list' | 'stats'>('list');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<PartnerDTO | null>(null);

  // Fetch Partners
  const { data: partners = [], isLoading } = usePartners();
  const { deletePartner } = usePartnerMutations();

  const handleEdit = (partner: PartnerDTO) => {
    setEditingPartner(partner);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Вы уверены, что хотите удалить партнера?')) {
      await deletePartner.mutateAsync(id);
    }
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
              {partners.map((partner) => (
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

                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button 
                      onClick={() => handleEdit(partner)}
                      className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-600"
                      title="Редактировать"
                    >
                      <span className="material-icons-round">edit</span>
                    </button>
                    <button 
                      onClick={() => handleDelete(partner.id)}
                      className="p-2 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-600"
                      title="Удалить"
                    >
                      <span className="material-icons-round">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <PartnerStats partners={partners} />
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingPartner ? 'Редактирование партнера' : 'Новый партнер'}>
        <PartnerForm 
          mode={editingPartner ? 'edit' : 'create'}
          initialData={editingPartner}
          onSuccess={() => { setIsModalOpen(false); setEditingPartner(null); }}
          onCancel={() => { setIsModalOpen(false); setEditingPartner(null); }}
        />
      </Modal>
    </div>
  );
};

export default Partners;
