
import React from 'react';
import { Module } from '../App';
import Dashboard from './modules/Dashboard';
import Clients from './modules/Clients';
import Objects from './modules/Objects';
import Tasks from './modules/Tasks';
import Finances from './modules/Finances';
import Team from './modules/Team';
import Notifications from './modules/Notifications';
import Trash from './modules/Trash';
import Inventory from './modules/Inventory/index';
import SqlGenerator from './SqlGenerator';
import ProtectedRoute from './ProtectedRoute';
import { INITIAL_SUGGESTED_SCHEMA } from '../constants';

interface MainContentProps {
  activeModule: Module;
  profile: any;
  setActiveModule: (m: Module) => void;
  activeObjectId: string | null;
  activeStageId: string | null;
  onNavigateToObject: (id: string, stageId?: string) => void;
  clearActiveObject: () => void;
}

const MainContent: React.FC<MainContentProps> = ({ 
  activeModule, 
  profile, 
  setActiveModule, 
  activeObjectId,
  activeStageId,
  onNavigateToObject,
  clearActiveObject
}) => {
  // Функция для рендеринга модуля внутри защиты
  const renderWithProtection = (moduleId: Module, component: React.ReactNode) => (
    <ProtectedRoute 
      role={profile?.role} 
      moduleId={moduleId} 
      onRedirect={setActiveModule}
    >
      {component}
    </ProtectedRoute>
  );

  switch (activeModule) {
    case 'dashboard': 
      return renderWithProtection('dashboard', <Dashboard profile={profile} />);
    
    case 'clients': 
      return renderWithProtection('clients', (
        <Clients 
          profile={profile} 
          setActiveModule={setActiveModule} 
          onNavigateToObject={onNavigateToObject} 
        />
      ));
    
    case 'objects': 
      return renderWithProtection('objects', (
        <Objects 
          profile={profile} 
          initialObjectId={activeObjectId} 
          initialStageId={activeStageId}
          onClearInitialId={clearActiveObject} 
        />
      ));
    
    case 'tasks': 
      return renderWithProtection('tasks', <Tasks profile={profile} onNavigateToObject={onNavigateToObject} />);
    
    case 'finances': 
      return renderWithProtection('finances', <Finances profile={profile} />);
    
    case 'team': 
      return renderWithProtection('team', <Team profile={profile} />);
    
    case 'inventory':
      return renderWithProtection('inventory', <Inventory profile={profile} />);

    case 'notifications': 
      return renderWithProtection('notifications', <Notifications profile={profile} />);
    
    case 'trash': 
      return renderWithProtection('trash', <Trash profile={profile} />);
    
    case 'database': 
      return renderWithProtection('database', (
        <div className="space-y-6">
          <div className="mb-6">
            <h2 className="text-2xl font-medium text-[#1c1b1f]">Настройка базы данных</h2>
            <p className="text-[#444746] text-sm mt-1">Выполните этот SQL код в панели Supabase для корректной работы системы</p>
          </div>
          <SqlGenerator schemas={INITIAL_SUGGESTED_SCHEMA} />
        </div>
      ));
    
    default: 
      return <Dashboard profile={profile} />;
  }
};

export default MainContent;