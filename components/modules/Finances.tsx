
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Input, Select, Modal, Badge, ConfirmModal, Toast } from '../ui';
import { Transaction } from '../../types';

const formatBYN = (amount: number = 0) => {
  return new Intl.NumberFormat('ru-BY', {
    style: 'currency',
    currency: 'BYN',
    minimumFractionDigits: 2
  }).format(amount);
};

const getDefaultDates = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return { 
    start: formatDate(new Date(year, month, 1)), 
    end: formatDate(new Date(year, month + 1, 0)) 
  };
};

const Finances: React.FC<{ profile: any }> = ({ profile }) => {
  const defaultDates = useMemo(() => getDefaultDates(), []);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [objects, setObjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [startDate, setStartDate] = useState(defaultDates.start);
  const [endDate, setEndDate] = useState(defaultDates.end);
  const [summaryFilter, setSummaryFilter] = useState<string | null>(null);

  const [isMainModalOpen, setIsMainModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isFinalizeConfirmOpen, setIsFinalizeConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isRejectConfirmOpen, setIsRejectConfirmOpen] = useState(false);
  
  const [selectedTrans, setSelectedTrans] = useState<Transaction | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentComment, setPaymentComment] = useState('');
  const [approvalAmount, setApprovalAmount] = useState('');
  
  const [formData, setFormData] = useState({ 
    object_id: '', 
    amount: '', 
    planned_date: new Date().toISOString().split('T')[0],
    type: 'income' as 'income' | 'expense', 
    category: '',
    description: '',
    doc_link: '',
    doc_name: ''
  });

  const isAdmin = profile?.role === 'admin';
  const isDirector = profile?.role === 'director';
  const isManager = profile?.role === 'manager';
  const isSpecialist = profile?.role === 'specialist';

  const fetchData = useCallback(async (silent = false) => {
    if (!profile?.id) return;
    if (!silent) setLoading(true);
    try {
      let query = supabase
        .from('transactions')
        .select(`
          *, 
          objects(id, name, responsible_id), 
          creator:profiles!transactions_created_by_fkey(full_name),
          processor:profiles!processed_by(full_name),
          payments:transaction_payments(
            *,
            creator:profiles!transaction_payments_created_by_fkey(full_name)
          )
        `)
        .is('deleted_at', null);

      if (isSpecialist) {
        query = query.eq('created_by', profile.id);
      }

      const { data: transData, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      const mappedTrans = (transData || []).map(t => {
        const payments = (t.payments || []).map((p: any) => ({
          ...p,
          created_by_name: p.creator?.full_name || 'Неизвестно'
        })).sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

        return { 
          ...t, 
          payments, 
          created_by_name: t.creator?.full_name || 'Система',
          processor_name: t.processor?.full_name || null
        } as Transaction;
      });

      const { data: objData } = await supabase.from('objects').select('id, name').is('is_deleted', false);
      setTransactions(mappedTrans);
      setObjects(objData || []);
    } catch (error) { console.error('Finance fetch error:', error); }
    if (!silent) setLoading(false);
  }, [profile?.id, isSpecialist]);

  useEffect(() => {
    fetchData();
    // Realtime Subscriptions
    const tChannel = supabase.channel('finances_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaction_payments' }, () => fetchData(true))
      .subscribe();
    return () => { supabase.removeChannel(tChannel); };
  }, [fetchData]);

  const canApprove = (t: Transaction) => {
    if (isAdmin || isDirector) return true;
    if (isManager && t.objects?.responsible_id === profile.id) return true;
    return false;
  };

  const filteredTransactions = useMemo(() => {
    if (!profile?.id) return [];
    return transactions.filter(t => {
      if (!summaryFilter) {
        const tDate = new Date(t.created_at);
        const matchesStart = !startDate || tDate >= new Date(startDate);
        const matchesEnd = !endDate || tDate <= new Date(endDate + 'T23:59:59');
        if (!matchesStart || !matchesEnd) return false;
      }
      if (summaryFilter === 'cash') return (t.type === 'income' && (t.status === 'partial' || t.status === 'approved')) || (t.type === 'expense' && t.status === 'approved');
      if (summaryFilter === 'debt') return t.type === 'income' && (t.status === 'pending' || t.status === 'partial') && (t.amount > (t.fact_amount || 0));
      if (summaryFilter === 'total_income') return t.type === 'income';
      if (summaryFilter === 'approved_expenses') return t.type === 'expense' && t.status === 'approved';
      return typeFilter === 'all' || t.type === typeFilter;
    });
  }, [transactions, typeFilter, startDate, endDate, summaryFilter, profile?.id]);

  const totals = useMemo(() => {
    const dateFiltered = transactions.filter(t => {
      const tDate = new Date(t.created_at);
      const matchesStart = !startDate || tDate >= new Date(startDate);
      const matchesEnd = !endDate || tDate <= new Date(endDate + 'T23:59:59');
      return matchesStart && matchesEnd;
    });

    const inc = dateFiltered.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.fact_amount || 0), 0);
    const debt = dateFiltered.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount - (t.fact_amount || 0)), 0);
    const exp = dateFiltered.filter(t => t.type === 'expense' && t.status === 'approved').reduce((sum, t) => sum + t.amount, 0);
    return { income: inc, debt, expense: exp, balance: inc - exp };
  }, [transactions, startDate, endDate]);

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const amount = Number(formData.amount);
    const { error } = await supabase.from('transactions').insert([{ 
      ...formData, 
      amount: amount,
      planned_amount: amount,
      requested_amount: amount,
      planned_date: formData.type === 'income' ? formData.planned_date : null,
      status: 'pending',
      created_by: profile.id 
    }]);
    if (!error) { 
      setIsMainModalOpen(false); 
      setFormData({ object_id: '', amount: '', planned_date: new Date().toISOString().split('T')[0], type: 'income', category: '', description: '', doc_link: '', doc_name: '' }); 
      setToast({message: 'Запись создана', type: 'success'});
      fetchData(); 
    } else setToast({message: 'Ошибка: ' + error.message, type: 'error'});
    setLoading(false);
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrans) return;
    const amountToAdd = Number(paymentAmount);
    const balanceLeft = selectedTrans.amount - (selectedTrans.fact_amount || 0);
    if (amountToAdd > balanceLeft + 0.01) { setToast({message: 'Сумма превышает остаток!', type: 'error'}); return; }
    
    setLoading(true);
    const { error: pError } = await supabase.from('transaction_payments').insert([{ transaction_id: selectedTrans.id, amount: amountToAdd, comment: paymentComment, created_by: profile.id }]);
    if (!pError) {
      const newFact = (selectedTrans.fact_amount || 0) + amountToAdd;
      await supabase.from('transactions').update({ status: newFact >= selectedTrans.amount - 0.01 ? 'approved' : 'partial', fact_amount: newFact }).eq('id', selectedTrans.id);
      setIsPaymentModalOpen(false); setPaymentAmount(''); setPaymentComment(''); setToast({message: 'Платеж зафиксирован', type: 'success'});
      fetchData();
    }
    setLoading(false);
  };

  const handleApproveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrans) return;
    setLoading(true);
    const { error } = await supabase.from('transactions').update({ status: 'approved', amount: Number(approvalAmount), requested_amount: selectedTrans.requested_amount || selectedTrans.amount, processed_by: profile.id, processed_at: new Date().toISOString() }).eq('id', selectedTrans.id);
    if (!error) { setIsApprovalModalOpen(false); setSelectedTrans(null); setToast({message: 'Расход утвержден', type: 'success'}); fetchData(); }
    setLoading(false);
  };

  const handleRejectExpense = async () => {
    if (!selectedTrans) return;
    setLoading(true);
    const { error } = await supabase.from('transactions').update({ status: 'rejected', processed_by: profile.id, processed_at: new Date().toISOString() }).eq('id', selectedTrans.id);
    if (!error) { setIsRejectConfirmOpen(false); setSelectedTrans(null); setToast({message: 'Заявка отклонена', type: 'success'}); fetchData(); }
    setLoading(false);
  };

  const handleFinalizeIncome = async () => {
    if (!selectedTrans) return;
    setLoading(true);
    await supabase.from('transactions').update({ status: 'approved', amount: selectedTrans.fact_amount || 0, processed_by: profile.id, processed_at: new Date().toISOString() }).eq('id', selectedTrans.id);
    setIsFinalizeConfirmOpen(false); setSelectedTrans(null); setToast({message: 'Приход завершен', type: 'success'}); fetchData();
    setLoading(false);
  };

  const toggleRow = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setExpandedRows(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };

  return (
    <div className="animate-in fade-in duration-500">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f]">Финансы (BYN)</h2>
          {!isSpecialist && (
            <div className="flex gap-2 mt-3">
               <button onClick={() => { setTypeFilter('all'); setSummaryFilter(null); }} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase border transition-all ${typeFilter === 'all' && !summaryFilter ? 'bg-[#005ac1] border-[#005ac1] text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>Все</button>
               <button onClick={() => { setTypeFilter('income'); setSummaryFilter(null); }} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase border transition-all ${typeFilter === 'income' ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>Приходы</button>
               <button onClick={() => { setTypeFilter('expense'); setSummaryFilter(null); }} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase border transition-all ${typeFilter === 'expense' ? 'bg-red-600 border-red-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>Расходы</button>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
           <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input type="date" value={startDate} onChange={(e:any) => setStartDate(e.target.value)} icon="event" className="h-12 !py-2 !text-xs !rounded-2xl min-w-[140px]" />
              <span className="text-slate-300 text-[10px] font-bold uppercase">по</span>
              <Input type="date" value={endDate} onChange={(e:any) => setEndDate(e.target.value)} icon="event" className="h-12 !py-2 !text-xs !rounded-2xl min-w-[140px]" />
           </div>
           <div className="flex gap-2 w-full sm:w-auto ml-2">
              <Button variant="tonal" onClick={() => { setFormData({ ...formData, type: 'expense' }); setIsMainModalOpen(true); }} icon="request_quote" className="flex-1 h-12">Расход</Button>
              {!isSpecialist && <Button onClick={() => { setFormData({ ...formData, type: 'income' }); setIsMainModalOpen(true); }} icon="add_chart" className="flex-1 h-12">Приход</Button>}
           </div>
        </div>
      </div>

      {!isSpecialist && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
           <div onClick={() => setSummaryFilter(summaryFilter === 'cash' ? null : 'cash')} className={`bg-white p-6 rounded-3xl border transition-all cursor-pointer hover:shadow-lg ${summaryFilter === 'cash' ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-[#e1e2e1] shadow-sm'}`}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Касса (Факт)</p>
              <p className="text-2xl font-bold text-emerald-600">{formatBYN(totals.balance)}</p>
           </div>
           <div onClick={() => setSummaryFilter(summaryFilter === 'debt' ? null : 'debt')} className={`bg-white p-6 rounded-3xl border transition-all cursor-pointer hover:shadow-lg ${summaryFilter === 'debt' ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-[#e1e2e1] shadow-sm'}`}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Дебиторка</p>
              <p className="text-2xl font-bold text-blue-600">{formatBYN(totals.debt)}</p>
           </div>
           <div onClick={() => setSummaryFilter(summaryFilter === 'total_income' ? null : 'total_income')} className={`bg-white p-6 rounded-3xl border transition-all cursor-pointer hover:shadow-lg ${summaryFilter === 'total_income' ? 'border-slate-800 ring-4 ring-slate-800/10' : 'border-[#e1e2e1] shadow-sm'}`}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Всего приходов</p>
              <p className="text-2xl font-bold text-slate-800">{formatBYN(totals.income)}</p>
           </div>
           <div onClick={() => setSummaryFilter(summaryFilter === 'approved_expenses' ? null : 'approved_expenses')} className={`bg-white p-6 rounded-3xl border transition-all cursor-pointer hover:shadow-lg ${summaryFilter === 'approved_expenses' ? 'border-red-500 ring-4 ring-red-500/10' : 'border-[#e1e2e1] shadow-sm'}`}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Одобрено расходов</p>
              <p className="text-2xl font-bold text-red-600">{formatBYN(totals.expense)}</p>
           </div>
        </div>
      )}

      <div className="bg-white rounded-[32px] border border-[#e1e2e1] overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Дата</th>
              <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Объект / Описание</th>
              <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Сумма (Запрос)</th>
              <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Факт / Утв.</th>
              <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Статус</th>
              <th className="p-5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredTransactions.map(t => {
              const isExpanded = expandedRows.has(t.id);
              return (
                <React.Fragment key={t.id}>
                  <tr className={`hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50' : ''}`}>
                    <td className="p-5 text-xs text-slate-500">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="p-5">
                      <p className="font-bold text-slate-900">{t.objects?.name}</p>
                      <p className="text-xs text-slate-400 truncate max-w-[200px]">{t.category}: {t.description}</p>
                    </td>
                    <td className="p-5 font-bold">{formatBYN(t.type === 'expense' ? (t.requested_amount || t.amount) : t.amount)}</td>
                    <td className="p-5 font-bold">{t.type === 'income' ? formatBYN(t.fact_amount || 0) : (t.status === 'approved' ? formatBYN(t.amount) : '—')}</td>
                    <td className="p-5"><Badge color={t.status === 'approved' ? 'emerald' : t.status === 'partial' ? 'blue' : t.status === 'rejected' ? 'red' : 'amber'}>{t.status?.toUpperCase()}</Badge></td>
                    <td className="p-5 text-right">
                       <div className="flex justify-end gap-1.5">
                          {t.type === 'income' && t.status !== 'approved' && !isSpecialist && (
                            <button onClick={() => { setSelectedTrans(t); setIsPaymentModalOpen(true); }} className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-all"><span className="material-icons-round text-sm">add_card</span></button>
                          )}
                          {t.type === 'expense' && t.status === 'pending' && canApprove(t) && (
                            <button onClick={() => { setSelectedTrans(t); setApprovalAmount((t.requested_amount || t.amount).toString()); setIsApprovalModalOpen(true); }} className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-all"><span className="material-icons-round text-sm">check</span></button>
                          )}
                       </div>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isMainModalOpen} onClose={() => setIsMainModalOpen(false)} title={formData.type === 'income' ? 'План прихода' : 'Заявка на расход'}>
        <form onSubmit={handleCreateTransaction} className="space-y-4">
          <Select label="Объект" required value={formData.object_id} onChange={(e:any) => setFormData({ ...formData, object_id: e.target.value })} options={[{value: '', label: 'Выберите объект'}, ...objects.map(o => ({value: o.id, label: o.name}))]} icon="business" />
          <Input label="Сумма" type="number" step="0.01" required value={formData.amount} onChange={(e:any) => setFormData({ ...formData, amount: e.target.value })} icon="payments" />
          <Input label="Дата плана" type="date" value={formData.planned_date} onChange={(e:any) => setFormData({ ...formData, planned_date: e.target.value })} icon="calendar_today" />
          <Input label="Категория" required value={formData.category} onChange={(e:any) => setFormData({ ...formData, category: e.target.value })} icon="category" />
          <Input label="Описание" value={formData.description} onChange={(e:any) => setFormData({ ...formData, description: e.target.value })} icon="notes" />
          <Button type="submit" className="w-full h-14" loading={loading} icon="save">Создать операцию</Button>
        </form>
      </Modal>

      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Внести оплату">
        {selectedTrans && (
          <form onSubmit={handleAddPayment} className="space-y-4">
            <Input label="Сумма оплаты" type="number" step="0.01" required value={paymentAmount} onChange={(e:any) => setPaymentAmount(e.target.value)} icon="account_balance_wallet" />
            <Input label="Комментарий" value={paymentComment} onChange={(e:any) => setPaymentComment(e.target.value)} icon="comment" />
            <Button type="submit" className="w-full h-12" loading={loading} icon="check">Подтвердить</Button>
          </form>
        )}
      </Modal>

      <Modal isOpen={isApprovalModalOpen} onClose={() => setIsApprovalModalOpen(false)} title="Утвердить расход">
        <form onSubmit={handleApproveExpense} className="space-y-4">
          <Input label="Сумма к выдаче" type="number" step="0.01" required value={approvalAmount} onChange={(e:any) => setApprovalAmount(e.target.value)} icon="fact_check" />
          <Button type="submit" className="w-full h-12" loading={loading} icon="done">Подтвердить</Button>
        </form>
      </Modal>
    </div>
  );
};

export default Finances;
