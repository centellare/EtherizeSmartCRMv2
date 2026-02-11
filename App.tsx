
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './hooks/useAuth';
import { supabase, checkConnection } from './lib/supabase';
import Auth from './components/Auth';
import Layout from './components/Layout';
import MainContent from './components/MainContent';
import { Button } from './components/ui';
import { isModuleAllowed } from './lib/access';

export type Module = 'dashboard' | 'clients' | 'objects' | 'tasks' | 'finances' | 'team' | 'inventory' | 'notifications' | 'trash' | 'database' | 'proposals';

const App: React.FC = () => {
  const { session, profile, loading, refreshProfile, recoverSession } = useAuth();
  const [showLongLoadingControl, setShowLongLoadingControl] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Счетчик для принудительного обновления
  
  // Инициализация из URL Hash
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

  // Проверка прав при изменении роли или модуля
  useEffect(() => {
    if (profile && !isModuleAllowed(profile.role, activeModule)) {
      console.warn(`Initial module ${activeModule} is not allowed for role ${profile.role}. Resetting to dashboard.`);
      setActiveModule('dashboard');
      setActiveObjectId(null);
    }
  }, [profile, activeModule]);

  // Таймер для отображения кнопки сброса при долгой загрузке
  useEffect(() => {
    let timer: any;
    if (loading && !profile) {
      setShowLongLoadingControl(false);
      timer = setTimeout(() => {
        setShowLongLoadingControl(true);
      }, 3000); // Показываем кнопку через 3 секунды ожидания
    }
    return () => clearTimeout(timer);
  }, [loading, profile]);

  // Синхронизация состояния с URL
  useEffect(() => {
    const hash = activeObjectId ? `${activeModule}/${activeObjectId}` : activeModule;
    if (window.location.hash.replace('#', '') !== hash) {
      window.location.hash = hash;
    }
  }, [activeModule, activeObjectId]);

  // Слушатель изменения Hash
  useEffect(() => {
    const handleHashChange = () => {
      const state = getInitialStateFromHash();
      // Перед установкой проверяем доступ, если профиль уже загружен
      if (profile && !isModuleAllowed(profile.role, state.module)) {
        window.location.hash = 'dashboard';
        return;
      }
      setActiveModule(state.module);
      setActiveObjectId(state.id);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [profile]);

  const handleNavigateToObject = (objectId: string, stageId?: string) => {
    setActiveObjectId(objectId);
    if (stageId) setActiveStageId(stageId);
    setActiveModule('objects');
  };

  const handleModuleChange = async (module: Module) => {
    // Если модуль тот же — инкрементируем триггер обновления
    if (activeModule === module) {
      setRefreshTrigger(prev => prev + 1);
    }

    // Проверка доступа перед переключением
    if (profile && !isModuleAllowed(profile.role, module)) {
      console.error("Access denied");
      return;
    }

    // Умная проверка перед переключением
    if (['dashboard', 'tasks', 'objects', 'finances', 'inventory'].includes(module)) {
      const isConnected = await checkConnection();
      if (!isConnected) {
        console.warn('Connection lost, attempting recovery before navigation...');
        await recoverSession();
      }
    }
    
    setActiveModule(module);
    if (module !== 'objects') {
      setActiveObjectId(null);
      setActiveStageId(null);
    }
  };

  const handleHardLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(";").forEach((c) => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    window.location.hash = '';
    window.location.reload();
  };

  if (loading && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-6 animate-in fade-in duration-500">
          <div className="relative">
             <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <div className="flex flex-col items-center gap-3">
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Загрузка системы...</p>
             {showLongLoadingControl && (
               <div className="animate-in fade-in slide-in-from-top-2 duration-500 flex flex-col items-center gap-2 mt-4">
                 <p className="text-[10px] text-slate-400">Возникли проблемы?</p>
                 <Button 
                   variant="secondary" 
                   onClick={handleHardLogout}
                   className="h-9 text-xs !px-5 bg-white border-red-100 text-red-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 shadow-sm"
                   icon="logout"
                 >
                   Сбросить сессию и войти
                 </Button>
               </div>
             )}
          </div>
        </div>
      </div>
    );
  }

  if (!loading && !session) return <Auth />;

  if (!loading && !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] p-6 text-center animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4">
          <span className="material-icons-round text-3xl">wifi_off</span>
        </div>
        <h2 className="text-xl font-medium text-slate-900 mb-2">Нет связи с сервером</h2>
        <div className="flex flex-col gap-3 w-full max-w-[240px]">
          <Button onClick={() => window.location.reload()} icon="refresh" className="w-full">Обновить страницу</Button>
          <Button variant="ghost" onClick={handleHardLogout} icon="logout" className="w-full text-red-600 hover:bg-red-50">Выйти и очистить кеш</Button>
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
        refreshTrigger={refreshTrigger} // Передаем триггер вниз
      />
    </Layout>
  );
};

export default App;
