
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useAuth = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
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
          await supabase.auth.signOut();
          setProfile(null);
        } else {
          setProfile(data);
        }
      } else {
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
          setSession(currentSession);
          if (currentSession) {
            await fetchProfile(currentSession.user.id);
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setProfile(null);
          setLoading(false);
        }
      });
      authSubscription = subscription;
    };

    initialize();

    // Страховочный таймаут: если инициализация зависла более чем на 6 секунд
    const timeout = setTimeout(() => {
      if (isMounted && loading) {
        console.warn('[Auth] Loading state forced to false due to timeout');
        setLoading(false);
      }
    }, 6000);

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
