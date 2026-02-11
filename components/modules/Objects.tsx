
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Input, Modal, Badge, Select, ConfirmModal, Toast } from '../ui';
import ObjectWorkflow from './ObjectWorkflow';

const STAGES_MAP: Record<string, string> = {
  'negotiation': 'Переговоры', 'design': 'Проектирование', 'logistics': 'Логистика', 'assembly': 'Сборка', 'mounting': 'Монтаж', 'commissioning': 'Пусконаладка', 'programming': 'Программирование', 'support': 'Поддержка'
};

const STATUS_MAP: Record<string, string> = {
  'in_work': 'В работе', 'on_pause': 'На паузе', 'review_required': 'На проверку', 'frozen': 'Заморожен', 'completed': 'Завершен'
};

interface ObjectsProps {
  profile: any; initialObjectId?: string | null; initialStageId?: string | null; onClearInitialId?: () => void;
}

const Objects: React.FC<ObjectsProps> = ({ profile, initialObjectId, initialStageId, onClearInitialId }) => {
  const [objects, setObjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(initialObjectId || null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingDetails, setViewingDetails] = useState<any>(null);
  const [editingObject, setEditingObject] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  
  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [responsibleFilter, setResponsibleFilter] = useState('all');

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  const [formData, setFormData] = useState({ name: '', address: '', client_id: '', responsible_id: '', comment: '' });

  const canManageAll = profile?.role === 'admin' || profile?.role === 'director';

  const fetchSingleObject = async (id: string) => {
    const { data } = await supabase
      .from('objects')
      .select('*, client:clients(name), responsible:profiles!responsible_id(full_name)')
      .eq('id', id)
      .single();
    return data;
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!profile?.id) return;
    
    const isInitial = objects.length === 0 && !silent;
    if (isInitial) setLoading(true);

    try {
      const { data: objectsData } = await supabase.from('objects').select('*, client:clients(name), responsible:profiles!responsible_id(full_name)').is('is_deleted', false).order('created_at', { ascending: false });
      if (objectsData) setObjects(objectsData);
      
      const [{ data: cData }, { data: sData }] = await Promise.all([
        supabase.from('clients').select('id, name, manager_id').is('deleted_at', null).order('name'),
        supabase.from('profiles').select('id, full_name, role').is('deleted_at', null).order('full_name')
      ]);
      if (cData) setClients(cData);
      if (sData) setStaff(sData);
    } catch (err) {
      console.error('Objects fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, objects.length]);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('objects_smart_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'objects' }, async (payload) => {
        // Smart Realtime: Update local state instead of refetching all
        if (payload.eventType === 'INSERT') {
          const newObj = await fetchSingleObject(payload.new.id);
          if (newObj && !newObj.is_deleted) {
            setObjects(prev => [newObj, ...prev]);
          }
        } else if (payload.eventType === 'UPDATE') {
           if (payload.new.is_deleted) {
             setObjects(prev => prev.filter(o => o.id !== payload.new.id));
           } else {
             // Optimistically fetch just the one updated row with joins
             const updatedObj = await fetchSingleObject(payload.new.id);
             if (updatedObj) {
               setObjects(prev => prev.map(o => o.id === updatedObj.id ? updatedObj : o));
             }
           }
        } else if (payload.eventType === 'DELETE') {
           setObjects(prev => prev.filter(o => o.id !== payload.old.id));
        }
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  useEffect(() => { if (initialObjectId) setSelectedObjectId(initialObjectId); }, [initialObjectId]);

  const handleOpenView = (obj: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setViewingDetails(obj);
  };

  const handleOpenEdit = (obj: any, e: React.MouseEvent) => {
    e.stopPropagation(); setEditingObject(obj);
    setFormData({ name: obj.name, address: obj.address || '', client_id: obj.client_id, responsible_id: obj.responsible_id, comment: obj.comment || '' });
    setIsModalOpen(true);
  };

  const handleOpenDelete = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setDeleteConfirm({ open: true, id }); };

  const handleSaveObject = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const payload = { ...formData, updated_by: profile.id, updated_at: new Date().toISOString() };
    try {
      let error;
      if (editingObject) error = (await supabase.from('objects').update(payload).eq('id', editingObject.id)).error;
      else error = (await supabase.from('objects').insert([{ ...payload, created_by: profile.id, current_stage: 'negotiation', current_status: 'in_work' }])).error;
      
      if (!error) {
        setToast({ message: editingObject ? 'Объект обновлен' : 'Объект создан', type: 'success' });
        setIsModalOpen(false); setEditingObject(null);
      } else {
        setToast({ message: 'Ошибка при сохранении', type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    setLoading(true);
    const now = new Date().toISOString();
    try {
      await supabase.from('objects').update({ is_deleted: true, deleted_at: now, updated_by: profile.id }).eq('id', deleteConfirm.id);
      await supabase.from('tasks').update({ is_deleted: true, deleted_at: now }).eq('object_id', deleteConfirm.id);
      await supabase.from('transactions').update({ deleted_at: now }).eq('object_id', deleteConfirm.id);
      setToast({ message: 'Объект и связанные данные перенесены в корзину', type: 'success' });
      setDeleteConfirm({ open: false, id: null }); 
      // State updates automatically via Realtime
    } catch (err) { setToast({ message: 'Ошибка при удалении', type: 'error' }); }
    setLoading(false);
  };

  const filteredObjects = useMemo(() => {
    return objects.filter(o => {
      const matchesSearch = o.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (o.address && o.address.toLowerCase().includes(searchQuery.toLowerCase())) || 
                           (o.client && o.client.name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || o.current_status === statusFilter;
      const matchesResponsible = responsibleFilter === 'all' || o.responsible_id === responsibleFilter;
      
      return matchesSearch && matchesStatus && matchesResponsible;
    });
  }, [objects, searchQuery, statusFilter, responsibleFilter]);

  if (selectedObjectId) {
    const selectedObject = objects.find(o => o.id === selectedObjectId);
    if (selectedObject) return <ObjectWorkflow object={selectedObject} profile={profile} initialStageId={initialStageId} onBack={() => { setSelectedObjectId(null); if (onClearInitialId) onClearInitialId(); }} />;
  }

  return (
    <div className="animate-in fade-in duration-500">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f] flex items-center gap-3">
            Объекты
            {loading && objects.length > 0 && (
              <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full animate-pulse">
                <span className="material-icons-round text-sm">sync</span>
                ОБНОВЛЕНИЕ...
              </div>
            )}
          </h2>
          <p className="text-slate-500 text-sm mt-1">Управление проектами и этапами работ</p>
        </div>
        <Button onClick={() => { setEditingObject(null); setFormData({name:'', address:'', client_id:'', responsible_id:'', comment:''}); setIsModalOpen(true); }} icon="add_business">Создать объект</Button>
      </div>

      <div className="mb-8 bg-white p-4 rounded-3xl border border-[#e1e2e1] flex flex-col md:flex-row gap-4 shadow-sm">
        <div className="flex-grow">
          <Input placeholder="Поиск по названию или адресу..." value={searchQuery} onChange={(e: any) => setSearchQuery(e.target.value)} icon="search" />
        </div>
        <div className="w-full md:w-56">
          <Select 
            value={statusFilter} 
            onChange={(e: any) => setStatusFilter(e.target.value)}
            options={[
              { value: 'all', label: 'Все статусы' },
              ...Object.entries(STATUS_MAP).map(([val, label]) => ({ value: val, label }))
            ]}
            icon="filter_list"
          />
        </div>
        <div className="w-full md:w-64">
          <Select 
            value={responsibleFilter} 
            onChange={(e: any) => setResponsibleFilter(e.target.value)}
            options={[
              { value: 'all', label: 'Все ответственные' },
              ...staff.map(s => ({ value: s.id, label: s.full_name }))
            ]}
            icon="support_agent"
          />
        </div>
      </div>

      {loading && objects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Загрузка объектов...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredObjects.map(obj => {
            const isCritical = obj.current_status === 'review_required';
            return (
              <div 
                key={obj.id} 
                onClick={() => setSelectedObjectId(obj.id)} 
                className={`bg-white rounded-[28px] border p-6 cursor-pointer hover:shadow-lg transition-all group flex flex-col justify-between min-h-[250px] relative overflow-hidden ${
                  isCritical ? 'border-red-400 ring-2 ring-red-50' : 'border-[#e1e2e1] hover:border-[#005ac1]'
                }`}
              >
                {isCritical && (
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500 animate-pulse"></div>
                )}
                
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <Badge color={
                      obj.current_status === 'completed' ? 'emerald' : 
                      obj.current_status === 'on_pause' ? 'amber' : 
                      obj.current_status === 'review_required' ? 'red' : 'blue'
                    }>
                      {STATUS_MAP[obj.current_status] || obj.current_status?.toUpperCase()}
                    </Badge>
                    
                    <div className="flex items-center gap-1">
                      {isCritical && (
                        <span className="material-icons-round text-red-500 animate-bounce text-xl">priority_high</span>
                      )}

                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => handleOpenView(obj, e)} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-all" title="Просмотр">
                          <span className="material-icons-round text-lg">visibility</span>
                        </button>
                        {canManageAll && (
                          <>
                            <button onClick={(e) => handleOpenEdit(obj, e)} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-all" title="Редактировать">
                              <span className="material-icons-round text-lg">edit</span>
                            </button>
                            <button onClick={(e) => handleOpenDelete(obj.id, e)} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-red-600 flex items-center justify-center transition-all" title="Удалить">
                              <span className="material-icons-round text-lg">delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <h4 className="text-xl font-medium text-[#1c1b1f] mb-1 group-hover:text-[#005ac1] transition-colors leading-tight">
                    {obj.name}
                  </h4>
                  <p className="text-sm text-slate-500 mb-4 flex items-start gap-1">
                    <span className="material-icons-round text-base text-slate-400 mt-0.5">location_on</span>
                    {obj.address || 'Адрес не указан'}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#f2f3f5] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Текущий этап</p>
                      <p className="text-sm font-medium text-slate-700">{STAGES_MAP[obj.current_stage] || obj.current_stage}</p>
                    </div>
                    <span className="material-icons-round text-[#c4c7c5] group-hover:text-[#005ac1] group-hover:translate-x-1 transition-all">arrow_forward</span>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-1">
                    <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-[10px] font-bold text-blue-600 border border-blue-100">
                      {obj.responsible?.full_name?.charAt(0) || '?'}
                    </div>
                    <p className="text-xs text-slate-500 font-medium truncate">
                      <span className="text-slate-400">Отв:</span> {obj.responsible?.full_name || 'Не назначен'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Модальные окна остаются без изменений */}
      <Modal isOpen={!!viewingDetails} onClose={() => setViewingDetails(null)} title="Информация об объекте">
        {viewingDetails && (
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Название объекта</p>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                <span className="material-icons-round text-blue-500">business</span>
                <span className="text-lg font-medium text-slate-900">{viewingDetails.name}</span>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Адрес</p>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                <span className="material-icons-round text-slate-400">place</span>
                <span className="text-sm text-slate-700">{viewingDetails.address || 'Не указан'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Клиент</p>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                  <span className="material-icons-round text-slate-400">person</span>
                  <span className="text-sm text-slate-700 font-medium">{viewingDetails.client?.name || '—'}</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Ответственный</p>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                  <span className="material-icons-round text-slate-400">support_agent</span>
                  <span className="text-sm text-slate-700 font-medium">{viewingDetails.responsible?.full_name || 'Не назначен'}</span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Статус и этап</p>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge color="blue">{STATUS_MAP[viewingDetails.current_status]}</Badge>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Этап</p>
                  <p className="text-sm font-medium">{STAGES_MAP[viewingDetails.current_stage]}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Комментарий / Заметки</p>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 min-h-[100px]">
                <p className="text-sm text-slate-600 italic leading-relaxed whitespace-pre-wrap">
                  {viewingDetails.comment || 'Комментарии отсутствуют'}
                </p>
              </div>
            </div>

            <Button onClick={() => setViewingDetails(null)} className="w-full h-12" variant="tonal">Закрыть</Button>
          </div>
        )}
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingObject ? "Редактирование объекта" : "Новый объект"}>
        <form onSubmit={handleSaveObject} className="space-y-4">
          <Input label="Название объекта" required value={formData.name} onChange={(e: any) => setFormData({...formData, name: e.target.value})} icon="business" />
          <Input label="Адрес" value={formData.address} onChange={(e: any) => setFormData({...formData, address: e.target.value})} icon="place" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Клиент" required value={formData.client_id} onChange={(e: any) => setFormData({...formData, client_id: e.target.value})} options={[{ value: '', label: 'Выберите клиента' }, ...clients.map(c => ({ value: c.id, label: c.name }))]} icon="person" />
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

          <Button type="submit" className="w-full h-14" loading={loading} icon="save">{editingObject ? 'Сохранить изменения' : 'Создать объект'}</Button>
        </form>
      </Modal>

      <ConfirmModal isOpen={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, id: null })} onConfirm={handleDeleteConfirm} title="Удаление" message="Объект и все связанные задачи/финансы будут перемещены в корзину." confirmVariant="danger" loading={loading} />
    </div>
  );
};

export default Objects;
