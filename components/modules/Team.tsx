
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Badge, Button, Modal, Input, Select, ConfirmModal, useToast } from '../ui';

const ROLES = [
  { value: 'admin', label: 'Администратор' },
  { value: 'director', label: 'Директор' },
  { value: 'manager', label: 'Менеджер объектов' },
  { value: 'storekeeper', label: 'Снабжение / Финансы' },
  { value: 'specialist', label: 'Специалист' }
];

// Define User Role Type explicitly locally if not imported
type UserRole = 'admin' | 'director' | 'manager' | 'specialist' | 'storekeeper';

const Team: React.FC<{ profile: any }> = ({ profile }) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  
  // Search & Filter
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [inviteLink, setInviteLink] = useState('');
  
  const [formData, setFormData] = useState({ 
    full_name: '', 
    email: '', 
    role: 'specialist' as UserRole, 
    phone: '', 
    birth_date: '',
    password: '' // New field
  });

  const isAdmin = profile?.role === 'admin' || profile?.role === 'director';

  // --- QUERIES ---

  const { data: members = [], isLoading: isMembersLoading } = useQuery({
    queryKey: ['team'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .is('deleted_at', null)
        .neq('role', 'client') // Filter out clients
        .order('full_name');
      return data || [];
    }
  });

  const pendingMembers = useMemo(() => members.filter((m: any) => m.is_approved === false), [members]);
  const activeMembers = useMemo(() => members.filter((m: any) => m.is_approved !== false), [members]);

  const { data: tasks = [] } = useQuery({
    queryKey: ['team_tasks_stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('assigned_to, status, deadline')
        .is('is_deleted', false)
        .eq('status', 'pending');
      return data || [];
    }
  });

  const filteredMembers = useMemo(() => {
    return activeMembers.filter((m: any) => {
      const matchesSearch = m.full_name.toLowerCase().includes(search.toLowerCase()) || 
                           m.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'all' || m.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [activeMembers, search, roleFilter]);

  const handleApprove = async (memberId: string) => {
    const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('id', memberId);
    if (!error) {
      toast.success('Сотрудник подтвержден');
      queryClient.invalidateQueries({ queryKey: ['team'] });
    } else {
      toast.error('Ошибка подтверждения');
    }
  };

  const handleBlock = async (memberId: string) => {
    if (!window.confirm('Заблокировать доступ этому сотруднику?')) return;
    const { error } = await supabase.from('profiles').update({ is_approved: false }).eq('id', memberId);
    if (!error) {
      toast.success('Доступ заблокирован');
      queryClient.invalidateQueries({ queryKey: ['team'] });
    } else {
      toast.error('Ошибка блокировки');
    }
  };

  const handleOpenCreate = () => {
    setSelectedMember(null);
    setFormData({ full_name: '', email: '', role: 'specialist', phone: '', birth_date: '', password: '' });
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
      password: ''
    });
    setIsEditModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Explicit casting to match Supabase types for Role
    const payload = {
        full_name: formData.full_name,
        role: formData.role, // This is already typed as UserRole
        phone: formData.phone,
        birth_date: formData.birth_date
    };

    if (selectedMember) {
      // Update Profile
      const { error: profileError } = await supabase.from('profiles').update(payload).eq('id', selectedMember.id);
      
      if (profileError) {
        toast.error('Ошибка обновления профиля');
        return;
      }

      // Update Credentials (Email/Password) via RPC if changed
      if (formData.email !== selectedMember.email || formData.password) {
        const { error: credsError } = await supabase.rpc('admin_update_user_credentials', {
          target_user_id: selectedMember.id,
          new_email: formData.email !== selectedMember.email ? formData.email : null,
          new_password: formData.password || null
        });

        if (credsError) {
          console.error('Credentials update error:', credsError);
          toast.error('Профиль обновлен, но не удалось изменить email/пароль');
        } else {
          toast.success('Профиль и данные входа обновлены');
        }
      } else {
        toast.success('Профиль обновлен');
      }

      setIsEditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['team'] });

    } else {
      // Create New User (Admin Flow)
      if (!formData.password) {
        toast.error('Для создания пользователя необходим пароль');
        return;
      }

      // 1. Create User in Auth (using secondary client to avoid logout)
      // We use a trick: createClient with persistSession: false is needed.
      // But we don't have service_role key on client.
      // However, we can use signUp. Since we are admin, we can just signUp a new user?
      // No, signUp logs you in.
      // We need to use the secondary client (supabaseAdmin) defined in lib/supabase.ts
      
      // Import supabaseAdmin dynamically or use the one from props/context if available.
      // Actually we need to import it at top level.
      
      try {
        // We need to import supabaseAdmin from lib/supabase
        const { supabaseAdmin } = await import('../../lib/supabase');
        
        const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.full_name,
              // We DON'T pass role here to avoid security issues with the trigger.
              // The trigger will create a 'specialist' / 'unapproved' profile.
            }
          }
        });

        if (authError) {
          toast.error('Ошибка создания пользователя: ' + authError.message);
          return;
        }

        if (authData.user) {
          // 2. Immediately update profile to set correct role and approve
          const { error: rpcError } = await supabase.rpc('admin_update_profile', {
            target_user_id: authData.user.id,
            new_role: formData.role,
            new_approval_status: true
          });

          if (rpcError) {
             toast.error('Пользователь создан, но ошибка при назначении роли: ' + rpcError.message);
          } else {
             toast.success('Сотрудник успешно создан и подтвержден');
             setIsEditModalOpen(false);
             queryClient.invalidateQueries({ queryKey: ['team'] });
          }
        }
      } catch (err: any) {
        toast.error('Критическая ошибка: ' + err.message);
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedMember) return;
    const { error } = await supabase.from('profiles').update({ 
      deleted_at: new Date().toISOString() 
    }).eq('id', selectedMember.id);
    
    if (!error) {
      setIsDeleteModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success('Сотрудник уволен');
    } else {
      toast.error('Ошибка при удалении');
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast.success('Ссылка скопирована');
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
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-amber-600 font-bold shadow-sm">
                    {getUserInitials(member.full_name)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{member.full_name}</p>
                    <p className="text-xs text-slate-500">{member.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                   <Button variant="primary" onClick={() => handleApprove(member.id)} icon="check" className="h-8 text-xs">
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

          return (
            <div key={member.id} className="bg-white rounded-[32px] border border-[#e1e2e1] p-6 hover:shadow-lg transition-all flex flex-col items-center text-center group">
              <div className="relative mb-4">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-4 border-white shadow-sm ${
                  member.role === 'admin' ? 'bg-red-50 text-red-600' :
                  member.role === 'director' ? 'bg-purple-50 text-purple-600' :
                  member.role === 'manager' ? 'bg-blue-50 text-blue-600' :
                  member.role === 'storekeeper' ? 'bg-amber-50 text-amber-600' :
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
                  member.role === 'manager' ? 'blue' : 
                  member.role === 'storekeeper' ? 'amber' : 'emerald'
                }>
                  {ROLES.find(r => r.value === member.role)?.label.toUpperCase() || member.role}
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
                      title="Редактировать"
                    >
                      <span className="material-icons-round text-lg">edit</span>
                    </button>
                    {!isSelf && (
                      <>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleBlock(member.id); }}
                          className="flex-1 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                          title="Заблокировать доступ"
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
            <Button type="submit" className="w-full h-14" loading={false} icon={selectedMember ? "save" : "person_add"}>
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

      {/* Invite Modal */}
      <Modal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} title="Приглашение сотрудника">
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
            <span className="material-icons-round text-3xl">mail_outline</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Ссылка для регистрации</h3>
            <p className="text-sm text-slate-500 mb-4">
              Отправьте эту ссылку сотруднику. После регистрации он появится в списке, и вы сможете назначить ему роль.
            </p>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 break-all text-xs font-mono text-slate-600 mb-4 select-all">
              {inviteLink}
            </div>
            <Button onClick={copyInviteLink} className="w-full h-12" icon="content_copy">Скопировать ссылку</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        onConfirm={handleDelete} 
        title="Увольнение сотрудника" 
        message={`Вы уверены, что хотите уволить сотрудника ${selectedMember?.full_name}? Доступ в систему будет закрыт, но история задач сохранится.`} 
        confirmLabel="Да, уволить"
        loading={false}
      />
    </div>
  );
};

export default Team;
