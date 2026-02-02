
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export const useAuth = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Используем ref для отслеживания актуального профиля в замыканиях
  const profileRef = useRef<any>(null);

  const fetchProfile = useCallback(async (userId: string, silent = false) => {
    if (!silent) setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Database error fetching profile:', error.message);
        // В silent-режиме не сбрасываем старый профиль при сетевой ошибке
        if (!silent) setProfile(null);
      } else if (data) {
        if (data.deleted_at) {
          console.warn('Access denied: Profile deactivated');
          setProfile(null);
          profileRef.current = null;
          setSession(null);
          await supabase.auth.signOut();
        } else {
          setProfile(data);
          profileRef.current = data;
        }
      } else {
        setProfile(null);
        profileRef.current = null;
      }
    } catch (err) {
      console.error('Critical auth error:', err);
      if (!silent) setProfile(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let authSubscription: any = null;

    const initialize = async () => {
      try {
        // 1. Проверяем текущую сессию при загрузке
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

        switch (event) {
          case 'SIGNED_IN':
            setLoading(true);
            setSession(currentSession);
            if (currentSession) await fetchProfile(currentSession.user.id);
            break;
            
          case 'TOKEN_REFRESHED':
            setSession(currentSession);
            // Если профиль уже загружен, обновляем его в фоне (silent: true)
            // Это предотвращает появление спиннера при возврате на вкладку
            if (currentSession) {
              const isSilent = !!profileRef.current;
              await fetchProfile(currentSession.user.id, isSilent);
            }
            break;
            
          case 'SIGNED_OUT':
            setSession(null);
            setProfile(null);
            profileRef.current = null;
            setLoading(false);
            break;
            
          case 'USER_UPDATED':
            if (currentSession) await fetchProfile(currentSession.user.id, true);
            break;
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
      if (session?.user?.id) await fetchProfile(session.user.id, true);
    } 
  };
};
