
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export const useAuth = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const profileRef = useRef<any>(null);
  const isFetchingProfile = useRef(false);
  const initialLoadDone = useRef(false);

  const fetchProfile = useCallback(async (userId: string, silent = false) => {
    // Если вкладка скрыта, не инициируем новый запрос профиля, чтобы не плодить Pending-статусы
    if (document.visibilityState === 'hidden') return;
    if (isFetchingProfile.current) return;
    
    isFetchingProfile.current = true;
    const shouldShowLoading = !silent && !initialLoadDone.current;
    if (shouldShowLoading) setLoading(true);
    
    try {
      // Используем AbortController для возможности отмены при таймауте на уровне браузера
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Auth check error:', error.message);
        // Не сбрасываем профиль в null при фоновых ошибках (silent=true)
        if (!silent) setProfile(null);
      } else if (data) {
        if (data.deleted_at) {
          setProfile(null);
          profileRef.current = null;
          setSession(null);
          await supabase.auth.signOut();
        } else {
          setProfile(data);
          profileRef.current = data;
          initialLoadDone.current = true;
        }
      }
    } catch (err: any) {
      console.error('Critical auth exception:', err);
    } finally {
      isFetchingProfile.current = false;
      if (shouldShowLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let authSubscription: any = null;

    const initialize = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (isMounted) {
          setSession(initialSession);
          if (initialSession) {
            await fetchProfile(initialSession.user.id, false);
          } else {
            setLoading(false);
          }
        }
      } catch (err) {
        if (isMounted) setLoading(false);
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (!isMounted) return;
        
        const isSilent = !!profileRef.current;

        switch (event) {
          case 'SIGNED_IN':
            setSession(currentSession);
            if (currentSession) await fetchProfile(currentSession.user.id, isSilent);
            break;
            
          case 'TOKEN_REFRESHED':
            setSession(currentSession);
            break;
            
          case 'SIGNED_OUT':
            setSession(null);
            setProfile(null);
            profileRef.current = null;
            initialLoadDone.current = false;
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

    const timeout = setTimeout(() => {
      if (isMounted && loading) setLoading(false);
    }, 8000);

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
