
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

export const useAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Флаг для предотвращения обновлений стейта на размонтированном компоненте
  const mounted = useRef(true);

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
    // setLoading используется только для ПЕРВИЧНОЙ загрузки
    
    try {
      // 1. Явно проверяем сессию через getSession()
      // Это гарантирует, что мы получим актуальный токен, даже если вкладка спала
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !currentSession) {
        if (mounted.current) {
          setSession(null);
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      if (mounted.current) setSession(currentSession);

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
             } else {
               setProfile(userProfile);
             }
          } else {
            // Профиль не найден в БД, но сессия есть (странная ситуация, но возможная)
            // Не разлогиниваем сразу, даем шанс интерфейсу обработать
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

    // Подписка на изменения авторизации (вход, выход, обновление токена)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted.current) return;

      // При обновлении токена или входе просто обновляем сессию в стейте
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        setSession(newSession);
        // Если профиля еще нет, пробуем загрузить
        if (newSession && !profile) {
          initializeAuth();
        }
      } 
      
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setProfile(null);
        setLoading(false);
      }
    });

    // Обработчик фокуса окна - САМОЕ ВАЖНОЕ для "просыпания"
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        // Принудительная ревалидация при возвращении на вкладку
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
  }, []); // Пустой массив зависимостей - эффект запускается один раз

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
