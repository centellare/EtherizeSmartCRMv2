import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useOnlineUsers = (profileId?: string) => {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!profileId) return;

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: profileId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineIds = Object.keys(state);
        setOnlineUsers(onlineIds);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [profileId]);

  return onlineUsers;
};
