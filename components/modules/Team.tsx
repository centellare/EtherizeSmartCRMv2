
import React, { useState, useMemo, useEffect } from 'react';
import { Badge, Button, Modal, Input, Select, ConfirmModal } from '../ui';
import { useTeamMembers, useTeamTasksStats } from '../../hooks/useTeam';
import { useTeamMutations } from '../../hooks/useTeamMutations';
import { useOnlineUsers } from '../../hooks/useOnlineUsers';
import { supabase } from '../../lib/supabase';

const ROLES = [
  { value: 'admin', label: 'Администратор' },
  { value: 'director', label: 'Директор' },
  { value: 'manager', label: 'Менеджер объектов' },
  { value: 'storekeeper', label: 'Снабжение / Финансы' },
  { value: 'specialist', label: 'Специалист' }
];

type UserRole = 'admin' | 'director' | 'manager' | 'specialist' | 'storekeeper';

const Team: React.FC<{ profile: any }> = ({ profile }) => {
  const { data: members = [], isLoading: isMembersLoading } = useTeamMembers();
  const { data: tasks = [] } = useTeamTasksStats();
  const { approveMember, blockMember, deleteMember, saveMember, uploadAvatar } = useTeamMutations();
  const onlineUsers = useOnlineUsers(profile?.id);
  
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
    birth_date: '',
    password: '',
    avatar_url: ''
  });

  const isAdmin = profile?.role === 'admin' || profile?.role === 'director';

  const pendingMembers = useMemo(() => members.filter((m: any) => m.is_approved === false), [members]);
  const activeMembers = useMemo(() => members.filter((m: any) => m.is_approved !== false), [members]);

  const filteredMembers = useMemo(() => {
    return activeMembers.filter((m: any) => {
      const matchesSearch = m.full_name.toLowerCase().includes(search.toLowerCase()) || 
                           m.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'all' || m.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [activeMembers, search, roleFilter]);

  const handleOpenCreate = () => {
    setSelectedMember(null);
    setFormData({ full_name: '', email: '', role: 'specialist', phone: '', birth_date: '', password: '', avatar_url: '' });
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
      birth_date: member.birth_date || '',
      password: '',
      avatar_url: member.avatar_url || ''
    });
    setIsEditModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    saveMember.mutate({
      id: selectedMember?.id,
      formData: {
        ...formData,
        email_changed: selectedMember ? formData.email !== selectedMember.email : false
      }
    }, {
      onSuccess: () => setIsEditModalOpen(false)
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedMember) return;

    uploadAvatar.mutate({ userId: selectedMember.id, file }, {
      onSuccess: (url) => {
        setFormData(prev => ({ ...prev, avatar_url: url }));
      }
    });
  };

  const handleDelete = async () => {
    if (!selectedMember) return;
    deleteMember.mutate(selectedMember.id, {
      onSuccess: () => setIsDeleteModalOpen(false)
    });
  };

  const getUserInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getMemberStats = (memberId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const userTasks = tasks.filter((t: any) => t.assigned_to === memberId);
    
    const overdue = userTasks.filter((t: any) => t.deadline && t.deadline < today);
    const inWork = userTasks.filter((t: any) => t.status === 'in_progress');
    const pending = userTasks.filter((t: any) => t.status === 'pending');
    
    return { 
      total: userTasks.length, 
      overdue: overdue.length,
      inWork: inWork.length,
      pending: pending.length
    };
  };

  const formatLastSeen = (dateString: string | null) => {
    if (!dateString) return 'Неизвестно';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин. назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч. назад`;
    
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  if (isMembersLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Загрузка команды...</p>
      </div>
    );
  }

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

      {/* Pending Approvals Section */}
      {isAdmin && pendingMembers.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="material-icons-round text-amber-500">warning</span>
            Ожидают подтверждения
            <Badge color="amber">{pendingMembers.length}</Badge>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingMembers.map((member: any) => (
              <div key={member.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.full_name} className="w-10 h-10 rounded-full object-cover shadow-sm border border-white" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-amber-600 font-bold shadow-sm">
                      {getUserInitials(member.full_name)}
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{member.full_name}</p>
                    <p className="text-xs text-slate-500">{member.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                   <Button variant="primary" onClick={() => approveMember.mutate(member.id)} icon="check" className="h-8 text-xs" loading={approveMember.isPending}>
                     Принять
                   </Button>
                   <Button variant="secondary" className="bg-white h-8 text-xs" onClick={() => { setSelectedMember(member); setIsDeleteModalOpen(true); }} icon="close">
                     Отклонить
                   </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredMembers.map(member => {
          const stats = getMemberStats(member.id);
          const isSelf = member.id === profile.id;
          const isOnline = onlineUsers.includes(member.id);

          return (
            <div key={member.id} className="bg-white rounded-[32px] border border-[#e1e2e1] p-6 hover:shadow-lg transition-all flex flex-col items-center text-center group relative">
              <div className="relative mb-4">
                <div className="relative">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.full_name} className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-sm" referrerPolicy="no-referrer" />
                  ) : (
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-4 border-white shadow-sm ${
                      member.role === 'admin' ? 'bg-red-50 text-red-600' :
                      member.role === 'director' ? 'bg-purple-50 text-purple-600' :
                      member.role === 'manager' ? 'bg-blue-50 text-blue-600' :
                      member.role === 'storekeeper' ? 'bg-amber-50 text-amber-600' :
                      'bg-emerald-50 text-emerald-600'
                    }`}>
                      {getUserInitials(member.full_name)}
                    </div>
                  )}
                  
                  {/* Online Indicator */}
                  <div className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-4 border-white shadow-sm ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} title={isOnline ? 'В сети' : 'Не в сети'} />
                </div>

                {isSelf && (
                  <div className="absolute -top-1 -right-1 bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center border-2 border-white" title="Это вы">
                    <span className="material-icons-round text-xs">face</span>
                  </div>
                )}
              </div>

              <h4 className="text-lg font-bold text-slate-900 leading-tight mb-1">{member.full_name}</h4>
              <p className="text-xs text-slate-400 mb-2">{member.email}</p>
              
              <div className="flex flex-col items-center gap-2 mb-4">
                <Badge color={
                  member.role === 'admin' ? 'red' : 
                  member.role === 'director' ? 'purple' : 
                  member.role === 'manager' ? 'blue' : 
                  member.role === 'storekeeper' ? 'amber' : 'emerald'
                }>
                  {ROLES.find(r => r.value === member.role)?.label.toUpperCase() || member.role}
                </Badge>
                <span className="text-[10px] text-slate-400 font-medium">
                  {isOnline ? 'В сети' : `Был: ${formatLastSeen(member.last_seen_at || member.updated_at)}`}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-y-4 gap-x-2 w-full pt-4 border-t border-slate-50 mb-6">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900">{stats.total}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Всего</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-blue-600">{stats.inWork}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">В работе</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-amber-600">{stats.pending}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Новые</span>
                </div>
                <div className="flex flex-col">
                  <span className={`text-sm font-bold ${stats.overdue > 0 ? 'text-red-500' : 'text-slate-900'}`}>{stats.overdue}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Просрочено</span>
                </div>
              </div>

              <div className="flex gap-2 w-full mt-auto">
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
                      title="Редактировать"
                    >
                      <span className="material-icons-round text-lg">edit</span>
                    </button>
                    {!isSelf && (
                      <>
                        <button 
                          onClick={(e) => { e.stopPropagation(); blockMember.mutate(member.id); }}
                          className="flex-1 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                          title="Заблокировать доступ"
                          disabled={blockMember.isPending}
                        >
                          <span className="material-icons-round text-lg">block</span>
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedMember(member); setIsDeleteModalOpen(true); }}
                          className="flex-1 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Уволить (удалить)"
                        >
                          <span className="material-icons-round text-lg">person_remove</span>
                        </button>
                      </>
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
        title={selectedMember ? "Редактирование сотрудника" : "Добавление сотрудника"}
      >
        <div className="flex flex-col items-center mb-6">
          <div className="relative group">
            {formData.avatar_url ? (
              <img src={formData.avatar_url} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-slate-50 shadow-md" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border-4 border-slate-50 shadow-md">
                <span className="material-icons-round text-4xl">person</span>
              </div>
            )}
            {selectedMember && (
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <span className="material-icons-round text-white">photo_camera</span>
                <input type="file" className="hidden" accept="image/jpeg,image/png" onChange={handleAvatarUpload} />
              </label>
            )}
          </div>
          {selectedMember && (
            <p className="text-[10px] text-slate-400 mt-2 uppercase font-bold tracking-wider">Нажмите, чтобы изменить фото (до 1МБ)</p>
          )}
        </div>

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
            value={formData.email} 
            onChange={(e:any) => setFormData({...formData, email: e.target.value})} 
            icon="alternate_email" 
            placeholder={selectedMember ? "Изменить email" : "Будет логином для входа"}
          />
          <Input 
            label="Пароль" 
            type="password" 
            required={!selectedMember}
            value={formData.password} 
            onChange={(e:any) => setFormData({...formData, password: e.target.value})} 
            icon="lock" 
            placeholder={selectedMember ? "Оставьте пустым, если не меняете" : "Обязательно для нового сотрудника"}
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
            <Button type="submit" className="w-full h-14" loading={saveMember.isPending} icon={selectedMember ? "save" : "person_add"}>
              {selectedMember ? 'Сохранить изменения' : 'Создать сотрудника'}
            </Button>
          </div>
          {!selectedMember && (
            <p className="text-[10px] text-slate-400 italic text-center px-4">
              Сотрудник будет создан сразу с подтвержденным доступом.
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
        loading={deleteMember.isPending}
      />
    </div>
  );
};

export default Team;

