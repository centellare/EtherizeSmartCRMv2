
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
        // ВАЖНО: При ошибке сети мы НЕ сбрасываем profile в null, если он уже был загружен.
        // Сбрасываем только если это первая загрузка, чтобы показать ошибку.
        if (!profileRef.current) {
           // Можно добавить стейт error, но пока оставим как есть, 
           // App.tsx обработает это, но мы не будем делать ложный setProfile(null)
        }
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
        // Данных нет, но и ошибки нет (странный кейс, возможно новый юзер без профиля)
        console.warn('No profile data found');
        setProfile(null);
        profileRef.current = null;
      }
    } catch (err) {
      console.error('Critical auth exception:', err);
    } finally {
      isFetchingProfile.current = false;
      setLoading(false);
    }
  }, []);

  const recoverSession = async () => {
    if (isRecovering) return;
    setIsRecovering(true);
    console.log('🔄 Attempting session recovery...');
    
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        throw new Error('Refresh failed');
      }
      setSession(data.session);
      if (data.session.user) {
        await fetchProfile(data.session.user.id, true);
      }
      console.log('✅ Session recovered');
    } catch (e) {
      console.warn('❌ Session recovery failed:', e);
      // Не делаем logout автоматически, даем пользователю шанс нажать кнопку "Обновить"
    } finally {
      setIsRecovering(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (isMounted) {
          setSession(currentSession);
          if (currentSession?.user) {
            await fetchProfile(currentSession.user.id);
          } else {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Init session error:', err);
        setLoading(false);
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
