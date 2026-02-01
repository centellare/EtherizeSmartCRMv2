
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Input, Modal, Badge, Select } from '../ui';
import ObjectWorkflow from './ObjectWorkflow';

const STAGES_MAP: Record<string, string> = {
  'negotiation': 'Переговоры',
  'design': 'Проектирование',
  'logistics': 'Логистика',
  'assembly': 'Сборка',
  'mounting': 'Монтаж',
  'commissioning': 'Пусконаладка',
  'programming': 'Программирование',
  'support': 'Поддержка'
};

const STATUS_MAP: Record<string, string> = {
  'in_work': 'В работе',
  'on_pause': 'На паузе',
  'review_required': 'На проверку',
  'frozen': 'Заморожен',
  'completed': 'Завершен'
};

interface ObjectsProps {
  profile: any;
  initialObjectId?: string | null;
  initialStageId?: string | null;
  onClearInitialId?: () => void;
}

const Objects: React.FC<ObjectsProps> = ({ profile, initialObjectId, initialStageId, onClearInitialId }) => {
  const [objects, setObjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(initialObjectId || null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    client_id: '',
    responsible_id: '',
    comment: ''
  });

  const fetchData = async () => {
    if (!profile?.id) return;
    setLoading(true);
    
    const { data: objectsData } = await supabase
      .from('objects')
      .select('*, client:clients(name), responsible:profiles!responsible_id(full_name)')
      .is('is_deleted', false)
      .order('created_at', { ascending: false });
    
    setObjects(objectsData || []);

    const [{ data: cData }, { data: sData }] = await Promise.all([
      supabase.from('clients').select('id, name, manager_id').is('deleted_at', null).order('name'),
      supabase.from('profiles').select('id, full_name, role').is('deleted_at', null).order('full_name')
    ]);
    
    setClients(cData || []);
    setStaff(sData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [profile?.id]);

  useEffect(() => {
    if (initialObjectId) {
      setSelectedObjectId(initialObjectId);
    }
  }, [initialObjectId]);

  const handleCreateObject = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('objects').insert([{
      ...formData,
      created_by: profile.id,
      updated_by: profile.id,
      current_stage: 'negotiation',
      current_status: 'in_work'
    }]);

    if (!error) {
      setIsModalOpen(false);
      setFormData({ name: '', address: '', client_id: '', responsible_id: '', comment: '' });
      fetchData();
    }
    setLoading(false);
  };

  const filteredObjects = useMemo(() => {
    return objects.filter(o => 
      o.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (o.address && o.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (o.client && o.client.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [objects, searchQuery]);

  if (selectedObjectId) {
    const selectedObject = objects.find(o => o.id === selectedObjectId);
    if (selectedObject) {
      return (
        <ObjectWorkflow 
          object={selectedObject} 
          profile={profile} 
          initialStageId={initialStageId}
          onBack={() => {
            setSelectedObjectId(null);
            if (onClearInitialId) onClearInitialId();
            fetchData();
          }} 
        />
      );
    }
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f]">Объекты</h2>
          <p className="text-slate-500 text-sm mt-1">Управление проектами и этапами работ</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} icon="add_business">Создать объект</Button>
      </div>

      <div className="mb-8 bg-white p-4 rounded-2xl border border-[#e1e2e1]">
        <Input 
          placeholder="Поиск по названию, адресу или клиенту..." 
          value={searchQuery} 
          onChange={(e: any) => setSearchQuery(e.target.value)} 
          icon="search"
        />
      </div>

      {loading && objects.length === 0 ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredObjects.map(obj => (
            <div 
              key={obj.id} 
              onClick={() => setSelectedObjectId(obj.id)}
              className="bg-white rounded-[28px] border border-[#e1e2e1] p-6 cursor-pointer hover:border-[#005ac1] hover:shadow-md transition-all group flex flex-col justify-between min-h-[220px]"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <Badge color={
                    obj.current_status === 'completed' ? 'emerald' : 
                    obj.current_status === 'on_pause' ? 'amber' : 
                    obj.current_status === 'frozen' ? 'slate' : 'blue'
                  }>
                    {STATUS_MAP[obj.current_status] || obj.current_status?.toUpperCase()}
                  </Badge>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {STAGES_MAP[obj.current_stage] || obj.current_stage}
                  </span>
                </div>
                <h4 className="text-xl font-medium text-[#1c1b1f] mb-2 group-hover:text-[#005ac1] transition-colors line-clamp-2">{obj.name}</h4>
                <p className="text-sm text-slate-500 mb-4 flex items-center gap-1">
                  <span className="material-icons-round text-base">location_on</span>
                  {obj.address || 'Адрес не указан'}
                </p>
              </div>
              <div className="pt-4 border-t border-[#f2f3f5] flex items-center justify-between">
                <div className="flex flex-col">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Клиент</p>
                  <p className="text-xs font-medium text-slate-700 truncate max-w-[150px]">{obj.client?.name || 'Неизвестен'}</p>
                </div>
                <span className="material-icons-round text-[#c4c7c5] group-hover:text-[#005ac1] transition-all">arrow_forward</span>
              </div>
            </div>
          ))}
          {filteredObjects.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-[32px] border border-dashed border-slate-200">
              <span className="material-icons-round text-5xl text-slate-200 mb-4">home_work</span>
              <p className="text-slate-400 font-medium">Объекты не найдены</p>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Новый объект">
        <form onSubmit={handleCreateObject} className="space-y-4">
          <Input label="Название объекта" required value={formData.name} onChange={(e: any) => setFormData({...formData, name: e.target.value})} icon="business" />
          <Input label="Адрес" value={formData.address} onChange={(e: any) => setFormData({...formData, address: e.target.value})} icon="place" />
          <Select 
            label="Клиент" 
            required 
            value={formData.client_id} 
            onChange={(e: any) => setFormData({...formData, client_id: e.target.value})}
            options={[{ value: '', label: 'Выберите клиента' }, ...clients.map(c => ({ value: c.id, label: c.name }))]}
            icon="person"
          />
          <Select 
            label="Ответственный менеджер" 
            required 
            value={formData.responsible_id} 
            onChange={(e: any) => setFormData({...formData, responsible_id: e.target.value})}
            options={[{ value: '', label: 'Выберите ответственного' }, ...staff.map(s => ({ value: s.id, label: s.full_name }))]}
            icon="support_agent"
          />
          <div className="w-full">
            <label className="block text-xs font-medium text-[#444746] mb-1.5 ml-1">Комментарий</label>
            <textarea 
              className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm outline-none focus:border-blue-500 shadow-inner" 
              rows={3} 
              value={formData.comment} 
              onChange={(e) => setFormData({...formData, comment: e.target.value})} 
            />
          </div>
          <Button type="submit" className="w-full h-14" loading={loading} icon="save">Создать объект</Button>
        </form>
      </Modal>
    </div>
  );
};

export default Objects;
