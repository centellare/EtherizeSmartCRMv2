
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const Notifications: React.FC<{ profile: any }> = ({ profile }) => {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false });
      setItems(data || []);
    };
    if (profile) fetch();
  }, [profile]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold">Уведомления</h2>
        <button className="text-blue-400 text-sm hover:underline">Прочитать все</button>
      </div>

      <div className="space-y-4">
        {items.length === 0 ? (
          <div className="text-center py-20 glass rounded-2xl text-slate-500">
             У вас нет новых уведомлений
          </div>
        ) : (
          items.map(item => (
            <div key={item.id} className={`glass p-4 rounded-xl border-l-4 ${item.is_read ? 'border-slate-700 opacity-60' : 'border-blue-500'}`}>
              <p className="text-slate-200 text-sm">{item.content}</p>
              <p className="text-[10px] text-slate-500 mt-2">{new Date(item.created_at).toLocaleString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
