import { supabase } from './supabase';
import { sendTelegramMessage } from './telegram';

export const createNotification = async (profileId: string, content: string, link?: string, telegramContent?: string) => {
  try {
    await supabase.from('notifications').insert({
      profile_id: profileId,
      content,
      link,
      is_read: false,
    });

    // Send Telegram notification if user has chat ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', profileId)
      .single();

    if ((profile as any)?.telegram_chat_id) {
      await sendTelegramMessage((profile as any).telegram_chat_id, telegramContent || content);
    }
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

export const notifyRole = async (roles: string[], content: string, link?: string) => {
  try {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, telegram_chat_id')
      .in('role', roles as any);

    if (profiles && profiles.length > 0) {
      const notifications = profiles.map((profile) => ({
        profile_id: profile.id,
        content,
        link,
        is_read: false,
      }));

      await supabase.from('notifications').insert(notifications);

      // Send Telegram notifications
      for (const profile of profiles) {
        if ((profile as any).telegram_chat_id) {
          // Fire and forget, don't await inside loop to speed up
          sendTelegramMessage((profile as any).telegram_chat_id, content);
        }
      }
    }
  } catch (error) {
    console.error('Error notifying roles:', error);
  }
};
