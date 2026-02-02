
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export const useAuth = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Используем ref для хранения текущего значения профиля для сравнения
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
        if (!silent) setProfile(null);
      } else if (data) {
        if (data.deleted_at) {
          setProfile(null);
          profileRef.current = null;
          setSession(null);
          await supabase.auth.signOut();
        } else {
          // Важнейшее исправление: Сравниваем данные перед обновлением стейта.
          // Это предотвращает создание нового объекта в памяти (re-allocation),
          // который триггерит useEffect во всех модулях (Dashboard, Tasks и т.д.)
          const newDataStr = JSON.stringify(data);
          const oldDataStr = JSON.stringify(profileRef.current);
          
          if (newDataStr !== oldDataStr) {
            profileRef.current = data;
            setProfile(data);
          }
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

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (!isMounted) return;
        
        switch (event) {
          case 'SIGNED_IN':
            setSession(currentSession);
            if (currentSession) await fetchProfile(currentSession.user.id);
            break;
            
          case 'TOKEN_REFRESHED':
            setSession(currentSession);
            if (currentSession) {
              // При обновлении токена обновляем профиль "тихо" (без спиннера)
              // и только если ID совпадает
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

    const timeout = setTimeout(() => {
      if (isMounted && loading) {
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
