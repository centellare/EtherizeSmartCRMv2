
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
    if (isFetchingProfile.current) return;
    isFetchingProfile.current = true;

    // Показываем экран загрузки только если это первый вход или если мы явно не просили "тихий" режим
    // и при этом у нас еще нет данных профиля в памяти.
    const shouldShowLoading = !silent && !initialLoadDone.current;
    if (shouldShowLoading) setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        const isAborted = error.name === 'AbortError' || error.message?.toLowerCase().includes('aborted');
        if (!isAborted) {
          console.error('Database error fetching profile:', error.message);
          // Не сбрасываем профиль в null при фоновых ошибках, чтобы не "выбивало" из приложения
          if (shouldShowLoading) setProfile(null);
        }
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
      } else {
        // Если данных нет вовсе (например, запись в таблице профилей отсутствует)
        setProfile(null);
        profileRef.current = null;
      }
    } catch (err: any) {
      const isAborted = err.name === 'AbortError' || err.message?.toLowerCase().includes('aborted');
      if (!isAborted) {
        console.error('Critical auth error:', err);
        if (shouldShowLoading) setProfile(null);
      }
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
            // Первая загрузка - не silent
            await fetchProfile(initialSession.user.id, false);
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
        
        // Ключевой момент: если профиль уже есть (profileRef.current), 
        // любое событие обновления сессии должно проходить в silent режиме.
        const isSilent = !!profileRef.current;

        switch (event) {
          case 'SIGNED_IN':
            setSession(currentSession);
            if (currentSession) {
              await fetchProfile(currentSession.user.id, isSilent);
            }
            break;
            
          case 'TOKEN_REFRESHED':
            setSession(currentSession);
            if (currentSession) {
              await fetchProfile(currentSession.user.id, true); // Всегда silent для рефреша
            }
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

    // Защитный таймер: если за 10 секунд ничего не произошло, убираем лоадер
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
