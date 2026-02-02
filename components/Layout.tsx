
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Modal, Input, Button, Badge } from './ui';

interface LayoutProps {
  children: React.ReactNode;
  profile: any;
  activeModule: string;
  setActiveModule: (m: any) => void;
  onProfileUpdate: () => Promise<void>;
}

const Layout: React.FC<LayoutProps> = ({ children, profile, activeModule, setActiveModule, onProfileUpdate }) => {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '', birth_date: '' });

  useEffect(() => {
    if (profile) {
      setProfileForm({ 
        full_name: profile.full_name || '', 
        phone: profile.phone || '', 
        birth_date: profile.birth_date || '' 
      });
    }
  }, [profile]);

  // Мониторинг состояния Realtime соединения
  useEffect(() => {
    const channel = supabase.channel('system_status')
      .on('presence', { event: 'sync' }, () => setIsLive(true))
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });
    return () => { supabase.removeChannel(channel); };
  }, []);

  const allMenuItems = [
    { id: 'dashboard', label: 'Дашборд', icon: 'dashboard' },
    { id: 'tasks', label: 'Задачи', icon: 'check_circle' },
    { id: 'objects', label: 'Объекты', icon: 'home_work' },
    { id: 'clients', label: 'Клиенты', icon: 'group' },
    { id: 'finances', label: 'Финансы', icon: 'account_balance' },
    { id: 'team', label: 'Команда', icon: 'people_alt' },
    { id: 'database', label: 'База данных', icon: 'storage' },
    { id: 'trash', label: 'Корзина', icon: 'delete_outline' },
  ];

  const menuItems = allMenuItems.filter(item => {
    const role = profile?.role;
    if (role === 'specialist') return ['dashboard', 'tasks', 'objects'].includes(item.id);
    if (role === 'manager') return !['database', 'trash'].includes(item.id);
    if (role === 'director') return item.id !== 'database';
    return true;
  });

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('profiles').update(profileForm).eq('id', profile.id);
    if (!error) {
      await onProfileUpdate();
      setIsProfileModalOpen(false);
    }
    setLoading(false);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };

  const userInitials = profile?.full_name 
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f9fc]">
      <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title="Настройки профиля">
        <form onSubmit={handleProfileUpdate} className="space-y-6">
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-3 shadow-lg">{userInitials}</div>
            <h4 className="text-lg font-bold text-slate-900">{profile?.full_name}</h4>
            <div className="flex gap-2 mt-1"><Badge color="blue">{profile?.role?.toUpperCase() || 'USER'}</Badge></div>
          </div>
          <div className="space-y-4">
            <Input label="Ваше ФИО" required value={profileForm.full_name} onChange={(e:any) => setProfileForm({...profileForm, full_name: e.target.value})} icon="person" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Контактный телефон" value={profileForm.phone} onChange={(e:any) => setProfileForm({...profileForm, phone: e.target.value})} icon="phone" />
              <Input label="Дата рождения" type="date" value={profileForm.birth_date} onChange={(e:any) => setProfileForm({...profileForm, birth_date: e.target.value})} icon="calendar_today" />
            </div>
          </div>
          <div className="pt-4"><Button type="submit" className="w-full h-14" loading={loading} icon="save">Сохранить изменения</Button></div>
        </form>
      </Modal>

      <aside className="w-72 bg-[#f3f5f7] flex flex-col border-r border-[#e1e2e1]">
        <div className="p-6 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#005ac1] rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <span className="material-icons-round">home_max</span>
            </div>
            <h2 className="text-xl font-bold text-[#1c1b1f] tracking-tight">SmartCRM</h2>
          </div>
        </div>
        <nav className="flex-grow px-4 space-y-1 overflow-y-auto scrollbar-hide">
          {menuItems.map((item) => (
            <button key={item.id} onClick={() => setActiveModule(item.id)} className={`w-full flex items-center gap-4 px-4 h-12 rounded-full text-sm font-medium transition-all group ${activeModule === item.id ? 'bg-[#d3e4ff] text-[#001d3d]' : 'text-[#444746] hover:bg-black/5'}`}>
              <span className={`material-icons-round ${activeModule === item.id ? 'text-[#001d3d]' : 'text-[#444746] group-hover:text-[#1c1b1f]'}`}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-[#e1e2e1] bg-white/50">
          <div className="bg-white rounded-2xl p-4 border border-[#e1e2e1] shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div onClick={() => setIsProfileModalOpen(true)} className="w-10 h-10 rounded-full bg-[#eff1f8] border border-[#d3e4ff] flex items-center justify-center text-[#005ac1] font-bold text-xs cursor-pointer hover:bg-[#d3e4ff] transition-colors">{userInitials}</div>
              <div className="flex-grow min-w-0">
                <p className="text-sm font-bold text-[#1c1b1f] truncate leading-tight">{profile?.full_name || 'Загрузка...'}</p>
                <div className="mt-1"><Badge color="slate">{profile?.role || 'user'}</Badge></div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIsProfileModalOpen(true)} className="flex-1 h-9 flex items-center justify-center gap-2 rounded-xl border border-[#e1e2e1] text-[#444746] hover:bg-[#f3f5f7] transition-all text-xs font-medium"><span className="material-icons-round text-sm">settings</span>Профиль</button>
              <button onClick={handleLogout} className="w-9 h-9 flex items-center justify-center rounded-xl border border-[#ffdad6] text-[#ba1a1a] hover:bg-[#ffdad6] transition-all"><span className="material-icons-round text-sm">logout</span></button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-grow flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-[#e1e2e1] flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <span className="material-icons-round text-[#444746]">{allMenuItems.find(i => i.id === activeModule)?.icon}</span>
            <h3 className="text-lg font-medium text-[#1c1b1f]">{allMenuItems.find(i => i.id === activeModule)?.label}</h3>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-100">
               <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
               <span className={`text-[10px] font-bold uppercase tracking-widest ${isLive ? 'text-emerald-600' : 'text-slate-400'}`}>Live</span>
            </div>
            <button onClick={() => setActiveModule('notifications')} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors relative ${activeModule === 'notifications' ? 'bg-[#d3e4ff] text-[#001d3d]' : 'hover:bg-[#f3f5f7] text-[#444746]'}`}>
              <span className="material-icons-round">notifications</span>
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>
        <div className="flex-grow p-8 overflow-y-auto bg-[#f7f9fc]">
          <div className="max-w-[1400px] mx-auto pb-12">{children}</div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
