
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Badge, Input, Select, ConfirmModal, Toast } from '../../ui';
import { formatDate } from '../../../lib/dateUtils';

interface ProposalListProps {
  onView: (id: string) => void;
  onEdit: (id: string) => void;
}

const ProposalList: React.FC<ProposalListProps> = ({ onView, onEdit }) => {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

  // Delete State
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('commercial_proposals')
      .select('*, client:clients(name), creator:profiles(full_name)')
      .order('created_at', { ascending: false });
    setList(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    setLoading(true);
    try {
      // 1. Delete items first (manual cascade if not set in DB)
      await supabase.from('cp_items').delete().eq('cp_id', deleteConfirm.id);
      
      // 2. Delete proposal header
      const { error } = await supabase.from('commercial_proposals').delete().eq('id', deleteConfirm.id);
      
      if (error) throw error;
      
      // Optimistic update: remove from UI immediately
      setList(prev => prev.filter(item => item.id !== deleteConfirm.id));
      
      setToast({ message: 'КП удалено', type: 'success' });
      
      // Background refresh to ensure sync
      fetchData();
    } catch (e: any) {
      console.error(e);
      setToast({ message: 'Ошибка удаления: ' + e.message, type: 'error' });
    } finally {
      setLoading(false);
      setDeleteConfirm({ open: false, id: null });
    }
  };

  const filteredList = useMemo(() => {
    return list.filter(item => {
      // Search Filter
      const searchLower = searchQuery.toLowerCase();
      const matchSearch = 
        item.title?.toLowerCase().includes(searchLower) ||
        item.client?.name?.toLowerCase().includes(searchLower) || 
        item.creator?.full_name?.toLowerCase().includes(searchLower) ||
        item.number?.toString().includes(searchLower);

      // Date Filter
      let matchDate = true;
      const itemDate = new Date(item.created_at);
      const now = new Date();
      
      if (dateFilter === 'today') {
        matchDate = itemDate.toDateString() === now.toDateString();
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(now.setDate(now.getDate() - 7));
        matchDate = itemDate >= weekAgo;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
        matchDate = itemDate >= monthAgo;
      }

      return matchSearch && matchDate;
    });
  }, [list, searchQuery, dateFilter]);

  if (loading && list.length === 0) return <div className="p-10 text-center"><div className="w-8 h-8 border-4 border-blue-600 rounded-full animate-spin mx-auto"></div></div>;

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-4 shadow-sm">
        <div className="flex-grow">
          <Input 
            placeholder="Поиск по названию, клиенту, автору или номеру..." 
            value={searchQuery} 
            onChange={(e:any) => setSearchQuery(e.target.value)} 
            icon="search" 
            className="h-10 text-sm"
          />
        </div>
        <div className="w-full md:w-64">
          <Select 
            value={dateFilter} 
            onChange={(e:any) => setDateFilter(e.target.value)}
            options={[
              { value: 'all', label: 'За всё время' },
              { value: 'today', label: 'За сегодня' },
              { value: 'week', label: 'За неделю' },
              { value: 'month', label: 'За месяц' }
            ]}
            icon="calendar_today"
            className="h-10 text-sm !py-0"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredList.length === 0 && (
          <div className="col-span-full py-20 text-center text-slate-400">Список пуст</div>
        )}
        {filteredList.map(cp => (
          <div 
            key={cp.id} 
            onClick={() => onView(cp.id)} 
            className="bg-white p-5 rounded-[24px] border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden flex flex-col h-full"
          >
            {/* Hover Actions */}
            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
              <button 
                onClick={(e) => { e.stopPropagation(); onEdit(cp.id); }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 flex items-center justify-center transition-colors shadow-sm"
                title="Редактировать"
              >
                <span className="material-icons-round text-sm">edit</span>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ open: true, id: cp.id }); }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 flex items-center justify-center transition-colors shadow-sm"
                title="Удалить"
              >
                <span className="material-icons-round text-sm">delete</span>
              </button>
            </div>

            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded w-fit">КП №{cp.number}</p>
              </div>
            </div>
            
            <div className="mb-4 pr-16 flex-grow">
              <h4 className="text-xl font-bold text-slate-900 leading-tight mb-1 line-clamp-2">
                {cp.title || 'Без названия'}
              </h4>
              <p className="text-sm text-slate-500 line-clamp-1">{cp.client?.name}</p>
            </div>
            
            <div className="space-y-2 border-t border-slate-100 pt-3 mt-auto">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-500">Сумма:</span>
                <b className="text-sm text-slate-900 font-bold">{cp.total_amount_byn?.toFixed(2)} BYN</b>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-500">Дата:</span>
                <span className="text-xs text-slate-700 font-medium">{formatDate(cp.created_at)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-500">Автор:</span>
                <span className="text-xs text-slate-700 truncate max-w-[120px]">{cp.creator?.full_name}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal 
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={handleDelete}
        title="Удаление КП"
        message="Вы уверены? КП и все его позиции будут удалены безвозвратно."
        confirmVariant="danger"
        loading={loading}
      />
    </div>
  );
};

export default ProposalList;
