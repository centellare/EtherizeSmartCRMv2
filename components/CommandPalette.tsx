
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/dateUtils';

interface CommandPaletteProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

interface SearchResult {
  id: string;
  type: 'object' | 'client' | 'task';
  title: string;
  subtitle?: string;
  meta?: string;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, setIsOpen }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Клавиатурные сокращения
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen]);

  // Фокус при открытии
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Поиск
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      const searchTerm = `%${query}%`;

      try {
        const [objRes, cliRes, taskRes] = await Promise.all([
          supabase.from('objects').select('id, name, address, current_stage').or(`name.ilike.${searchTerm},address.ilike.${searchTerm}`).limit(3),
          supabase.from('clients').select('id, name, type, phone').or(`name.ilike.${searchTerm},phone.ilike.${searchTerm}`).limit(3),
          supabase.from('tasks').select('id, title, deadline, objects(name)').ilike('title', searchTerm).limit(3)
        ]);

        const newResults: SearchResult[] = [];

        if (objRes.data) {
          newResults.push(...objRes.data.map((o: any) => ({
            id: o.id,
            type: 'object' as const,
            title: o.name,
            subtitle: o.address,
            meta: o.current_stage
          })));
        }

        if (cliRes.data) {
          newResults.push(...cliRes.data.map((c: any) => ({
            id: c.id,
            type: 'client' as const,
            title: c.name,
            subtitle: c.type === 'company' ? 'Компания' : 'Физлицо',
            meta: c.phone
          })));
        }

        if (taskRes.data) {
          newResults.push(...taskRes.data.map((t: any) => ({
            id: t.id,
            type: 'task' as const,
            title: t.title,
            subtitle: t.objects?.name,
            meta: t.deadline ? formatDate(t.deadline) : ''
          })));
        }

        setResults(newResults);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleSelect = (item: SearchResult) => {
    let hash = '';
    switch (item.type) {
      case 'object': hash = `objects/${item.id}`; break;
      case 'client': hash = `clients/${item.id}`; break;
      case 'task': hash = `tasks/${item.id}`; break;
    }
    window.location.hash = hash;
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const grouped = {
    objects: results.filter(r => r.type === 'object'),
    clients: results.filter(r => r.type === 'client'),
    tasks: results.filter(r => r.type === 'task'),
  };

  return (
    <div 
      className="fixed inset-0 z-[1300] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] p-4 animate-in fade-in duration-200"
      onClick={() => setIsOpen(false)}
    >
      <div 
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 relative"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-slate-100 bg-white">
          <span className="material-icons-round text-slate-400 text-2xl">search</span>
          <input
            ref={inputRef}
            className="flex-grow text-lg bg-transparent outline-none placeholder:text-slate-400 text-slate-900 h-10"
            placeholder="Поиск по системе..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {loading && <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
          <div className="hidden sm:flex gap-1">
            <span className="px-2 py-1 bg-slate-100 rounded text-[10px] text-slate-500 font-bold border border-slate-200">ESC</span>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-hide bg-white">
          {!query && (
            <div className="p-8 text-center text-slate-400 text-sm">
              <span className="material-icons-round text-3xl mb-2 opacity-30">keyboard_command_key</span>
              <p>Начните вводить название объекта, имя клиента или задачу...</p>
            </div>
          )}

          {query && results.length === 0 && !loading && (
            <div className="p-8 text-center text-slate-400 text-sm">
              <p>Ничего не найдено</p>
            </div>
          )}

          {grouped.objects.length > 0 && (
            <div className="mb-2">
              <p className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Объекты</p>
              {grouped.objects.map(item => <ResultItem key={item.id} item={item} onSelect={handleSelect} icon="business" color="text-blue-500" />)}
            </div>
          )}

          {grouped.clients.length > 0 && (
            <div className="mb-2">
              <p className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Клиенты</p>
              {grouped.clients.map(item => <ResultItem key={item.id} item={item} onSelect={handleSelect} icon="person" color="text-emerald-600" />)}
            </div>
          )}

          {grouped.tasks.length > 0 && (
            <div className="mb-2">
              <p className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Задачи</p>
              {grouped.tasks.map(item => <ResultItem key={item.id} item={item} onSelect={handleSelect} icon="assignment" color="text-amber-500" />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ResultItem = ({ item, onSelect, icon, color }: any) => (
  <button 
    onClick={() => onSelect(item)}
    className="w-full text-left flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
  >
    <div className={`w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center ${color} group-hover:bg-white group-hover:shadow-sm transition-all`}>
      <span className="material-icons-round text-lg">{icon}</span>
    </div>
    <div className="flex-grow min-w-0">
      <p className="text-sm font-bold text-slate-700 truncate group-hover:text-blue-600">{item.title}</p>
      {item.subtitle && <p className="text-xs text-slate-400 truncate">{item.subtitle}</p>}
    </div>
    {item.meta && (
      <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500 font-medium whitespace-nowrap">
        {item.meta}
      </span>
    )}
    <span className="material-icons-round text-slate-300 text-lg opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all">
      subdirectory_arrow_left
    </span>
  </button>
);

export default CommandPalette;
