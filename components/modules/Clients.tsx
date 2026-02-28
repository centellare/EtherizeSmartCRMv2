import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Button, Input, Modal, ConfirmModal, Select, Drawer, useToast } from '../ui';
import { Module } from '../../App';
import { useClients } from '../../hooks/useClients';
import { filterClients } from '../../lib/clientUtils';

// Sub-components
import { ClientList } from './Clients/ClientList';
import { ClientForm } from './Clients/modals/ClientForm';
import { ClientDetails } from './Clients/modals/ClientDetails';
import { ClientStats } from './Clients/ClientStats';

interface ClientsProps {
  profile: any;
  setActiveModule: (m: Module) => void;
  onNavigateToObject: (id: string) => void;
  onAddObject: (clientId: string) => void;
  initialClientId?: string | null;
}

const Clients: React.FC<ClientsProps> = ({ 
  profile, setActiveModule, onNavigateToObject, onAddObject, initialClientId 
}) => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'list' | 'stats'>('list');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'details' | 'none'>('none');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [deleteModal, setDeleteModal] = useState<{open: boolean, id: string | null}>({ open: false, id: null });

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const canManage = profile?.role === 'admin' || profile?.role === 'director' || profile?.role === 'manager';

  // --- QUERIES ---

  const { clients, isLoading: isClientsLoading, deleteClient } = useClients(profile?.id);

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .is('deleted_at', null)
        .in('role', ['admin', 'director', 'manager', 'specialist', 'storekeeper']);
      return data || [];
    },
    staleTime: 1000 * 60 * 5
  });

  useEffect(() => {
    if (initialClientId && clients.length > 0) {
      const target = clients.find((c: any) => c.id === initialClientId);
      if (target) {
        setSelectedClient(target);
        setModalMode('details');
      }
    }
  }, [initialClientId, clients]);

  const filteredClients = useMemo(() => {
    return filterClients(clients, searchQuery, typeFilter);
  }, [clients, searchQuery, typeFilter]);

  const handleDelete = async () => {
    if (!deleteModal.id) return;
    await deleteClient.mutateAsync(deleteModal.id);
    setDeleteModal({ open: false, id: null });
    setModalMode('none');
  };

  const handleCloseModal = () => {
    setModalMode('none');
    if (initialClientId) {
      window.location.hash = 'clients';
    }
  };

  if (!profile) return null;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f]">Клиенты</h2>
          <p className="text-[#444746] text-sm mt-1">Управление базой заказчиков и контрагентов</p>
        </div>
        <Button onClick={() => { setSelectedClient(null); setModalMode('create'); }} icon="person_add">Добавить клиента</Button>
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
          <div className="flex flex-col md:flex-row gap-4 mb-8 bg-white p-4 rounded-2xl border border-[#e1e2e1]">
            <div className="flex-grow">
              <Input 
                placeholder="Поиск по имени, контактному лицу, телефону или email..." 
                value={searchQuery} 
                onChange={(e: any) => setSearchQuery(e.target.value)} 
                icon="search"
              />
            </div>
            <div className="w-full md:w-48">
              <Select 
                value={typeFilter} 
                onChange={(e: any) => setTypeFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'Все типы' },
                  { value: 'person', label: 'Физлица' }, // Исправлено с 'individual' на 'person' 
                  { value: 'company', label: 'Компании' }
                ]}
              />
            </div>
          </div>

          {isClientsLoading ? (
            <div className="flex justify-center py-20">
               <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : (
            <ClientList 
              clients={filteredClients}
              canManage={canManage}
              onView={(client) => { setSelectedClient(client); setModalMode('details'); }}
              onEdit={(client) => { setSelectedClient(client); setModalMode('edit'); }}
              onDelete={(id) => setDeleteModal({ open: true, id })}
              onNavigateToObject={onNavigateToObject}
            />
          )}
        </>
      ) : (
        <ClientStats clients={clients} />
      )}

      <Modal 
        isOpen={modalMode === 'create' || modalMode === 'edit'} 
        onClose={handleCloseModal} 
        title={modalMode === 'edit' ? "Редактирование клиента" : "Новый клиент"}
      >
        <ClientForm 
            mode={modalMode as 'create' | 'edit'}
            initialData={selectedClient}
            staff={staff}
            profile={profile}
            onSuccess={() => {
                handleCloseModal();
                toast.success('Успешно сохранено');
                queryClient.invalidateQueries({ queryKey: ['clients'] });
            }}
        />
      </Modal>

      <Drawer isOpen={modalMode === 'details'} onClose={handleCloseModal} title="Информация о клиенте">
        <ClientDetails 
            client={selectedClient} 
            onClose={handleCloseModal} 
            onNavigateToObject={onNavigateToObject}
            onAddObject={onAddObject}
        />
      </Drawer>

      <ConfirmModal 
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, id: null })}
        onConfirm={handleDelete}
        title="Удаление клиента"
        message="Вы уверены? Клиент будет перенесен в корзину."
        loading={false}
      />
    </div>
  );
};

export default Clients;