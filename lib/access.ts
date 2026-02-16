
/**
 * Утилита для проверки доступа к модулям системы на основе роли пользователя.
 * Логика синхронизирована с компонентом Layout.tsx.
 */
export const isModuleAllowed = (role: string | undefined, moduleId: string): boolean => {
  if (!role) return false;
  
  // Эти модули всегда доступны всем авторизованным пользователям
  if (moduleId === 'dashboard' || moduleId === 'notifications' || moduleId === 'profile') {
    return true;
  }

  switch (role) {
    case 'specialist':
      // Специалисты видят только свои задачи и объекты
      return ['tasks', 'objects'].includes(moduleId);
    
    case 'manager':
      // Менеджеры видят всё, кроме админской базы и корзины
      return !['database', 'trash'].includes(moduleId);
    
    case 'director':
      // Директора видят всё, кроме системных настроек базы данных
      return moduleId !== 'database';
    
    case 'storekeeper':
      // Снабжение/Финансист: Склад, Финансы, Задачи, Объекты (просмотр), КП/Счета/Прайс
      return ['inventory', 'finances', 'tasks', 'objects', 'proposals'].includes(moduleId);

    case 'admin':
      // Администраторам доступно всё
      return true;
    
    default:
      return false;
  }
};
