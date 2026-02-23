
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const Notifications: React.FC<{ profile: any }> = ({ profile }) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!profile?.id) return;
    if (!silent) setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false });
    setItems(data || []);
    if (!silent) setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    fetchNotifications();
    
    // Realtime Subscription
    const channel = supabase.channel(`notifications_${profile.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications', 
        filter: `profile_id=eq.${profile.id}` 
      }, () => {
        fetchNotifications(true);
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, fetchNotifications]);

  const markAllAsRead = async () => {
    if (!profile?.id) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('profile_id', profile.id);
    fetchNotifications(true);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold">Уведомления</h2>
          <p className="text-xs text-slate-500 mt-1">Все важные события системы</p>
        </div>
        <button onClick={markAllAsRead} className="text-blue-600 text-sm font-bold hover:underline">Прочитать все</button>
      </div>

      <div className="space-y-4">
        {loading && items.length === 0 ? (
          <div className="flex justify-center py-20">
             <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-[32px] border border-dashed border-slate-200 text-slate-400 flex flex-col items-center">
             <span className="material-icons-round text-5xl mb-3 opacity-20">notifications_off</span>
             <p className="font-medium italic">У вас нет новых уведомлений</p>
          </div>
        ) : (
          items.map(item => (
            <div 
              key={item.id} 
              onClick={async () => {
                if (!item.is_read) {
                  await supabase.from('notifications').update({ is_read: true }).eq('id', item.id);
                  // Optimistic update locally
                  setItems(prev => prev.map(n => n.id === item.id ? { ...n, is_read: true } : n));
                }
                if (item.link) {
                  window.location.hash = item.link;
                }
              }}
              className={`p-5 rounded-[24px] border transition-all relative ${item.link ? 'cursor-pointer hover:bg-blue-50/50 hover:border-blue-200' : ''} ${item.is_read ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-blue-100 shadow-sm ring-1 ring-blue-50'}`}
            >
              <div className="flex justify-between gap-4">
                <p className={`text-sm leading-relaxed ${item.is_read ? 'text-slate-500' : 'text-slate-900 font-medium'}`}>{item.content}</p>
                {!item.is_read && <div className="w-2 h-2 bg-blue-600 rounded-full shrink-0 mt-1.5"></div>}
              </div>
              <div className="flex justify-between items-center mt-3">
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(item.created_at).toLocaleString()}</p>
                 {item.link && <span className="material-icons-round text-slate-300 text-sm">arrow_forward</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
