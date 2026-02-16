
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../ui';
import { formatDate } from '../../../lib/dateUtils';

interface TimelineTabProps {
  object: any;
  profile: any;
}

type TimelineEvent = {
  id: string;
  date: Date;
  type: 'note' | 'task' | 'supply' | 'finance' | 'stage';
  title: string;
  description?: string;
  user_name?: string;
  icon: string;
  color: string; // Tailwind class part (e.g. 'blue', 'red')
  meta?: any;
};

export const TimelineTab: React.FC<TimelineTabProps> = ({ object, profile }) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch raw history first (without join to avoid FK errors)
      const { data: historyData, error: histError } = await supabase
        .from('object_history')
        .select('*')
        .eq('object_id', object.id);

      if (histError) console.error('History fetch error:', histError);

      // 2. Fetch other related data
      const [
        { data: tasks },
        { data: inventory },
        { data: transactions },
        { data: stages }
      ] = await Promise.all([
        supabase.from('tasks').select('id, title, created_at, completed_at, creator:profiles!created_by(full_name), executor:profiles!assigned_to(full_name)').eq('object_id', object.id).is('is_deleted', false),
        supabase.from('inventory_history').select('*, profile:profiles(full_name), item:inventory_items(product:products(name, unit))').eq('to_object_id', object.id).eq('action_type', 'deploy'),
        supabase.from('transactions').select('*, creator:profiles!transactions_created_by_fkey(full_name)').eq('object_id', object.id).is('deleted_at', null),
        supabase.from('object_stages').select('*').eq('object_id', object.id)
      ]);

      // 3. Manual Profile Mapping for History (Robustness fix)
      let historyWithProfiles: any[] = [];
      if (historyData && historyData.length > 0) {
          // Fix TS error: explicit cast to string[] after filtering nulls
          const profileIds = Array.from(new Set(historyData.map((h: any) => h.profile_id).filter((id: any) => !!id))) as string[];
          
          let profiles: any[] = [];
          if (profileIds.length > 0) {
             const { data } = await supabase.from('profiles').select('id, full_name').in('id', profileIds);
             profiles = data || [];
          }
          
          const profileMap = profiles.reduce((acc: any, p: any) => {
              acc[p.id] = p.full_name;
              return acc;
          }, {});

          historyWithProfiles = historyData.map((h: any) => ({
              ...h,
              user_name: h.profile_id ? (profileMap[h.profile_id] || 'Неизвестный') : 'Система'
          }));
      }

      const timeline: TimelineEvent[] = [];

      // Process History (System + Notes)
      historyWithProfiles.forEach((h: any) => {
          timeline.push({
              id: `hist-${h.id}`,
              date: new Date(h.created_at),
              type: 'note',
              title: h.action_text,
              user_name: h.user_name,
              icon: 'article',
              color: 'slate'
          });
      });

      // Process Tasks
      tasks?.forEach((t: any) => {
          // Created
          timeline.push({
              id: `task-create-${t.id}`,
              date: new Date(t.created_at),
              type: 'task',
              title: `Новая задача: ${t.title}`,
              description: `Исполнитель: ${t.executor?.full_name}`,
              user_name: t.creator?.full_name,
              icon: 'assignment_add',
              color: 'blue'
          });
          // Completed
          if (t.completed_at) {
              timeline.push({
                  id: `task-done-${t.id}`,
                  date: new Date(t.completed_at),
                  type: 'task',
                  title: `Выполнена задача: ${t.title}`,
                  user_name: t.executor?.full_name, // Assuming executor completed it
                  icon: 'task_alt',
                  color: 'emerald'
              });
          }
      });

      // Process Inventory
      inventory?.forEach((i: any) => {
          const prodName = i.item?.product?.name || 'Товар';
          timeline.push({
              id: `inv-${i.id}`,
              date: new Date(i.created_at),
              type: 'supply',
              title: `Отгрузка на объект: ${prodName}`,
              description: i.comment,
              user_name: i.profile?.full_name,
              icon: 'local_shipping',
              color: 'indigo'
          });
      });

      // Process Finances
      transactions?.forEach((t: any) => {
          const isIncome = t.type === 'income';
          timeline.push({
              id: `fin-${t.id}`,
              date: new Date(t.created_at),
              type: 'finance',
              title: `${isIncome ? 'План прихода' : 'Запрос расхода'}: ${t.amount} BYN`,
              description: t.category,
              user_name: t.creator?.full_name,
              icon: isIncome ? 'add_card' : 'request_quote',
              color: isIncome ? 'emerald' : 'amber'
          });
      });

      // Process Stages
      const STAGE_NAMES: Record<string, string> = {
        'negotiation': 'Переговоры', 'design': 'Проектирование', 'logistics': 'Логистика', 'assembly': 'Сборка', 
        'mounting': 'Монтаж', 'commissioning': 'Пусконаладка', 'programming': 'Программирование', 'support': 'Поддержка'
      };
      
      stages?.forEach((s: any) => {
          if (s.started_at) {
              timeline.push({
                  id: `stage-start-${s.id}`,
                  date: new Date(s.started_at),
                  type: 'stage',
                  title: `Начат этап: ${STAGE_NAMES[s.stage_name] || s.stage_name}`,
                  user_name: 'Система',
                  icon: 'flag',
                  color: 'purple'
              });
          }
      });

      // Sort Descending
      setEvents(timeline.sort((a, b) => b.date.getTime() - a.date.getTime()));

    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [object.id]);

  const handleAddNote = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!noteText.trim()) return;
      setNoteLoading(true);
      
      try {
          const { error } = await supabase.from('object_history').insert([{
              object_id: object.id,
              profile_id: profile.id,
              action_text: noteText
          }]);
          
          if (error) throw error;

          setNoteText('');
          fetchData();
      } catch (e: any) {
          console.error(e);
          // Check for RLS error specifically to give a helpful hint
          if (e.code === '42501') {
             alert('Ошибка доступа: Не хватает прав для добавления заметки. Выполните SQL-скрипт "Права для заметок" в разделе "База данных".');
          } else {
             alert('Ошибка при добавлении заметки: ' + e.message);
          }
      }
      setNoteLoading(false);
  };

  // Group by Date
  const groupedEvents = useMemo(() => {
      const groups: Record<string, TimelineEvent[]> = {};
      events.forEach(ev => {
          const dateStr = formatDate(ev.date); // e.g. "12.10.2023"
          if (!groups[dateStr]) groups[dateStr] = [];
          groups[dateStr].push(ev);
      });
      return groups;
  }, [events]);

  const getColors = (color: string) => {
      switch (color) {
          case 'blue': return { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' };
          case 'emerald': return { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200' };
          case 'indigo': return { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200' };
          case 'amber': return { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' };
          case 'purple': return { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' };
          case 'red': return { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' };
          default: return { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200' };
      }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-3xl mx-auto">
        
        {/* Input Area */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex gap-3 items-start group focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-50 transition-all">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <span className="material-icons-round text-slate-400">edit_note</span>
            </div>
            <form onSubmit={handleAddNote} className="flex-grow">
                <textarea 
                    className="w-full bg-transparent text-sm text-slate-900 outline-none resize-none placeholder:text-slate-400 h-10 focus:h-24 transition-all duration-300"
                    placeholder="Оставить заметку в хронике проекта..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                />
                {noteText && (
                    <div className="flex justify-end mt-2 animate-in fade-in">
                        <Button type="submit" loading={noteLoading} className="h-8 text-xs">Опубликовать</Button>
                    </div>
                )}
            </form>
        </div>

        {/* Timeline */}
        <div className="relative pl-4 sm:pl-8">
            {/* Vertical Line */}
            <div className="absolute left-[27px] sm:left-[43px] top-0 bottom-0 w-[2px] bg-slate-100"></div>

            {loading ? (
                <div className="py-10 text-center text-slate-400 text-xs">Загрузка истории...</div>
            ) : Object.keys(groupedEvents).length === 0 ? (
                <div className="py-10 text-center text-slate-400 italic">Событий пока нет</div>
            ) : (
                Object.entries(groupedEvents).map(([dateLabel, groupEvents]) => (
                    <div key={dateLabel} className="mb-8 relative">
                        {/* Date Sticky Header */}
                        <div className="sticky top-0 z-10 mb-4 -ml-10 sm:-ml-12 flex items-center">
                            <div className="bg-slate-100 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-full border border-slate-200 shadow-sm uppercase tracking-widest">
                                {dateLabel}
                            </div>
                        </div>

                        <div className="space-y-6">
                            {(groupEvents as TimelineEvent[]).map(event => {
                                const theme = getColors(event.color);
                                return (
                                    <div key={event.id} className="relative pl-8 sm:pl-10 group">
                                        {/* Icon Node */}
                                        <div className={`absolute left-[-13px] sm:left-0 top-0 w-9 h-9 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 ${theme.bg} ${theme.text}`}>
                                            <span className="material-icons-round text-base">{event.icon}</span>
                                        </div>

                                        {/* Content Card */}
                                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={`text-[10px] font-bold uppercase tracking-widest ${theme.text}`}>{event.type === 'note' ? 'Заметка' : event.type}</span>
                                                <span className="text-[10px] text-slate-400">{event.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                            </div>
                                            <p className="text-sm font-medium text-slate-800 leading-snug">{event.title}</p>
                                            {event.description && <p className="text-xs text-slate-500 mt-1">{event.description}</p>}
                                            {event.user_name && (
                                                <div className="mt-3 flex items-center gap-1.5">
                                                    <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-500 font-bold">
                                                        {event.user_name.charAt(0)}
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-bold">{event.user_name}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))
            )}
        </div>
    </div>
  );
};
