
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Button, Input, Modal, ConfirmModal, Select, Toast, Drawer } from '../ui';
import { Module } from '../../App';

// Sub-components
import { ClientList } from './Clients/ClientList';
import { ClientForm } from './Clients/modals/ClientForm';
import { ClientDetails } from './Clients/modals/ClientDetails';

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
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Modals state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'details' | 'none'>('none');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [deleteModal, setDeleteModal] = useState<{open: boolean, id: string | null}>({ open: false, id: null });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const canManage = profile?.role === 'admin' || profile?.role === 'director' || profile?.role === 'manager';

  // --- QUERIES ---

  const { data: clients = [], isLoading: isClientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('*, manager:profiles!fk_clients_manager(full_name), objects!fk_objects_client(id, name, is_deleted)')
        .is('deleted_at', null)
        .order('name');
      return data || [];
    },
    enabled: !!profile?.id
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .is('deleted_at', null);
      return data || [];
    },
    staleTime: 1000 * 60 * 5
  });

  // Deep Linking: Open details if ID provided
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
    return clients.filter((c: any) => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           c.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           c.phone?.includes(searchQuery) || 
                           c.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || c.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [clients, searchQuery, typeFilter]);

  const handleDelete = async () => {
    if (!deleteModal.id) return;
    // setLoading(true); // handled by mutation usually, but here we just wait
    const { error } = await supabase.from('clients').update({ deleted_at: new Date().toISOString() }).eq('id', deleteModal.id);
    
    if (!error) {
        setToast({ message: 'Клиент удален', type: 'success' });
        setDeleteModal({ open: false, id: null });
        setModalMode('none');
        queryClient.invalidateQueries({ queryKey: ['clients'] });
    } else {
        setToast({ message: 'Ошибка при удалении', type: 'error' });
    }
    // setLoading(false);
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
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f]">Клиенты</h2>
          <p className="text-[#444746] text-sm mt-1">Управление базой заказчиков и контрагентов</p>
        </div>
        <Button onClick={() => { setSelectedClient(null); setModalMode('create'); }} icon="person_add">Добавить клиента</Button>
      </div>

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
              { value: 'person', label: 'Физлица' },
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

      {/* --- MODALS --- */}

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
                setToast({ message: 'Успешно сохранено', type: 'success' });
                queryClient.invalidateQueries({ queryKey: ['clients'] });
            }}
        />
      </Modal>

      {/* CHANGED: Client Details is now a Drawer */}
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
