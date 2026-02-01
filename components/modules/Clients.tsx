
import React, { useState, useEffect, useMemo } from 'react';
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

const Clients: React.FC<{ profile: any; setActiveModule: (m: Module) => void; onNavigateToObject: (id: string) => void }> = ({ profile, setActiveModule, onNavigateToObject }) => {
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

  const fetchData = async () => {
    if (!profile?.id) return;
    setLoading(true);
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
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile?.id]);

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

  // Только менеджеры и директора могут быть ответственными за клиента
  const qualifiedManagers = useMemo(() => {
    return staff.filter(s => s.role === 'manager' || s.role === 'director');
  }, [staff]);

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    setLoading(true);
    const payload = { ...formData, updated_at: new Date().toISOString(), updated_by: profile.id };
    if (!editingClient) (payload as any).created_by = profile.id;
    
    // Для физлиц очищаем контактные данные
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
      fetchData();
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteModal.id) return;
    setLoading(true);
    await supabase.from('clients').update({ deleted_at: new Date().toISOString() }).eq('id', deleteModal.id);
    setDeleteModal({ open: false, id: null });
    setIsDetailsOpen(false);
    fetchData();
    setLoading(false);
  };

  const openEdit = (client: any) => {
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
          <h2 className="text-3xl font-medium text-[#1c1b1f]">Клиенты</h2>
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
        {filteredClients.map(client => {
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
                  {activeObjects.length > 0 && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-[#005ac1] bg-[#d3e4ff] px-2 py-0.5 rounded-full">
                      <span className="material-icons-round text-xs">home_work</span>
                      {activeObjects.length}
                    </div>
                  )}
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
        })}
      </div>

      <Modal isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} title="Информация о клиенте">
        {viewingClient && (
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div className="min-w-0 flex-grow pr-4">
                <h3 className="text-2xl font-medium text-[#1c1b1f] leading-tight break-words">{viewingClient.name}</h3>
                <p className="text-sm text-[#444746] mt-1">{viewingClient.type === 'company' ? 'Юридическое лицо' : 'Частное лицо'}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEdit(viewingClient)} className="p-2.5 rounded-full hover:bg-blue-50 text-[#005ac1] transition-colors">
                  <span className="material-icons-round">edit</span>
                </button>
                <button onClick={() => setDeleteModal({ open: true, id: viewingClient.id })} className="p-2.5 rounded-full hover:bg-red-50 text-[#ba1a1a] transition-colors">
                  <span className="material-icons-round">delete</span>
                </button>
              </div>
            </div>

            {viewingClient.type === 'company' && (viewingClient.contact_person || viewingClient.contact_position) && (
              <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100/50 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-sm">
                  <span className="material-icons-round text-2xl">account_circle</span>
                </div>
                <div className="min-w-0 flex-grow">
                  <p className="text-[10px] font-bold text-blue-400 uppercase mb-0.5 tracking-widest">Контактное лицо</p>
                  <p className="text-sm font-bold text-blue-900 leading-tight">{viewingClient.contact_person || 'Не указано'}</p>
                  {viewingClient.contact_position && (
                    <p className="text-xs font-medium text-blue-700 mt-0.5">{viewingClient.contact_position}</p>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <div className="p-4 bg-white rounded-2xl border border-[#e1e2e1] flex justify-between items-center group/field">
                <div className="min-w-0 flex-grow">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Телефон</p>
                  <p className="text-sm font-medium">{viewingClient.phone || '—'}</p>
                </div>
                {viewingClient.phone && <CopyButton text={viewingClient.phone} />}
              </div>
              <div className="p-4 bg-white rounded-2xl border border-[#e1e2e1] flex justify-between items-center group/field">
                <div className="min-w-0 flex-grow pr-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Email</p>
                  <p className="text-sm font-medium truncate">{viewingClient.email || '—'}</p>
                </div>
                {viewingClient.email && <CopyButton text={viewingClient.email} />}
              </div>
            </div>

            {viewingClient.requisites && (
              <div className="p-4 bg-white rounded-2xl border border-[#e1e2e1]">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Реквизиты</p>
                  <CopyButton text={viewingClient.requisites} />
                </div>
                <div className="p-3 bg-[#f7f9fc] rounded-xl border border-slate-100">
                  <p className="text-sm text-[#444746] whitespace-pre-wrap leading-relaxed select-all">
                    {viewingClient.requisites}
                  </p>
                </div>
              </div>
            )}

            {viewingClient.objects && viewingClient.objects.filter((o:any) => !o.is_deleted).length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 ml-1">Объекты в работе</p>
                <div className="space-y-2">
                  {viewingClient.objects.filter((o:any) => !o.is_deleted).map((obj: any) => (
                    <div 
                      key={obj.id}
                      onClick={() => onNavigateToObject(obj.id)}
                      className="flex items-center justify-between p-4 bg-[#f7f9fc] rounded-2xl hover:bg-[#d3e4ff] cursor-pointer transition-colors border border-transparent hover:border-[#005ac1] group/obj"
                    >
                      <div className="flex items-center gap-3">
                        <span className="material-icons-round text-slate-400 group-hover/obj:text-[#005ac1]">home_work</span>
                        <span className="text-sm font-medium">{obj.name}</span>
                      </div>
                      <span className="material-icons-round text-[#005ac1] opacity-0 group-hover/obj:opacity-100 transition-opacity">arrow_forward</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {viewingClient.comment && (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <p className="text-[10px] font-bold text-amber-700 uppercase mb-1">Заметка</p>
                <p className="text-sm text-amber-900 italic break-words">{viewingClient.comment}</p>
              </div>
            )}
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

          {formData.type === 'company' && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-2">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Представитель компании</p>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Input label="ФИО контактного лица" value={formData.contact_person} onChange={(e: any) => setFormData({...formData, contact_person: e.target.value})} icon="account_box" placeholder="Напр: Иванов Иван" />
                 <Input label="Должность" value={formData.contact_position} onChange={(e: any) => setFormData({...formData, contact_position: e.target.value})} icon="work_outline" placeholder="Напр: Гендиректор" />
               </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input label="Телефон" value={formData.phone} onChange={(e: any) => setFormData({...formData, phone: e.target.value})} icon="phone" />
            <Input label="Email" type="email" value={formData.email} onChange={(e: any) => setFormData({...formData, email: e.target.value})} icon="alternate_email" />
          </div>
          <div className="w-full">
            <label className="block text-xs font-medium text-[#444746] mb-1.5 ml-1">Реквизиты</label>
            <textarea 
              className="w-full bg-transparent border border-[#747775] rounded-xl px-4 py-3 text-base text-[#1c1b1f] outline-none transition-all focus:border-[#005ac1] focus:ring-1 focus:ring-[#005ac1] min-h-[120px]"
              value={formData.requisites}
              onChange={(e) => setFormData({...formData, requisites: e.target.value})}
              placeholder="ИНН, КПП, банковские реквизиты..."
            />
          </div>
          <div className="w-full">
            <label className="block text-xs font-medium text-[#444746] mb-1.5 ml-1">Комментарий</label>
            <textarea 
              className="w-full bg-transparent border border-[#747775] rounded-xl px-4 py-3 text-base text-[#1c1b1f] outline-none transition-all focus:border-[#005ac1] focus:ring-1 focus:ring-[#005ac1] min-h-[80px]"
              value={formData.comment}
              onChange={(e) => setFormData({...formData, comment: e.target.value})}
              placeholder="Дополнительная информация о клиенте..."
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
