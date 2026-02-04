
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

export const useAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Флаг для предотвращения обновлений стейта на размонтированном компоненте
  const mounted = useRef(true);
  // Ref для отслеживания текущего ID пользователя, чтобы избегать лишних загрузок
  const currentUserIdRef = useRef<string | undefined>(undefined);

  // Функция загрузки профиля - отделена от эффектов
  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!mounted.current) return;

      if (error) {
        console.error('Error fetching profile:', error);
        // Не сбрасываем сессию при ошибке сети, только при явной ошибке доступа
        return null;
      }
      
      return data;
    } catch (err) {
      console.error('Profile fetch exception:', err);
      return null;
    }
  };

  // Главная функция инициализации и восстановления
  const initializeAuth = async () => {
    if (!mounted.current) return;
    
    // Не ставим setLoading(true) здесь, чтобы не вызывать "мерцание" интерфейса при ревалидации
    // setLoading используется только для ПЕРВИЧНОЙ загрузки или явного входа
    
    try {
      // 1. Явно проверяем сессию через getSession()
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !currentSession) {
        if (mounted.current) {
          setSession(null);
          setProfile(null);
          setLoading(false);
          currentUserIdRef.current = undefined;
        }
        return;
      }

      if (mounted.current) {
        setSession(currentSession);
        currentUserIdRef.current = currentSession.user.id;
      }

      // 2. Если профиля нет или сменился пользователь - грузим профиль
      if (!profile || profile.id !== currentSession.user.id) {
        const userProfile = await loadProfile(currentSession.user.id);
        
        if (mounted.current) {
          if (userProfile) {
             // Проверка на мягкое удаление
             if (userProfile.deleted_at) {
               await supabase.auth.signOut();
               setSession(null);
               setProfile(null);
               currentUserIdRef.current = undefined;
             } else {
               setProfile(userProfile);
             }
          } else {
            // Профиль не найден в БД, но сессия есть
            setProfile(null);
          }
        }
      }
    } catch (err) {
      console.error('Auth initialization error:', err);
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    initializeAuth();

    // Подписка на изменения авторизации
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted.current) return;

      const newUserId = newSession?.user?.id;
      const prevUserId = currentUserIdRef.current;

      // При обновлении токена (тихий режим)
      if (event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        currentUserIdRef.current = newUserId;
      }

      // При входе (SIGNED_IN)
      if (event === 'SIGNED_IN') {
        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ:
        // Проверяем, изменился ли пользователь.
        // Если это тот же пользователь (например, при переключении вкладок/гидратации),
        // мы НЕ включаем loading(true), чтобы не вызывать "зависание" интерфейса.
        if (newUserId && newUserId === prevUserId) {
             setSession(newSession);
             // Можно тихо обновить профиль, если нужно, но не блокируем UI
        } else {
             // Если это новый вход (логин) или первичная загрузка, включаем loading,
             // чтобы скрыть "глитч" (экран "Профиль не найден").
             setLoading(true);
             setSession(newSession);
             currentUserIdRef.current = newUserId;
             await initializeAuth();
        }
      }
      
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setProfile(null);
        setLoading(false);
        currentUserIdRef.current = undefined;
      }
    });

    // Обработчик фокуса окна
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        console.debug('Tab active, revalidating auth...');
        initializeAuth();
      }
    };

    document.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
    };
  }, []); 

  return { 
    session, 
    profile, 
    loading, 
    refreshProfile: async () => {
      if (session?.user?.id) {
        const data = await loadProfile(session.user.id);
        if (mounted.current && data) setProfile(data);
      }
    } 
  };
};
