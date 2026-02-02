
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useAuth = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    // Включаем лоадер перед запросом профиля
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Database error fetching profile:', error.message);
        setProfile(null);
      } else if (data) {
        if (data.deleted_at) {
          console.warn('Access denied: Profile deactivated');
          // Если профиль удален, разлогиниваем пользователя и сбрасываем локальное состояние
          setProfile(null);
          setSession(null);
          await supabase.auth.signOut();
        } else {
          setProfile(data);
        }
      } else {
        // Профиль не найден в таблице profiles
        setProfile(null);
      }
    } catch (err) {
      console.error('Critical auth error:', err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let authSubscription: any = null;

    const initialize = async () => {
      // 1. Проверяем текущую сессию при загрузке
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (isMounted) {
          setSession(initialSession);
          if (initialSession) {
            await fetchProfile(initialSession.user.id);
          } else {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Session check failed:', err);
        if (isMounted) setLoading(false);
      }

      // 2. Подписываемся на изменения состояния авторизации
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (!isMounted) return;
        
        console.debug(`[Auth Event] ${event}`);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // КРИТИЧЕСКИ ВАЖНО: ставим loading в true ДО обновления сессии, 
          // чтобы App.tsx при ререндере показал спиннер, а не ошибку "профиль не найден"
          setLoading(true);
          setSession(currentSession);
          if (currentSession) {
            await fetchProfile(currentSession.user.id);
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setProfile(null);
          setLoading(false);
        } else if (event === 'USER_UPDATED') {
          if (currentSession) {
            await fetchProfile(currentSession.user.id);
          }
        }
      });
      authSubscription = subscription;
    };

    initialize();

    // Страховочный таймаут: если инициализация зависла более чем на 10 секунд
    const timeout = setTimeout(() => {
      if (isMounted && loading) {
        console.warn('[Auth] Loading state forced to false due to timeout');
        setLoading(false);
      }
    }, 10000);

    return () => {
      isMounted = false;
      if (authSubscription) authSubscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [fetchProfile]);

  return { 
    session, 
    profile, 
    loading, 
    refreshProfile: async () => {
      if (session?.user?.id) await fetchProfile(session.user.id);
    } 
  };
};
