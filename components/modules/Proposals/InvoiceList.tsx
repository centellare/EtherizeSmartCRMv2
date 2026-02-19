
import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { Badge, Input, Select, ConfirmModal, Toast } from '../../ui';
import { formatDate } from '../../../lib/dateUtils';

interface InvoiceListProps {
  onView: (id: string) => void;
  onViewCP: (cpId: string) => void;
}

const InvoiceList: React.FC<InvoiceListProps> = ({ onView, onViewCP }) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // --- QUERIES ---

  const { data: list = [], isLoading: loading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data } = await supabase
        .from('invoices')
        .select('*, client:clients(name), commercial_proposal:commercial_proposals(id, number)')
        .order('created_at', { ascending: false });
      return data || [];
    }
  });

  const filteredList = useMemo(() => {
    return list.filter(item => {
      const searchLower = searchQuery.toLowerCase();
      return (
        item.number?.toString().includes(searchLower) ||
        item.client?.name?.toLowerCase().includes(searchLower) ||
        item.commercial_proposal?.number?.toString().includes(searchLower)
      );
    });
  }, [list, searchQuery]);

  const handleDelete = async () => {
      if (!deleteConfirm.id) return;
      // setLoading(true);
      try {
          // 1. Delete associated transactions (Cascade manually)
          // Find transactions linked to this invoice
          const { data: trans } = await supabase.from('transactions').select('id').eq('invoice_id', deleteConfirm.id);
          
          if (trans && trans.length > 0) {
              const tIds = trans.map(t => t.id);
              // Delete payments for these transactions first
              await supabase.from('transaction_payments').delete().in('transaction_id', tIds);
              // Delete transactions
              await supabase.from('transactions').delete().in('id', tIds);
          }

          // 2. Delete invoice items
          await supabase.from('invoice_items').delete().eq('invoice_id', deleteConfirm.id);
          
          // 3. Delete invoice
          const { error } = await supabase.from('invoices').delete().eq('id', deleteConfirm.id);
          if (error) throw error;
          
          setToast({ message: 'Счет удален', type: 'success' });
          queryClient.invalidateQueries({ queryKey: ['invoices'] });
      } catch (e: any) {
          console.error(e);
          setToast({ message: 'Ошибка: ' + e.message, type: 'error' });
      } finally {
          // setLoading(false);
          setDeleteConfirm({ open: false, id: null });
      }
  };

  if (loading && list.length === 0) return <div className="p-10 text-center"><div className="w-8 h-8 border-4 border-blue-600 rounded-full animate-spin mx-auto"></div></div>;

  return (
    <div className="space-y-6 h-full flex flex-col">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm shrink-0">
        <Input 
            placeholder="Поиск по номеру счета, клиенту или номеру КП..." 
            value={searchQuery} 
            onChange={(e:any) => setSearchQuery(e.target.value)} 
            icon="search" 
            className="h-10 text-sm"
        />
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm flex-grow overflow-auto">
         <table className="w-full text-left">
            <thead className="bg-slate-50 border-b sticky top-0 z-10">
                <tr>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Счет №</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Дата</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Клиент</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Сумма</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Статус</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Основание (КП)</th>
                    <th className="p-4 w-20"></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {filteredList.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onView(inv.id)}>
                        <td className="p-4 font-bold text-slate-900">{inv.number}</td>
                        <td className="p-4 text-sm text-slate-600">{formatDate(inv.created_at)}</td>
                        <td className="p-4 text-sm font-medium text-slate-800">{inv.client?.name}</td>
                        <td className="p-4 font-bold text-slate-900">{inv.total_amount?.toFixed(2)} BYN</td>
                        <td className="p-4">
                            <Badge color={inv.status === 'paid' ? 'emerald' : inv.status === 'sent' ? 'blue' : 'slate'}>
                                {inv.status === 'draft' ? 'Черновик' : inv.status === 'paid' ? 'Оплачен' : 'Отправлен'}
                            </Badge>
                        </td>
                        <td className="p-4">
                            {inv.commercial_proposal ? (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); if (inv.commercial_proposal) onViewCP(inv.commercial_proposal.id); }}
                                    className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                                >
                                    КП №{inv.commercial_proposal.number}
                                </button>
                            ) : (
                                <span className="text-xs text-slate-300 italic">—</span>
                            )}
                        </td>
                        <td className="p-4 text-right">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ open: true, id: inv.id }); }}
                                className="w-8 h-8 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-600 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                            >
                                <span className="material-icons-round text-sm">delete</span>
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
         </table>
         {filteredList.length === 0 && (
             <div className="p-10 text-center text-slate-400 italic">Счета не найдены</div>
         )}
      </div>

      <ConfirmModal 
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={handleDelete}
        title="Удаление счета"
        message="Вы уверены? Счет будет удален безвозвратно вместе со связанными транзакциями."
        confirmVariant="danger"
        loading={false}
      />
    </div>
  );
};

export default InvoiceList;
