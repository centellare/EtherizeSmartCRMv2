
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Input, Select, Modal, Badge, ConfirmModal } from '../ui';
import { Transaction } from '../../types';

const formatBYN = (amount: number = 0) => {
  return new Intl.NumberFormat('ru-BY', {
    style: 'currency',
    currency: 'BYN',
    minimumFractionDigits: 2
  }).format(amount);
};

// Исправленный хелпер без UTC сдвига
const getDefaultDates = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return {
    start: formatDate(firstDay),
    end: formatDate(lastDay)
  };
};

const Finances: React.FC<{ profile: any }> = ({ profile }) => {
  const defaultDates = useMemo(() => getDefaultDates(), []);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [objects, setObjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Filters State
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [startDate, setStartDate] = useState(defaultDates.start);
  const [endDate, setEndDate] = useState(defaultDates.end);
  const [summaryFilter, setSummaryFilter] = useState<string | null>(null);

  // Modals
  const [isMainModalOpen, setIsMainModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isFinalizeConfirmOpen, setIsFinalizeConfirmOpen] = useState(false);
  
  const [selectedTrans, setSelectedTrans] = useState<Transaction | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  
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

  const [approvalForm, setApprovalForm] = useState({ amount: '' });

  const isAdmin = profile?.role === 'admin';
  const isDirector = profile?.role === 'director';
  const isSpecialist = profile?.role === 'specialist';

  const resetForm = () => {
    setFormData({
      object_id: '',
      amount: '',
      planned_date: new Date().toISOString().split('T')[0],
      type: 'income',
      category: '',
      description: '',
      doc_link: '',
      doc_name: ''
    });
  };

  const toggleRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchData = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from('transactions')
        .select(`
          *, 
          objects(id, name, responsible_id), 
          creator:profiles!transactions_created_by_fkey(full_name),
          payments:transaction_payments(
            *,
            creator:profiles!transaction_payments_created_by_fkey(full_name)
          )
        `)
        .is('deleted_at', null);

      if (isSpecialist) {
        query = query.eq('created_by', profile.id).eq('type', 'expense');
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
          created_by_name: t.creator?.full_name || 'Система'
        } as Transaction;
      });

      const { data: objData } = await supabase.from('objects').select('id, name').is('is_deleted', false);
      
      setTransactions(mappedTrans);
      setObjects(objData || []);
    } catch (error) {
      console.error('Finance fetch error:', error);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile?.id]);

  const filteredTransactions = useMemo(() => {
    if (!profile?.id) return [];
    return transactions.filter(t => {
      // Если активен один из сводных фильтров (карточек), мы игнорируем временной диапазон,
      // так как суммы в карточках считаются по всем данным (Totals).
      if (!summaryFilter) {
        const tDate = new Date(t.created_at);
        const matchesStart = !startDate || tDate >= new Date(startDate);
        const matchesEnd = !endDate || tDate <= new Date(endDate + 'T23:59:59');
        if (!matchesStart || !matchesEnd) return false;
      }

      // Card Filter Logic
      if (summaryFilter === 'cash') {
        return (t.type === 'income' && (t.status === 'partial' || t.status === 'approved')) ||
               (t.type === 'expense' && t.status === 'approved');
      }
      if (summaryFilter === 'debt') {
        return t.type === 'income' && (t.status === 'pending' || t.status === 'partial') && (t.amount > (t.fact_amount || 0));
      }
      if (summaryFilter === 'total_income') {
        return t.type === 'income';
      }
      if (summaryFilter === 'approved_expenses') {
        return t.type === 'expense' && t.status === 'approved';
      }

      const matchesType = typeFilter === 'all' || t.type === typeFilter;
      return matchesType;
    });
  }, [transactions, typeFilter, startDate, endDate, summaryFilter, profile?.id]);

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    setLoading(true);
    const amount = Number(formData.amount);
    
    const { error } = await supabase.from('transactions').insert([{ 
      ...formData, 
      amount: amount,
      planned_amount: amount,
      planned_date: formData.type === 'income' ? formData.planned_date : null,
      status: 'pending',
      created_by: profile.id 
    }]);

    if (!error) {
      setIsMainModalOpen(false);
      resetForm();
      await fetchData();
    }
    setLoading(false);
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrans || !profile?.id) return;

    const amountToAdd = Number(paymentAmount);
    const balanceLeft = selectedTrans.amount - (selectedTrans.fact_amount || 0);

    // Строгий запрет переплаты
    if (amountToAdd > balanceLeft + 0.01) { // 0.01 на погрешность округления
      alert(`Ошибка: Сумма платежа (${amountToAdd}) превышает остаток по счету (${balanceLeft.toFixed(2)}). Для внесения большей суммы создайте новый приход.`);
      return;
    }

    setLoading(true);
    const newTotalPaid = (selectedTrans.fact_amount || 0) + amountToAdd;
    
    await supabase.from('transaction_payments').insert([{
      transaction_id: selectedTrans.id,
      amount: amountToAdd,
      created_by: profile.id
    }]);

    let newStatus: any = 'partial';
    if (newTotalPaid >= selectedTrans.amount - 0.01) {
      newStatus = 'approved';
    }

    await supabase.from('transactions').update({ 
      status: newStatus,
      fact_amount: newTotalPaid 
    }).eq('id', selectedTrans.id);

    setIsPaymentModalOpen(false);
    setPaymentAmount('');
    await fetchData();
    setLoading(false);
  };

  const handleFinalizeIncome = async () => {
    if (!selectedTrans) return;
    setLoading(true);
    await supabase.from('transactions').update({ 
      amount: selectedTrans.fact_amount,
      status: 'approved' 
    }).eq('id', selectedTrans.id);

    setIsFinalizeConfirmOpen(false);
    await fetchData();
    setLoading(false);
  };

  const handleApproveAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrans) return;
    setLoading(true);
    const finalAmount = Number(approvalForm.amount);
    const originalAmount = selectedTrans.amount;

    const payload: any = { status: 'approved' };
    if (finalAmount !== originalAmount) {
      payload.amount = finalAmount;
      payload.requested_amount = originalAmount;
    }

    await supabase.from('transactions').update(payload).eq('id', selectedTrans.id);
    setIsApprovalModalOpen(false);
    await fetchData();
    setLoading(false);
  };

  const handleReject = async (id: string) => {
    await supabase.from('transactions').update({ status: 'rejected' }).eq('id', id);
    await fetchData();
  };

  const totals = useMemo(() => {
    const inc = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.fact_amount || 0), 0);
    const debt = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount - (t.fact_amount || 0)), 0);
    const exp = transactions.filter(t => t.type === 'expense' && t.status === 'approved').reduce((sum, t) => sum + t.amount, 0);
    return { income: inc, debt, expense: exp, balance: inc - exp };
  }, [transactions]);

  const toggleSummaryFilter = (filter: string) => {
    if (summaryFilter === filter) {
      setSummaryFilter(null);
    } else {
      setSummaryFilter(filter);
      setTypeFilter('all'); // Clear manual type filter when using card filter
    }
  };

  const currentDebt = selectedTrans ? (selectedTrans.amount - (selectedTrans.fact_amount || 0)) : 0;
  const isOverpaidAttempt = Number(paymentAmount) > currentDebt + 0.01;

  if (!profile) return null;

  return (
    <div className="animate-in fade-in duration-500">
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
              <Input 
                type="date" 
                value={startDate} 
                onChange={(e:any) => setStartDate(e.target.value)} 
                icon="event" 
                className="h-12 !py-2 !text-xs !rounded-2xl min-w-[140px]"
              />
              <span className="text-slate-300 text-[10px] font-bold uppercase">по</span>
              <Input 
                type="date" 
                value={endDate} 
                onChange={(e:any) => setEndDate(e.target.value)} 
                icon="event" 
                className="h-12 !py-2 !text-xs !rounded-2xl min-w-[140px]"
              />
              {(startDate !== defaultDates.start || endDate !== defaultDates.end) && (
                <button 
                  onClick={() => { setStartDate(defaultDates.start); setEndDate(defaultDates.end); }}
                  className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 transition-colors"
                  title="Сбросить период"
                >
                  <span className="material-icons-round text-sm">restart_alt</span>
                </button>
              )}
           </div>
           <div className="flex gap-2 w-full sm:w-auto ml-2">
              <Button variant="tonal" onClick={() => { resetForm(); setFormData(p => ({...p, type: 'expense'})); setIsMainModalOpen(true); }} icon="request_quote" className="flex-1 h-12">Расход</Button>
              {!isSpecialist && <Button onClick={() => { resetForm(); setFormData(p => ({...p, type: 'income'})); setIsMainModalOpen(true); }} icon="add_chart" className="flex-1 h-12">Приход</Button>}
           </div>
        </div>
      </div>

      {!isSpecialist && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
           <div 
             onClick={() => toggleSummaryFilter('cash')}
             className={`bg-white p-6 rounded-3xl border transition-all cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] ${summaryFilter === 'cash' ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-[#e1e2e1] shadow-sm'}`}
           >
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex justify-between">
                <span>Касса (Факт)</span>
                {summaryFilter === 'cash' && <span className="material-icons-round text-emerald-500 text-xs">filter_alt</span>}
              </p>
              <p className="text-2xl font-bold text-emerald-600">{formatBYN(totals.balance)}</p>
           </div>
           <div 
             onClick={() => toggleSummaryFilter('debt')}
             className={`bg-white p-6 rounded-3xl border transition-all cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] ${summaryFilter === 'debt' ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-[#e1e2e1] shadow-sm'}`}
           >
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex justify-between">
                <span>Дебиторка</span>
                {summaryFilter === 'debt' && <span className="material-icons-round text-blue-500 text-xs">filter_alt</span>}
              </p>
              <p className="text-2xl font-bold text-blue-600">{formatBYN(totals.debt)}</p>
           </div>
           <div 
             onClick={() => toggleSummaryFilter('total_income')}
             className={`bg-white p-6 rounded-3xl border transition-all cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] ${summaryFilter === 'total_income' ? 'border-slate-800 ring-4 ring-slate-800/10' : 'border-[#e1e2e1] shadow-sm'}`}
           >
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex justify-between">
                <span>Всего приходов</span>
                {summaryFilter === 'total_income' && <span className="material-icons-round text-slate-800 text-xs">filter_alt</span>}
              </p>
              <p className="text-2xl font-bold text-slate-800">{formatBYN(totals.income)}</p>
           </div>
           <div 
             onClick={() => toggleSummaryFilter('approved_expenses')}
             className={`bg-white p-6 rounded-3xl border transition-all cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] ${summaryFilter === 'approved_expenses' ? 'border-red-500 ring-4 ring-red-500/10' : 'border-[#e1e2e1] shadow-sm'}`}
           >
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex justify-between">
                <span>Одобрено расходов</span>
                {summaryFilter === 'approved_expenses' && <span className="material-icons-round text-red-500 text-xs">filter_alt</span>}
              </p>
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
              <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Сумма (План)</th>
              <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Факт</th>
              <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Статус</th>
              <th className="p-5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredTransactions.map(t => {
              const isExpanded = expandedRows.has(t.id);
              const payments = t.payments || [];
              const hasPayments = payments.length > 0;
              const balanceLeft = t.amount - (t.fact_amount || 0);
              const lastPayment = hasPayments ? payments[0] : null;
              const canApprove = isAdmin || isDirector || (profile?.role === 'manager' && t.objects?.responsible_id === profile?.id);

              const todayStr = new Date().toISOString().split('T')[0];
              const isOverdue = t.type === 'income' && t.status !== 'approved' && t.planned_date && t.planned_date < todayStr;
              const daysDiff = isOverdue ? Math.floor((new Date(todayStr).getTime() - new Date(t.planned_date!).getTime()) / (1000 * 86400)) : 0;

              return (
                <React.Fragment key={t.id}>
                  <tr className={`hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50' : ''} ${isOverdue ? 'border-l-4 border-l-red-500' : ''}`}>
                    <td className="p-5 text-xs text-slate-500 font-medium">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="p-5">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900">{t.objects?.name}</p>
                        {t.doc_link && (
                           <a href={t.doc_link} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700">
                             <span className="material-icons-round text-base">attach_file</span>
                           </a>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate max-w-[200px]">{t.category}: {t.description}</p>
                    </td>
                    <td className="p-5">
                      <div className="flex flex-col">
                        <span className={`font-bold text-base ${t.type === 'income' ? 'text-emerald-700' : 'text-red-700'}`}>
                          {formatBYN(t.amount)}
                        </span>
                        {t.planned_date && (
                          <div className="flex flex-col mt-0.5">
                            <div className="flex items-center gap-1">
                               <span className={`text-[9px] font-bold uppercase ${isOverdue ? 'text-red-600' : 'text-blue-500'}`}>
                                 Срок: {new Date(t.planned_date).toLocaleDateString()}
                               </span>
                               {isOverdue && <span className="material-icons-round text-[12px] text-red-600 animate-pulse">priority_high</span>}
                            </div>
                            {isOverdue && (
                              <span className="text-[8px] font-bold text-red-500 uppercase tracking-tighter">Просрочено на {daysDiff} дн.</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-5">
                      {t.type === 'income' ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">{formatBYN(t.fact_amount || 0)}</span>
                            <button 
                              onClick={(e) => toggleRow(t.id, e)}
                              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isExpanded ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                              title="История платежей"
                            >
                              <span className="material-icons-round text-sm">{isExpanded ? 'expand_less' : 'history'}</span>
                            </button>
                            {hasPayments && <span className="text-[10px] font-bold text-slate-400">({payments.length})</span>}
                          </div>
                          {lastPayment && (
                            <p className="text-[9px] font-bold text-emerald-600 uppercase">Последний: {new Date(lastPayment.payment_date).toLocaleDateString()}</p>
                          )}
                          {balanceLeft > 0.01 && t.status !== 'approved' && (
                            <p className="text-[9px] font-bold text-red-500 uppercase">Остаток: {formatBYN(balanceLeft)}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">—</p>
                      )}
                    </td>
                    <td className="p-5">
                      <Badge color={t.status === 'approved' ? 'emerald' : t.status === 'partial' ? 'blue' : t.status === 'rejected' ? 'red' : 'amber'}>
                        {t.status === 'partial' ? 'ЧАСТИЧНО' : t.status?.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="p-5 text-right">
                      <div className="flex justify-end gap-1.5">
                        {t.type === 'income' && t.status !== 'approved' && !isSpecialist && (
                          <div className="flex gap-1">
                            <button 
                              onClick={() => { setSelectedTrans(t); setPaymentAmount(''); setIsPaymentModalOpen(true); }}
                              className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center shadow-sm"
                            >
                              <span className="material-icons-round text-sm">add_card</span>
                            </button>
                            {t.status === 'partial' && (
                               <button 
                                onClick={() => { setSelectedTrans(t); setIsFinalizeConfirmOpen(true); }}
                                className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center shadow-sm"
                              >
                                <span className="material-icons-round text-sm">verified</span>
                              </button>
                            )}
                          </div>
                        )}
                        {t.type === 'expense' && t.status === 'pending' && canApprove && (
                          <div className="flex gap-1">
                            <button 
                              onClick={() => { setSelectedTrans(t); setApprovalForm({amount: t.amount.toString()}); setIsApprovalModalOpen(true); }} 
                              className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center shadow-sm"
                            >
                              <span className="material-icons-round text-sm">done</span>
                            </button>
                            <button 
                              onClick={() => handleReject(t.id)} 
                              className="w-9 h-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-sm"
                            >
                              <span className="material-icons-round text-sm">close</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={6} className="p-0 border-b border-slate-100">
                         <div className="p-6 pl-16 space-y-4 animate-in slide-in-from-top-3 duration-300">
                            <div className="flex items-center gap-2 mb-2">
                               <span className="material-icons-round text-xs text-slate-400">history</span>
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Детализация платежей</p>
                            </div>
                            {payments.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">Платежей пока не зафиксировано</p>
                            ) : (
                              <div className="grid grid-cols-1 gap-2">
                                {payments.map(p => (
                                  <div key={p.id} className="flex items-center justify-between py-3 px-4 bg-white/60 border border-slate-100 rounded-xl hover:bg-white transition-colors">
                                     <div className="flex flex-col">
                                        <span className="text-sm font-bold text-emerald-800">+{formatBYN(p.amount)}</span>
                                        <span className="text-[9px] text-slate-400 font-bold uppercase">
                                          {new Date(p.payment_date).toLocaleDateString()} в {new Date(p.payment_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                     </div>
                                     <div className="flex flex-col items-end">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{p.created_by_name}</span>
                                        <span className="text-[9px] text-slate-300 uppercase">Зафиксировано</span>
                                     </div>
                                  </div>
                                ))}
                              </div>
                            )}
                         </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {filteredTransactions.length === 0 && (
          <div className="p-20 text-center text-slate-300 italic flex flex-col items-center">
            <span className="material-icons-round text-5xl mb-3">money_off</span>
            <p>Движений за выбранный период не найдено</p>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Внести платеж">
        {selectedTrans && (
          <form onSubmit={handleAddPayment} className="space-y-6">
            <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl">
               <div className="flex justify-between items-center mb-1">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Остаток по счету</p>
                 <button 
                  type="button"
                  onClick={() => setPaymentAmount(currentDebt.toString())}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase"
                 >Вся сумма</button>
               </div>
               <p className="text-xl font-bold text-slate-800">{formatBYN(currentDebt)}</p>
            </div>

            <div className="space-y-2">
              <Input 
                label="Сумма (BYN)" 
                type="number" 
                step="0.01" 
                autoFocus 
                required 
                max={currentDebt.toFixed(2)}
                value={paymentAmount} 
                onChange={(e:any) => setPaymentAmount(e.target.value)} 
                icon="account_balance_wallet" 
                className={isOverpaidAttempt ? 'border-red-500 text-red-600' : ''}
              />
              {isOverpaidAttempt && (
                <p className="text-[10px] text-red-600 font-bold uppercase ml-1">Сумма превышает долг!</p>
              )}
            </div>

            <Button 
              type="submit" 
              className={`w-full h-14 ${isOverpaidAttempt ? 'opacity-50 cursor-not-allowed' : ''}`} 
              icon="send" 
              loading={loading}
              disabled={isOverpaidAttempt || !paymentAmount || Number(paymentAmount) <= 0}
            >
              Зафиксировать
            </Button>
          </form>
        )}
      </Modal>

      {/* Остальные модалки */}
      <Modal isOpen={isMainModalOpen} onClose={() => { setIsMainModalOpen(false); resetForm(); }} title={formData.type === 'income' ? 'Новый план прихода' : 'Запрос на расход'}>
        <form onSubmit={handleCreateTransaction} className="space-y-4 pb-4">
          <Select label="Объект" required value={formData.object_id} onChange={(e:any) => setFormData({...formData, object_id: e.target.value})} options={[{value: '', label: 'Выберите объект'}, ...objects.map(o => ({value: o.id, label: o.name}))]} icon="business" />
          <Input label="Сумма (BYN)" type="number" step="0.01" required value={formData.amount} onChange={(e:any) => setFormData({...formData, amount: e.target.value})} icon="payments" />
          {formData.type === 'income' && (
            <Input label="Дата зачисления" type="date" required value={formData.planned_date} onChange={(e:any) => setFormData({...formData, planned_date: e.target.value})} icon="event" />
          )}
          <Input label="Категория" required value={formData.category} onChange={(e:any) => setFormData({...formData, category: e.target.value})} icon="category" />
          <div className="bg-slate-100/50 p-4 rounded-2xl border border-slate-200 space-y-4">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Файлы и ссылки (опционально)</p>
             <Input label="Название документа" value={formData.doc_name} onChange={(e:any) => setFormData({...formData, doc_name: e.target.value})} icon="description" />
             <Input label="URL-ссылка" value={formData.doc_link} onChange={(e:any) => setFormData({...formData, doc_link: e.target.value})} icon="link" />
          </div>
          <div className="w-full">
            <label className="block text-xs font-medium text-[#444746] mb-1.5 ml-1">Описание</label>
            <textarea className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm outline-none focus:border-blue-500 shadow-inner" rows={3} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
          </div>
          <Button type="submit" className="w-full h-12" icon="check" loading={loading}>Создать запись</Button>
        </form>
      </Modal>

      <Modal isOpen={isApprovalModalOpen} onClose={() => setIsApprovalModalOpen(false)} title="Одобрение расхода">
        {selectedTrans && (
          <form onSubmit={handleApproveAction} className="space-y-5">
            <Input label="Итоговая сумма (BYN)" type="number" step="0.01" required value={approvalForm.amount} onChange={(e:any) => setApprovalForm({...approvalForm, amount: e.target.value})} icon="fact_check" />
            <Button type="submit" className="w-full h-12" icon="verified" loading={loading}>Подтвердить</Button>
          </form>
        )}
      </Modal>

      <ConfirmModal 
        isOpen={isFinalizeConfirmOpen}
        onClose={() => setIsFinalizeConfirmOpen(false)}
        onConfirm={handleFinalizeIncome}
        title="Завершить оплату?"
        message={`Сумма счета будет изменена на фактически оплаченную (${formatBYN(selectedTrans?.fact_amount)}) и закрыта.`}
        confirmLabel="Да, завершить"
        confirmVariant="tonal"
        loading={loading}
      />
    </div>
  );
};

export default Finances;
