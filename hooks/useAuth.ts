
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export const useAuth = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRecovering, setIsRecovering] = useState(false);
  
  const profileRef = useRef<any>(null);
  const isFetchingProfile = useRef(false);

  const fetchProfile = useCallback(async (userId: string, force = false) => {
    if (isFetchingProfile.current && !force) return;
    
    // Если профиль уже есть в памяти и мы не форсируем обновление — не блокируем UI
    const isBackgroundUpdate = !!profileRef.current;
    if (!isBackgroundUpdate) setLoading(true);
    
    isFetchingProfile.current = true;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching profile:', error.message);
        // Если ошибка авторизации (401), это обработает recoverSession или initSession
      } else if (data) {
        if (data.deleted_at) {
          // Пользователь удален администратором
          console.warn('Profile is deleted');
          setProfile(null);
          profileRef.current = null;
          setSession(null);
          await supabase.auth.signOut();
        } else {
          setProfile(data);
          profileRef.current = data;
        }
      } else {
        console.warn('No profile data found');
        setProfile(null);
        profileRef.current = null;
      }
    } catch (err) {
      console.error('Critical auth exception:', err);
    } finally {
      isFetchingProfile.current = false;
      // Снимаем лоадер только если это была первичная загрузка, чтобы показать интерфейс (или ошибку)
      if (!isBackgroundUpdate) setLoading(false);
    }
  }, []);

  const recoverSession = async () => {
    if (isRecovering) return;
    setIsRecovering(true);
    console.log('🔄 Attempting session recovery...');
    
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        throw new Error(error?.message || 'Refresh failed');
      }
      setSession(data.session);
      if (data.session.user) {
        await fetchProfile(data.session.user.id, true);
      }
      console.log('✅ Session recovered');
    } catch (e: any) {
      console.warn('❌ Session recovery failed:', e.message);
      
      // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ:
      // Если обновление токена не удалось (токен протух или отозван),
      // мы должны принудительно разлогинить пользователя, иначе он зависнет на лоадере.
      const isFatalError = e.message === 'Refresh failed' || 
                           e.message?.includes('invalid_grant') || 
                           e.message?.includes('not_found');

      if (isFatalError || !profileRef.current) {
         console.warn('Force clearing invalid session to prevent stuck loading');
         setSession(null);
         setProfile(null);
         profileRef.current = null;
         setLoading(false); // Убираем спиннер, показываем Auth
         
         // Пытаемся почистить состояние SDK
         try { await supabase.auth.signOut(); } catch {}
      }
    } finally {
      setIsRecovering(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      try {
        // Добавляем проверку error при инициализации
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }
        
        if (isMounted) {
          if (currentSession?.user) {
            setSession(currentSession);
            await fetchProfile(currentSession.user.id);
          } else {
            // Сессии нет - показываем вход
            setSession(null);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Init session error:', err);
        // При ошибке инициализации (например, битый токен) сбрасываем все
        if (isMounted) {
          setSession(null);
          setProfile(null);
          setLoading(false);
        }
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMounted) return;
      
      console.log(`Auth event: ${event}`);

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setProfile(null);
        profileRef.current = null;
        setLoading(false);
      } else if (currentSession) {
        setSession(currentSession);
        // Загружаем профиль, если его нет или юзер сменился
        if (!profileRef.current || profileRef.current.id !== currentSession.user.id) {
          await fetchProfile(currentSession.user.id);
        }
      }
    });

    // Восстановление при фокусе вкладки
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        recoverSession();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [fetchProfile]);

  return { 
    session, 
    profile, 
    loading, 
    recoverSession,
    refreshProfile: async () => {
      if (session?.user?.id) await fetchProfile(session.user.id, true);
    } 
  };
};
