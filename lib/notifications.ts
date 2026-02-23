import { supabase } from './supabase';

export const createNotification = async (profileId: string, content: string) => {
  try {
    await supabase.from('notifications').insert({
      profile_id: profileId,
      content,
      is_read: false,
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

export const notifyRole = async (roles: string[], content: string) => {
  try {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .in('role', roles as any);

    if (profiles && profiles.length > 0) {
      const notifications = profiles.map((profile) => ({
        profile_id: profile.id,
        content,
        is_read: false,
      }));

      await supabase.from('notifications').insert(notifications);
    }
  } catch (error) {
    console.error('Error notifying roles:', error);
  }
};
