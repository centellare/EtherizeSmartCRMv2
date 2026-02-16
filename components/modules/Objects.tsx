
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Input, Modal, Select, ConfirmModal, Toast } from '../ui';
import ObjectWorkflow from './ObjectWorkflow';

// Sub-components
import { ObjectList } from './Objects/ObjectList';
import { ObjectForm } from './Objects/modals/ObjectForm';
import { ObjectDetails } from './Objects/modals/ObjectDetails';

const STATUS_MAP: Record<string, string> = {
  'in_work': 'В работе', 'on_pause': 'На паузе', 'review_required': 'На проверку', 'frozen': 'Заморожен', 'completed': 'Завершен'
};

interface ObjectsProps {
  profile: any; 
  initialObjectId?: string | null; 
  initialStageId?: string | null; 
  initialClientId?: string | null; 
  onClearInitialId?: () => void;
}

const Objects: React.FC<ObjectsProps> = ({ profile, initialObjectId, initialStageId, initialClientId, onClearInitialId }) => {
  const [objects, setObjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(initialObjectId || null);
  
  // Modals
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'details' | 'none'>('none');
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [responsibleFilter, setResponsibleFilter] = useState('all');

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Update: Managers allowed to create objects
  const canCreate = profile?.role === 'admin' || profile?.role === 'director' || profile?.role === 'manager';

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
        if (payload.eventType === 'INSERT') {
          const newObj = await fetchSingleObject(payload.new.id);
          if (newObj && !newObj.is_deleted) {
            setObjects(prev => [newObj, ...prev]);
          }
        } else if (payload.eventType === 'UPDATE') {
           if (payload.new.is_deleted) {
             setObjects(prev => prev.filter(o => o.id !== payload.new.id));
           } else {
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

  useEffect(() => { 
      if (initialObjectId) setSelectedObjectId(initialObjectId); 
  }, [initialObjectId]);

  // Handle Initial Client ID for Create Mode
  useEffect(() => {
      if (initialClientId && modalMode === 'none') {
          setSelectedObject(null);
          setModalMode('create');
      }
  }, [initialClientId]);

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

  const handleCloseModal = () => {
      setModalMode('none');
      if (onClearInitialId) onClearInitialId();
  };

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
        {canCreate && <Button onClick={() => { setSelectedObject(null); setModalMode('create'); }} icon="add_business">Создать объект</Button>}
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
        <ObjectList 
            objects={filteredObjects}
            profile={profile}
            onSelect={(id) => setSelectedObjectId(id)}
            onView={(obj) => { setSelectedObject(obj); setModalMode('details'); }}
            onEdit={(obj) => { setSelectedObject(obj); setModalMode('edit'); }}
            onDelete={(id) => setDeleteConfirm({ open: true, id })}
        />
      )}

      {/* --- MODALS --- */}

      <Modal isOpen={modalMode === 'details'} onClose={() => setModalMode('none')} title="Информация об объекте">
        <ObjectDetails object={selectedObject} onClose={() => setModalMode('none')} />
      </Modal>

      <Modal isOpen={modalMode === 'create' || modalMode === 'edit'} onClose={handleCloseModal} title={modalMode === 'edit' ? "Редактирование объекта" : "Новый объект"}>
        <ObjectForm 
            mode={modalMode as 'create' | 'edit'}
            initialData={selectedObject}
            clients={clients}
            staff={staff}
            profile={profile}
            initialClientId={initialClientId}
            onSuccess={() => {
                handleCloseModal();
                setToast({ message: modalMode === 'edit' ? 'Объект обновлен' : 'Объект создан', type: 'success' });
                fetchData(true);
            }}
        />
      </Modal>

      <ConfirmModal isOpen={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, id: null })} onConfirm={handleDeleteConfirm} title="Удаление" message="Объект и все связанные задачи/финансы будут перемещены в корзину." confirmVariant="danger" loading={loading} />
    </div>
  );
};

export default Objects;
