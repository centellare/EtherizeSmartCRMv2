
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useAuth = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      // Выбираем только существующие поля на случай, если SQL еще не применен полностью
      // Но пробуем получить всё, чтобы Soft Delete работал
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(); // maybeSingle не кидает ошибку, если запись не найдена
      
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

    const initAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (isMounted) {
          setSession(initialSession);
          if (initialSession) {
            await fetchProfile(initialSession.user.id);
          } else {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Auth initialization failed:', err);
        if (isMounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (isMounted) {
        setSession(currentSession);
        if (currentSession) {
          await fetchProfile(currentSession.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
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
