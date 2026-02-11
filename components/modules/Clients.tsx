
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Input, Modal, Badge, ConfirmModal, Select } from '../ui';
import { Module } from '../../App';

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button 
      onClick={handleCopy} 
      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors flex items-center justify-center shrink-0"
      title="Копировать"
    >
      <span className="material-icons-round text-sm">{copied ? 'check' : 'content_copy'}</span>
    </button>
  );
};

interface ClientsProps {
  profile: any; 
  setActiveModule: (m: Module) => void; 
  onNavigateToObject: (id: string) => void;
  refreshTrigger?: number; // Новый проп
}

const Clients: React.FC<ClientsProps> = ({ profile, setActiveModule, onNavigateToObject, refreshTrigger = 0 }) => {
  const [clients, setClients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewingClient, setViewingClient] = useState<any>(null);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [deleteModal, setDeleteModal] = useState<{open: boolean, id: string | null}>({ open: false, id: null });
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const [formData, setFormData] = useState({
    name: '',
    type: 'person' as 'person' | 'company',
    contact_person: '',
    contact_position: '',
    phone: '',
    email: '',
    requisites: '',
    comment: '',
    manager_id: profile?.id || ''
  });

  const canManage = profile?.role === 'admin' || profile?.role === 'director' || profile?.role === 'manager';

  const fetchData = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*, manager:profiles!fk_clients_manager(full_name), objects!fk_objects_client(id, name, is_deleted)')
        .is('deleted_at', null)
        .order('name');
      setClients(clientsData || []);
      
      const { data: staffData } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .is('deleted_at', null);
      setStaff(staffData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData, refreshTrigger]);

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           c.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           c.phone?.includes(searchQuery) || 
                           c.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || c.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [clients, searchQuery, typeFilter]);

  const qualifiedManagers = useMemo(() => {
    return staff.filter(s => s.role === 'manager' || s.role === 'director');
  }, [staff]);

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    setLoading(true);
    const payload = { ...formData, updated_at: new Date().toISOString(), updated_by: profile.id };
    if (!editingClient) (payload as any).created_by = profile.id;
    
    if (formData.type === 'person') {
      payload.contact_person = '';
      payload.contact_position = '';
    }
    
    const { error } = editingClient 
      ? await supabase.from('clients').update(payload).eq('id', editingClient.id) 
      : await supabase.from('clients').insert([payload]);
    
    if (!error) {
      setIsModalOpen(false);
      setEditingClient(null);
      // Явный рефетч для мгновенного обновления
      await fetchData();
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteModal.id) return;
    setLoading(true);
    await supabase.from('clients').update({ deleted_at: new Date().toISOString() }).eq('id', deleteModal.id);
    setDeleteModal({ open: false, id: null });
    setIsDetailsOpen(false);
    await fetchData();
    setLoading(false);
  };

  const openView = (client: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setViewingClient(client);
    setIsDetailsOpen(true);
  };

  const openEdit = (client: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingClient(client);
    setFormData({
      name: client.name,
      type: client.type,
      contact_person: client.contact_person || '',
      contact_position: client.contact_position || '',
      phone: client.phone || '',
      email: client.email || '',
      requisites: client.requisites || '',
      comment: client.comment || '',
      manager_id: client.manager_id || profile?.id || ''
    });
    setIsDetailsOpen(false);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingClient(null); 
    setFormData({ 
      name: '', 
      type: 'person', 
      contact_person: '',
      contact_position: '',
      phone: '', 
      email: '', 
      requisites: '', 
      comment: '', 
      manager_id: profile?.id || '' 
    });
  };

  if (!profile) return null;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f] flex items-center gap-2">
            Клиенты
            {loading && clients.length > 0 && <span className="material-icons-round animate-spin text-blue-600 text-sm">sync</span>}
          </h2>
          <p className="text-[#444746] text-sm mt-1">Управление базой заказчиков и контрагентов</p>
        </div>
        <Button onClick={() => { 
          resetForm();
          setIsModalOpen(true); 
        }} icon="person_add">Добавить клиента</Button>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.length === 0 && !loading ? (
            <div className="col-span-full py-20 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
               <p className="text-slate-400 italic">Клиенты не найдены</p>
            </div>
        ) : (
          filteredClients.map(client => {
            const activeObjects = client.objects?.filter((o: any) => !o.is_deleted) || [];
            return (
              <div 
                key={client.id} 
                onClick={() => { setViewingClient(client); setIsDetailsOpen(true); }} 
                className="bg-white rounded-[28px] border border-[#e1e2e1] p-6 cursor-pointer hover:border-[#005ac1] hover:shadow-md transition-all group flex flex-col justify-between min-h-[220px]"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <Badge color={client.type === 'company' ? 'emerald' : 'blue'}>
                      {client.type === 'company' ? 'Компания' : 'Физлицо'}
                    </Badge>
                    
                    <div className="flex items-center gap-2">
                      {activeObjects.length > 0 && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-[#005ac1] bg-[#d3e4ff] px-2 py-0.5 rounded-full">
                          <span className="material-icons-round text-xs">home_work</span>
                          {activeObjects.length}
                        </div>
                      )}
                      
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => openView(client, e)} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-all" title="Просмотр">
                          <span className="material-icons-round text-lg">visibility</span>
                        </button>
                        {canManage && (
                          <>
                            <button onClick={(e) => openEdit(client, e)} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-all" title="Редактировать">
                              <span className="material-icons-round text-lg">edit</span>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setDeleteModal({ open: true, id: client.id }); }} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-red-600 flex items-center justify-center transition-all" title="Удалить">
                              <span className="material-icons-round text-lg">delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <h4 className="text-xl font-medium text-[#1c1b1f] mb-1 group-hover:text-[#005ac1] transition-colors line-clamp-2">{client.name}</h4>
                  {client.type === 'company' && client.contact_person && (
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter truncate mb-4">Отв: {client.contact_person}</p>
                  )}
                  
                  <div className="space-y-2 mb-6">
                    {client.phone && (
                      <div className="flex items-center gap-2 text-sm text-[#444746]">
                        <span className="material-icons-round text-base opacity-50">phone</span>
                        {client.phone}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#f2f3f5] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                      {client.manager?.full_name?.charAt(0) || '?'}
                    </div>
                    <span className="text-xs text-[#444746]">{client.manager?.full_name?.split(' ')[0] || 'Нет менеджера'}</span>
                  </div>
                  <span className="material-icons-round text-[#c4c7c5] group-hover:text-[#005ac1] transition-all">chevron_right</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} title="Информация о клиенте">
        {viewingClient && (
          <div className="space-y-6">
            <div className="min-w-0">
              <h3 className="text-2xl font-medium text-[#1c1b1f] leading-tight break-words">{viewingClient.name}</h3>
              <p className="text-sm text-[#444746] mt-1">{viewingClient.type === 'company' ? 'Юридическое лицо' : 'Частное лицо'}</p>
            </div>
            {viewingClient.type === 'company' && (viewingClient.contact_person || viewingClient.contact_position) && (
              <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100/50 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-sm">
                  <span className="material-icons-round text-2xl">account_circle</span>
                </div>
                <div className="min-w-0 flex-grow">
                  <p className="text-[10px] font-bold text-blue-400 uppercase mb-0.5 tracking-widest">Контактное лицо</p>
                  <p className="text-sm font-bold text-blue-900 leading-tight">{viewingClient.contact_person || 'Не указано'}</p>
                </div>
              </div>
            )}
            <Button onClick={() => setIsDetailsOpen(false)} className="w-full h-12" variant="tonal">Закрыть</Button>
          </div>
        )}
      </Modal>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingClient(null); }} 
        title={editingClient ? "Редактирование клиента" : "Новый клиент"}
      >
        <form onSubmit={handleCreateOrUpdate} className="space-y-5">
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
              options={[{ value: '', label: 'Не выбран' }, ...qualifiedManagers.map(s => ({ value: s.id, label: s.full_name }))]}
              icon="support_agent"
            />
          </div>
          <Button type="submit" className="w-full h-14" loading={loading} icon="save">
            {editingClient ? 'Сохранить изменения' : 'Создать клиента'}
          </Button>
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, id: null })}
        onConfirm={handleDelete}
        title="Удаление клиента"
        message="Вы уверены? Клиент будет перенесен в корзину."
        loading={loading}
      />
    </div>
  );
};

export default Clients;
