
import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import Auth from './components/Auth';
import Layout from './components/Layout';
import MainContent from './components/MainContent';
import { Button } from './components/ui';

export type Module = 'dashboard' | 'clients' | 'objects' | 'tasks' | 'finances' | 'team' | 'notifications' | 'trash' | 'database';

const App: React.FC = () => {
  const { session, profile, loading, refreshProfile } = useAuth();
  
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

  // Синхронизация состояния с URL
  useEffect(() => {
    const hash = activeObjectId ? `${activeModule}/${activeObjectId}` : activeModule;
    window.location.hash = hash;
  }, [activeModule, activeObjectId]);

  // Слушатель изменения Hash (кнопки назад/вперед в браузере)
  useEffect(() => {
    const handleHashChange = () => {
      const state = getInitialStateFromHash();
      setActiveModule(state.module);
      setActiveObjectId(state.id);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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

  // 1. Сначала проверяем общую загрузку (Auth + Profile Fetching)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Авторизация...</p>
        </div>
      </div>
    );
  }

  // 2. Если загрузка завершена и сессии нет — показываем вход
  if (!session) return <Auth />;

  // 3. Если сессия есть, но после завершения загрузки профиль всё еще null — ошибка
  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] p-6 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4">
          <span className="material-icons-round text-3xl">account_circle_off</span>
        </div>
        <h2 className="text-xl font-medium text-slate-900 mb-2">Профиль не найден</h2>
        <p className="text-slate-500 max-w-xs mb-6">
          Не удалось загрузить данные вашего аккаунта. Попробуйте обновить страницу или обратитесь к администратору.
        </p>
        <Button onClick={() => window.location.reload()} icon="refresh">Обновить страницу</Button>
      </div>
    );
  }

  // 4. Всё готово — рендерим приложение
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
