
import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import Layout from './components/Layout';
import MainContent from './components/MainContent';
import { Button } from './components/ui';

export type Module = 'dashboard' | 'clients' | 'objects' | 'tasks' | 'finances' | 'team' | 'notifications' | 'trash' | 'database';

const App: React.FC = () => {
  const { session, profile, loading, refreshProfile } = useAuth();
  
  const getInitialStateFromHash = () => {
    const hash = window.location.hash.replace('#', '');
    const [module, id] = hash.split('/');
    return {
      module: (module as Module) || 'dashboard',
      id: id || null
    };
  };

  const initialState = getInitialStateFromHash();
  const [activeModule, setActiveModule] = useState<Module>(initialState.module);
  const [activeObjectId, setActiveObjectId] = useState<string | null>(initialState.id);
  const [activeStageId, setActiveStageId] = useState<string | null>(null);

  useEffect(() => {
    const hash = activeObjectId ? `${activeModule}/${activeObjectId}` : activeModule;
    window.location.hash = hash;
  }, [activeModule, activeObjectId]);

  useEffect(() => {
    const handleHashChange = () => {
      const state = getInitialStateFromHash();
      setActiveModule(state.module);
      setActiveObjectId(state.id);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Улучшенный слушатель фокуса для борьбы с Throttling браузера
  useEffect(() => {
    const handleFocus = async () => {
      if (document.visibilityState === 'visible' && session) {
        try {
          // 1. Принудительно обновляем сессию (Wake Up Auth)
          await supabase.auth.refreshSession();
          
          // 2. Даем браузеру 150мс на восстановление сетевых сокетов
          await new Promise(resolve => setTimeout(resolve, 150));
          
          // 3. Выполняем "контрольный" запрос профиля для проверки связи
          await refreshProfile();
        } catch (e) {
          console.warn('[Network] Не удалось восстановить сессию автоматически');
        }
      }
    };

    window.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
    };
  }, [session, refreshProfile]);

  const handleNavigateToObject = (objectId: string, stageId?: string) => {
    setActiveObjectId(objectId);
    if (stageId) setActiveStageId(stageId);
    setActiveModule('objects');
  };

  const handleModuleChange = (module: Module) => {
    setActiveModule(module);
    if (module !== 'objects') {
      setActiveObjectId(null);
      setActiveStageId(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.hash = 'dashboard';
    window.location.reload();
  };

  if (loading && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Авторизация...</p>
        </div>
      </div>
    );
  }

  if (!loading && !session) return <Auth />;

  if (!loading && !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] p-6 text-center animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4">
          <span className="material-icons-round text-3xl">account_circle_off</span>
        </div>
        <h2 className="text-xl font-medium text-slate-900 mb-2">Профиль не найден</h2>
        <p className="text-slate-500 max-w-xs mb-8 leading-relaxed">
          Не удалось загрузить данные вашего аккаунта. Возможно, возникла сетевая ошибка при восстановлении сессии.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-[240px]">
          <Button onClick={() => window.location.reload()} icon="refresh" className="w-full">Обновить страницу</Button>
          <Button variant="ghost" onClick={handleLogout} icon="logout" className="w-full">Выйти из системы</Button>
        </div>
      </div>
    );
  }

  return (
    <Layout 
      profile={profile} 
      activeModule={activeModule} 
      setActiveModule={handleModuleChange}
      onProfileUpdate={refreshProfile}
    >
      <MainContent 
        activeModule={activeModule} 
        profile={profile} 
        setActiveModule={handleModuleChange}
        activeObjectId={activeObjectId}
        activeStageId={activeStageId}
        onNavigateToObject={handleNavigateToObject}
        clearActiveObject={() => {
          setActiveObjectId(null);
          setActiveStageId(null);
        }}
      />
    </Layout>
  );
};

export default App;
