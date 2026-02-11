
import React, { Suspense } from 'react';
import { Module } from '../App';
import ProtectedRoute from './ProtectedRoute';
import { INITIAL_SUGGESTED_SCHEMA } from '../constants';
import SqlGenerator from './SqlGenerator';

const Dashboard = React.lazy(() => import('./modules/Dashboard'));
const Clients = React.lazy(() => import('./modules/Clients'));
const Objects = React.lazy(() => import('./modules/Objects'));
const Tasks = React.lazy(() => import('./modules/Tasks'));
const Finances = React.lazy(() => import('./modules/Finances'));
const Team = React.lazy(() => import('./modules/Team'));
const Inventory = React.lazy(() => import('./modules/Inventory/index'));
const Proposals = React.lazy(() => import('./modules/Proposals/index'));
const Notifications = React.lazy(() => import('./modules/Notifications'));
const Trash = React.lazy(() => import('./modules/Trash'));

interface MainContentProps {
  activeModule: Module;
  profile: any;
  setActiveModule: (m: Module) => void;
  activeObjectId: string | null;
  activeStageId: string | null;
  onNavigateToObject: (id: string, stageId?: string) => void;
  clearActiveObject: () => void;
  refreshTrigger?: number; // Новый проп
}

const ModuleLoader = () => (
  <div className="flex h-full items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Загрузка модуля...</p>
    </div>
  </div>
);

const MainContent: React.FC<MainContentProps> = ({ 
  activeModule, 
  profile, 
  setActiveModule, 
  activeObjectId, 
  activeStageId,
  onNavigateToObject,
  clearActiveObject,
  refreshTrigger = 0
}) => {
  const renderWithProtection = (moduleId: Module, component: React.ReactNode) => (
    <ProtectedRoute 
      role={profile?.role} 
      moduleId={moduleId} 
      onRedirect={setActiveModule}
    >
      <Suspense fallback={<ModuleLoader />}>
        {component}
      </Suspense>
    </ProtectedRoute>
  );

  switch (activeModule) {
    case 'dashboard': 
      return renderWithProtection('dashboard', <Dashboard profile={profile} refreshTrigger={refreshTrigger} />);
    
    case 'clients': 
      return renderWithProtection('clients', (
        <Clients 
          profile={profile} 
          setActiveModule={setActiveModule} 
          onNavigateToObject={onNavigateToObject} 
          refreshTrigger={refreshTrigger}
        />
      ));
    
    case 'objects': 
      return renderWithProtection('objects', (
        <Objects 
          profile={profile} 
          initialObjectId={activeObjectId} 
          initialStageId={activeStageId}
          onClearInitialId={clearActiveObject} 
          refreshTrigger={refreshTrigger}
        />
      ));
    
    case 'tasks': 
      return renderWithProtection('tasks', <Tasks profile={profile} onNavigateToObject={onNavigateToObject} refreshTrigger={refreshTrigger} />);
    
    case 'finances': 
      return renderWithProtection('finances', <Finances profile={profile} refreshTrigger={refreshTrigger} />);
    
    case 'team': 
      return renderWithProtection('team', <Team profile={profile} refreshTrigger={refreshTrigger} />);
    
    case 'inventory':
      return renderWithProtection('inventory', <Inventory profile={profile} refreshTrigger={refreshTrigger} />);

    case 'proposals':
      return renderWithProtection('proposals', <Proposals profile={profile} refreshTrigger={refreshTrigger} />);

    case 'notifications': 
      return renderWithProtection('notifications', <Notifications profile={profile} refreshTrigger={refreshTrigger} />);
    
    case 'trash': 
      return renderWithProtection('trash', <Trash profile={profile} refreshTrigger={refreshTrigger} />);
    
    case 'database': 
      return renderWithProtection('database', (
        <div className="space-y-6">
          <div className="mb-6">
            <h2 className="text-2xl font-medium text-[#1c1b1f]">Настройка базы данных</h2>
          </div>
          <SqlGenerator schemas={INITIAL_SUGGESTED_SCHEMA} />
        </div>
      ));
    
    default: 
      return (
        <Suspense fallback={<ModuleLoader />}>
          <Dashboard profile={profile} refreshTrigger={refreshTrigger} />
        </Suspense>
      );
  }
};

export default MainContent;
