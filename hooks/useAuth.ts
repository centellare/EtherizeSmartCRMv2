
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// Типизация профиля
export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'director' | 'manager' | 'specialist' | 'storekeeper' | 'client';
  phone?: string;
  birth_date?: string;
  deleted_at?: string | null;
  is_approved?: boolean;
  avatar_url?: string | null;
  last_seen_at?: string | null;
}

export const useAuth = () => {
  const queryClient = useQueryClient();

  // 1. Получаем текущую сессию
  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return session;
    },
    staleTime: 1000 * 60 * 15, // Сессия свежая 15 минут
  });

  // 2. Получаем профиль только если есть сессия
  const { data: profile, isLoading: isProfileLoading, error: profileError } = useQuery({
    queryKey: ['profile', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data?.deleted_at) {
        // Если пользователь удален, выбрасываем ошибку или возвращаем null
        throw new Error('User deleted');
      }
      
      return data as Profile;
    },
    enabled: !!session?.user?.id, // Запрос идет только когда есть user.id
    retry: 1,
  });

  // Слушатель изменений авторизации
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (event === 'SIGNED_OUT') {
        queryClient.setQueryData(['session'], null);
        queryClient.setQueryData(['profile', undefined], null);
        queryClient.clear(); // Чистим весь кэш при выходе
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        queryClient.setQueryData(['session'], currentSession);
        queryClient.invalidateQueries({ queryKey: ['profile'] });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  // Функция восстановления сессии (для ручного вызова при ошибках сети)
  const recoverSession = async () => {
    await queryClient.invalidateQueries({ queryKey: ['session'] });
    await queryClient.invalidateQueries({ queryKey: ['profile'] });
  };

  // Обработка случая, когда профиль удален
  useEffect(() => {
    if (profileError && profileError.message === 'User deleted') {
      supabase.auth.signOut();
    }
  }, [profileError]);

  return {
    session,
    profile,
    loading: isSessionLoading || isProfileLoading,
    recoverSession,
    refreshProfile: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
    }
  };
};
