import React, { useEffect } from 'react';
import { isModuleAllowed } from '../lib/access';
import { Module } from '../App';

interface ProtectedRouteProps {
  role: string | undefined;
  moduleId: Module;
  onRedirect: (fallbackModule: Module) => void;
  children: React.ReactNode;
}

/**
 * Компонент для защиты доступа к содержимому модуля.
 * Если у пользователя нет прав на просмотр moduleId, вызывается onRedirect.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  role, 
  moduleId, 
  onRedirect, 
  children 
}) => {
  const allowed = isModuleAllowed(role, moduleId);

  useEffect(() => {
    if (!allowed) {
      console.warn(`Access denied for module: ${moduleId}. Redirecting to dashboard.`);
      onRedirect('dashboard');
    }
  }, [allowed, moduleId, onRedirect]);

  if (!allowed) {
    // Возвращаем null или лоадер, пока эффект не сработает
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
