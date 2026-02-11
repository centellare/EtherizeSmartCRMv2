
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Badge, Button, Modal, Input, Select, ConfirmModal } from '../ui';

const ROLES = [
  { value: 'admin', label: 'Администратор' },
  { value: 'director', label: 'Директор' },
  { value: 'manager', label: 'Менеджер объектов' },
  { value: 'specialist', label: 'Специалист' }
];

// Define User Role Type explicitly locally if not imported
type UserRole = 'admin' | 'director' | 'manager' | 'specialist';

const Team: React.FC<{ profile: any }> = ({ profile }) => {
  const [members, setMembers] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  
  const [formData, setFormData] = useState({ 
    full_name: '', 
    email: '', 
    role: 'specialist' as UserRole, 
    phone: '', 
    birth_date: '' 
  });

  const isAdmin = profile?.role === 'admin' || profile?.role === 'director';

  const fetchData = async () => {
    setLoading(true);
    try {
      // Получаем профили
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .is('deleted_at', null)
        .order('full_name');
      
      // Получаем активные задачи для статистики
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('assigned_to, status, deadline')
        .is('is_deleted', false)
        .eq('status', 'pending');

      setMembers(profilesData || []);
      setTasks(tasksData || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchesSearch = m.full_name.toLowerCase().includes(search.toLowerCase()) || 
                           m.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'all' || m.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [members, search, roleFilter]);

  const handleOpenCreate = () => {
    setSelectedMember(null);
    setFormData({ full_name: '', email: '', role: 'specialist', phone: '', birth_date: '' });
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (member: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedMember(member);
    setFormData({
      full_name: member.full_name || '',
      email: member.email || '',
      role: (member.role as UserRole) || 'specialist',
      phone: member.phone || '',
      birth_date: member.birth_date || ''
    });
    setIsEditModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Explicit casting to match Supabase types for Role
    const payload = {
        full_name: formData.full_name,
        role: formData.role, // This is already typed as UserRole
        phone: formData.phone,
        birth_date: formData.birth_date
    };

    if (selectedMember) {
      // Update
      const { error } = await supabase.from('profiles').update(payload).eq('id', selectedMember.id);
      
      if (!error) {
        setIsEditModalOpen(false);
        fetchData();
      }
    } else {
      // Create
      const { error } = await supabase.from('profiles').insert([{
        ...payload,
        email: formData.email,
        must_change_password: true
      }]);
      
      if (!error) {
        setIsEditModalOpen(false);
        fetchData();
      }
    }
    setLoading(false);
  };

  // ... (rest of the component remains similar but inside the closure)
  const handleDelete = async () => {
    if (!selectedMember) return;
    setLoading(true);
    const { error } = await supabase.from('profiles').update({ 
      deleted_at: new Date().toISOString() 
    }).eq('id', selectedMember.id);
    
    if (!error) {
      setIsDeleteModalOpen(false);
      fetchData();
    }
    setLoading(false);
  };

  const getUserInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getMemberStats = (memberId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const userTasks = tasks.filter(t => t.assigned_to === memberId);
    const overdue = userTasks.filter(t => t.deadline && t.deadline < today);
    return { active: userTasks.length, overdue: overdue.length };
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f]">Команда</h2>
          <p className="text-sm text-slate-500 mt-1">Всего сотрудников: {members.length}</p>
        </div>
        {isAdmin && (
          <Button onClick={handleOpenCreate} icon="person_add">Добавить сотрудника</Button>
        )}
      </div>

      <div className="bg-white p-6 rounded-[28px] border border-[#e1e2e1] mb-8 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-grow">
            <Input 
              placeholder="Поиск по имени или email..." 
              value={search} 
              onChange={(e: any) => setSearch(e.target.value)} 
              icon="search"
            />
          </div>
          <div className="w-full md:w-64">
            <Select 
              value={roleFilter} 
              onChange={(e: any) => setRoleFilter(e.target.value)}
              options={[{ value: 'all', label: 'Все роли' }, ...ROLES]}
              icon="filter_list"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredMembers.map(member => {
          const stats = getMemberStats(member.id);
          const isSelf = member.id === profile.id;

          return (
            <div key={member.id} className="bg-white rounded-[32px] border border-[#e1e2e1] p-6 hover:shadow-lg transition-all flex flex-col items-center text-center group">
              <div className="relative mb-4">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-4 border-white shadow-sm ${
                  member.role === 'admin' ? 'bg-red-50 text-red-600' :
                  member.role === 'director' ? 'bg-purple-50 text-purple-600' :
                  member.role === 'manager' ? 'bg-blue-50 text-blue-600' :
                  'bg-emerald-50 text-emerald-600'
                }`}>
                  {getUserInitials(member.full_name)}
                </div>
                {isSelf && (
                  <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center border-2 border-white" title="Это вы">
                    <span className="material-icons-round text-xs">face</span>
                  </div>
                )}
              </div>

              <h4 className="text-lg font-bold text-slate-900 leading-tight mb-1">{member.full_name}</h4>
              <p className="text-xs text-slate-400 mb-4">{member.email}</p>
              
              <div className="mb-6">
                <Badge color={
                  member.role === 'admin' ? 'red' : 
                  member.role === 'director' ? 'purple' : 
                  member.role === 'manager' ? 'blue' : 'emerald'
                }>
                  {ROLES.find(r => r.value === member.role)?.label.toUpperCase()}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full pt-4 border-t border-slate-50 mb-6">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900">{stats.active}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">В работе</span>
                </div>
                <div className="flex flex-col">
                  <span className={`text-sm font-bold ${stats.overdue > 0 ? 'text-red-500' : 'text-slate-900'}`}>{stats.overdue}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Просрочено</span>
                </div>
              </div>

              <div className="flex gap-2 w-full">
                {member.phone ? (
                  <a href={`tel:${member.phone}`} className="flex-1 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                    <span className="material-icons-round text-lg">call</span>
                  </a>
                ) : (
                  <div className="flex-1 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300">
                    <span className="material-icons-round text-lg">phone_disabled</span>
                  </div>
                )}
                
                {isAdmin && (
                  <>
                    <button 
                      onClick={(e) => handleOpenEdit(member, e)}
                      className="flex-1 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                      <span className="material-icons-round text-lg">edit</span>
                    </button>
                    {!isSelf && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedMember(member); setIsDeleteModalOpen(true); }}
                        className="flex-1 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <span className="material-icons-round text-lg">person_remove</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {filteredMembers.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
            <span className="material-icons-round text-5xl text-slate-200 mb-4">people_outline</span>
            <p className="text-slate-400 font-medium">Сотрудники не найдены</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        title={selectedMember ? "Редактирование сотрудника" : "Приглашение сотрудника"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input 
            label="ФИО сотрудника" 
            required 
            value={formData.full_name} 
            onChange={(e:any) => setFormData({...formData, full_name: e.target.value})} 
            icon="badge" 
          />
          <Input 
            label="Email" 
            type="email" 
            required 
            disabled={!!selectedMember}
            value={formData.email} 
            onChange={(e:any) => setFormData({...formData, email: e.target.value})} 
            icon="alternate_email" 
            placeholder={selectedMember ? "" : "Будет логином для входа"}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select 
              label="Роль в системе" 
              required 
              value={formData.role} 
              onChange={(e:any) => setFormData({...formData, role: e.target.value as UserRole})} 
              options={ROLES} 
              icon="verified_user" 
            />
            <Input 
              label="Дата рождения" 
              type="date" 
              value={formData.birth_date} 
              onChange={(e:any) => setFormData({...formData, birth_date: e.target.value})} 
              icon="calendar_today" 
            />
          </div>
          <Input 
            label="Телефон" 
            value={formData.phone} 
            onChange={(e:any) => setFormData({...formData, phone: e.target.value})} 
            icon="phone" 
          />
          
          <div className="pt-4">
            <Button type="submit" className="w-full h-14" loading={loading} icon="save">
              {selectedMember ? 'Сохранить изменения' : 'Создать профиль'}
            </Button>
          </div>
          {!selectedMember && (
            <p className="text-[10px] text-slate-400 italic text-center px-4">
              Пароль для нового сотрудника нужно будет установить через панель администратора Supabase Auth.
            </p>
          )}
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        onConfirm={handleDelete} 
        title="Увольнение сотрудника" 
        message={`Вы уверены, что хотите уволить сотрудника ${selectedMember?.full_name}? Доступ в систему будет закрыт, но история задач сохранится.`} 
        confirmLabel="Да, уволить"
        loading={loading}
      />
    </div>
  );
};

export default Team;
