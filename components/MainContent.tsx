
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
import SqlGenerator from './SqlGenerator';
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
  switch (activeModule) {
    case 'dashboard': return <Dashboard profile={profile} />;
    case 'clients': return (
      <Clients 
        profile={profile} 
        setActiveModule={setActiveModule} 
        onNavigateToObject={onNavigateToObject} 
      />
    );
    case 'objects': return (
      <Objects 
        profile={profile} 
        initialObjectId={activeObjectId} 
        initialStageId={activeStageId}
        onClearInitialId={clearActiveObject} 
      />
    );
    case 'tasks': return <Tasks profile={profile} onNavigateToObject={onNavigateToObject} />;
    case 'finances': return <Finances profile={profile} />;
    case 'team': return <Team profile={profile} />;
    case 'notifications': return <Notifications profile={profile} />;
    case 'trash': return <Trash profile={profile} />;
    case 'database': return (
      <div className="space-y-6">
        <div className="mb-6">
          <h2 className="text-2xl font-medium text-[#1c1b1f]">Настройка базы данных</h2>
          <p className="text-[#444746] text-sm mt-1">Выполните этот SQL код в панели Supabase для корректной работы системы</p>
        </div>
        <SqlGenerator schemas={INITIAL_SUGGESTED_SCHEMA} />
      </div>
    );
    default: return <Dashboard profile={profile} />;
  }
};

export default MainContent;
