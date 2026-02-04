import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, measureQuery } from '../../lib/supabase';
import { Button, Input, Select, Modal, Badge, ConfirmModal, Toast } from '../ui';
import { Transaction } from '../../types';
import { formatDate, getMinskISODate } from '../../lib/dateUtils';

const formatBYN = (amount: number = 0) => {
  return new Intl.NumberFormat('ru-BY', {
    style: 'currency',
    currency: 'BYN',
    minimumFractionDigits: 2
  }).format(amount);
};

const DOC_TYPES = [
  { value: 'Акт', label: 'Акт' },
  { value: 'ТН', label: 'ТН' },
  { value: 'ТТН', label: 'ТТН' }
];

const Finances: React.FC<{ profile: any }> = ({ profile }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [objects, setObjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [summaryFilter, setSummaryFilter] = useState<string | null>(null);
  const [unclosedDocsOnly, setUnclosedDocsOnly] = useState(false);
  const [docSearchQuery, setDocSearchQuery] = useState('');

  const [isMainModalOpen, setIsMainModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPaymentDetailsModalOpen, setIsPaymentDetailsModalOpen] = useState(false);
  const [isEditingDoc, setIsEditingDoc] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isFinalizeConfirmOpen, setIsFinalizeConfirmOpen] = useState(false);
  const [isRejectConfirmOpen, setIsRejectConfirmOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  
  const [selectedTrans, setSelectedTrans] = useState<any>(null);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentComment, setPaymentComment] = useState('');
  const [requiresDoc, setRequiresDoc] = useState(false);
  const [docType, setDocType] = useState('Акт');
  const [docNumber, setDocNumber] = useState('');
  const [docDate, setDocDate] = useState('');
  const [approvalAmount, setApprovalAmount] = useState('');
  
  const today = getMinskISODate();

  const [formData, setFormData] = useState({ 
    object_id: '', 
    amount: '', 
    planned_date: today,
    type: 'income' as 'income' | 'expense', 
    category: '',
    description: '',
    doc_link: '',
    doc_name: ''
  });

  const resetForm = () => {
    setFormData({ 
      object_id: '', 
      amount: '', 
      planned_date: today, 
      type: 'income', 
      category: '', 
      description: '', 
      doc_link: '', 
      doc_name: '' 
    });
    setIsEditMode(false);
  };

  const isAdmin = profile?.role === 'admin';
  const isDirector = profile?.role === 'director';
  const isManager = profile?.role === 'manager';
  const isSpecialist = profile?.role === 'specialist';
  const canApprove = isAdmin || isDirector || isManager;
  const canEditDelete = isAdmin || isDirector;

  const fetchSingleTransaction = async (id: string) => {
    const { data } = await supabase
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
      .eq('id', id)
      .single();
    
    if (data) {
       return {
          ...data,
          payments: (data.payments || []).sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()),
          created_by_name: data.creator?.full_name || 'Система',
          processor_name: data.processor?.full_name || null
       };
    }
    return null;
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!profile?.id) return;
    const isInitial = transactions.length === 0 && !silent;
    if (isInitial) setLoading(true);
    
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

      const result = await measureQuery(query.order('created_at', { ascending: false }));
      if (result.error) throw result.error;

      if (result.data) {
        const mappedTrans = result.data.map((t: any) => ({
          ...t,
          payments: (t.payments || []).sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()),
          created_by_name: t.creator?.full_name || 'Система',
          processor_name: t.processor?.full_name || null
        }));
        setTransactions(mappedTrans);
      }

      const { data: objData } = await supabase.from('objects').select('id, name').is('is_deleted', false);
      if (objData) setObjects(objData);
    } catch (error) { 
      console.error('Finance fetch error:', error); 
    } finally {
      setLoading(false);
    }
  }, [profile?.id, isSpecialist, transactions.length]);

  useEffect(() => {
    fetchData();
  }, [fetchData, typeFilter, startDate, endDate, summaryFilter, unclosedDocsOnly, docSearchQuery]);

  useEffect(() => {
    const tChannel = supabase.channel('finances_smart_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const newTrans = await fetchSingleTransaction(payload.new.id);
          if (newTrans) setTransactions(prev => [newTrans, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          if (payload.new.deleted_at) {
             setTransactions(prev => prev.filter(t => t.id !== payload.new.id));
          } else {
             const updatedTrans = await fetchSingleTransaction(payload.new.id);
             if (updatedTrans) setTransactions(prev => prev.map(t => t.id === updatedTrans.id ? updatedTrans : t));
          }
        } else if (payload.eventType === 'DELETE') {
           setTransactions(prev => prev.filter(t => t.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaction_payments' }, async (payload) => {
        const newRecord = payload.new as any;
        const oldRecord = payload.old as any;
        const tid = newRecord.transaction_id || oldRecord.transaction_id;
        
        if (tid) {
           const updatedTrans = await fetchSingleTransaction(tid);
           if (updatedTrans) setTransactions(prev => prev.map(t => t.id === updatedTrans.id ? updatedTrans : t));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(tChannel); };
  }, [fetchData]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t: any) => {
      const tDateStr = getMinskISODate(t.created_at);
      const matchesStart = !startDate || tDateStr >= startDate;
      const matchesEnd = !endDate || tDateStr <= endDate;
      if (!matchesStart || !matchesEnd) return false;

      const searchLower = docSearchQuery.toLowerCase();
      const matchesDocSearch = !docSearchQuery || t.payments?.some((p: any) => 
        (p.doc_number?.toLowerCase().includes(searchLower)) ||
        (p.doc_type?.toLowerCase().includes(searchLower)) ||
        (p.doc_date && formatDate(p.doc_date).includes(docSearchQuery))
      );
      if (!matchesDocSearch) return false;

      const hasUnclosedDoc = t.payments?.some((p: any) => p.requires_doc && !p.doc_number);
      if (unclosedDocsOnly && !hasUnclosedDoc) return false;

      if (summaryFilter === 'cash') return (t.type === 'income' && t.status !== 'pending') || (t.type === 'expense' && t.status === 'approved');
      if (summaryFilter === 'debt') return t.type === 'income' && t.status !== 'approved';
      if (summaryFilter === 'total_income') return t.type === 'income';
      if (summaryFilter === 'approved_expenses') return t.type === 'expense' && t.status === 'approved';
      
      return typeFilter === 'all' || t.type === typeFilter;
    });
  }, [transactions, typeFilter, startDate, endDate, summaryFilter, unclosedDocsOnly, docSearchQuery]);

  const totals = useMemo(() => {
    const data = transactions.filter(t => {
      const tDateStr = getMinskISODate(t.created_at);
      return (!startDate || tDateStr >= startDate) && (!endDate || tDateStr <= endDate);
    });
    const factIncome = data.filter(t => t.type === 'income').reduce((s, t) => s + (t.fact_amount || 0), 0);
    const planIncome = data.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const factExpenses = data.filter(t => t.type === 'expense' && t.status === 'approved').reduce((s, t) => s + t.amount, 0);
    return { income: factIncome, debt: planIncome - factIncome, expense: factExpenses, balance: factIncome - factExpenses };
  }, [transactions, startDate, endDate]);

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const amount = Number(formData.amount);
    
    if (isEditMode && selectedTrans) {
      const { error } = await supabase.from('transactions').update({ 
        ...formData, 
        amount, 
        planned_amount: formData.type === 'income' ? amount : null,
        requested_amount: formData.type === 'expense' ? amount : null,
        planned_date: formData.type === 'income' ? formData.planned_date : null
      }).eq('id', selectedTrans.id);
      
      if (!error) {
        setIsMainModalOpen(false);
        resetForm();
        setToast({message: 'Запись обновлена', type: 'success'});
        await fetchData(true);
      }
    } else {
      const { error } = await supabase.from('transactions').insert([{ 
        ...formData, 
        amount, planned_amount: amount, requested_amount: amount,
        planned_date: formData.type === 'income' ? formData.planned_date : null,
        status: 'pending', created_by: profile.id 
      }]);
      if (!error) { 
        setIsMainModalOpen(false); 
        resetForm();
        setToast({message: 'Запись создана', type: 'success'}); 
        await fetchData(true);
      }
    }
    setLoading(false);
  };

  const handleEditInit = (trans: any) => {
    setSelectedTrans(trans);
    setFormData({
      object_id: trans.object_id,
      amount: (trans.type === 'expense' ? (trans.requested_amount || trans.amount) : trans.amount).toString(),
      planned_date: trans.planned_date ? getMinskISODate(trans.planned_date) : today,
      type: trans.type,
      category: trans.category,
      description: trans.description || '',
      doc_link: trans.doc_link || '',
      doc_name: trans.doc_name || ''
    });
    setIsEditMode(true);
    setIsDetailsModalOpen(false);
    setIsMainModalOpen(true);
  };

  const handleDeleteTransaction = async () => {
    if (!deleteConfirm.id) return;
    setLoading(true);
    const { error } = await supabase
      .from('transactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', deleteConfirm.id);
    
    if (!error) {
      setToast({ message: 'Запись удалена', type: 'success' });
      setDeleteConfirm({ open: false, id: null });
      setIsDetailsModalOpen(false);
      await fetchData(true);
    }
    setLoading(false);
  };

  const handleUpdatePaymentDoc = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedPayment) return;
    setLoading(true);
    
    const payload = {
      requires_doc: requiresDoc,
      doc_type: requiresDoc ? docType : null,
      doc_number: requiresDoc ? docNumber : null,
      doc_date: (requiresDoc && docDate) ? docDate : null
    };

    const { error } = await supabase
      .from('transaction_payments')
      .update(payload)
      .eq('id', selectedPayment.id);

    if (!error) {
      setIsEditingDoc(false);
      setIsPaymentDetailsModalOpen(false);
      setToast({message: 'Данные платежа успешно обновлены', type: 'success'});
      await fetchData(true);
    } else {
      console.error('Update Payment Error:', error);
      setToast({message: `Ошибка: ${error.message}. Проверьте права доступа (RLS).`, type: 'error'});
    }
    setLoading(false);
  };

  const handleApproveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrans) return;
    const amount = Number(approvalAmount);
    if (amount > (selectedTrans.requested_amount || selectedTrans.amount)) {
      alert('Сумма утверждения не может быть больше запрошенной');
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('transactions').update({
      status: 'approved',
      amount: amount,
      processed_by: profile.id,
      processed_at: new Date().toISOString()
    }).eq('id', selectedTrans.id);
    
    if (!error) {
      setIsApprovalModalOpen(false);
      setToast({message: 'Расход утвержден', type: 'success'});
      await fetchData(true);
    }
    setLoading(false);
  };

  const handleRejectExpense = async () => {
    if (!selectedTrans) return;
    setLoading(true);
    const { error } = await supabase.from('transactions').update({
      status: 'rejected',
      processed_by: profile.id,
      processed_at: new Date().toISOString()
    }).eq('id', selectedTrans.id);
    
    if (!error) {
      setIsRejectConfirmOpen(false);
      setToast({message: 'Заявка отклонена', type: 'success'});
      await fetchData(true);
    }
    setLoading(false);
  };

  const handleFinalizeIncome = async () => {
    if (!selectedTrans) return;
    setLoading(true);
    const { error } = await supabase.from('transactions').update({
      status: 'approved',
      amount: selectedTrans.fact_amount || 0
    }).eq('id', selectedTrans.id);
    
    if (!error) {
      setIsFinalizeConfirmOpen(false);
      setToast({message: 'Приход финализирован по факту', type: 'success'});
      await fetchData(true);
    }
    setLoading(false);
  };

  const getTransactionDocStatus = (t: any) => {
    const p = t.payments || [];
    if (p.length === 0) return 'none';
    const docsRequired = p.filter((pay: any) => pay.requires_doc);
    if (docsRequired.length === 0) return 'none';
    const allIn = docsRequired.every((pay: any) => !!pay.doc_number);
    return allIn ? 'complete' : 'missing';
  };

  const openPaymentDetails = (payment: any, transaction: any) => {
    setSelectedTrans(transaction);
    setSelectedPayment(payment);
    setRequiresDoc(payment.requires_doc || false);
    setDocType(payment.doc_type || 'Акт');
    setDocNumber(payment.doc_number || '');
    setDocDate(payment.doc_date || '');
    setIsEditingDoc(false);
    setIsPaymentDetailsModalOpen(true);
  };

  return (
    <div className="animate-in fade-in duration-500">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f] flex items-center gap-3">Финансы</h2>
          <div className="flex flex-wrap gap-2 mt-3">
             <button onClick={() => { setTypeFilter('all'); setSummaryFilter(null); }} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase border ${typeFilter === 'all' && !summaryFilter ? 'bg-[#005ac1] text-white' : 'bg-white text-slate-500'}`}>Все</button>
             <button onClick={() => { setTypeFilter('income'); setSummaryFilter(null); }} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase border ${typeFilter === 'income' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500'}`}>Приходы</button>
             <button onClick={() => { setTypeFilter('expense'); setSummaryFilter(null); }} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase border ${typeFilter === 'expense' ? 'bg-red-600 text-white' : 'bg-white text-slate-500'}`}>Расходы</button>
             <div className="h-8 w-[1px] bg-slate-200 mx-2 hidden md:block"></div>
             <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors">
               <input type="checkbox" checked={unclosedDocsOnly} onChange={(e) => setUnclosedDocsOnly(e.target.checked)} className="w-4 h-4 rounded text-red-600 focus:ring-red-500" />
               <span className="text-[10px] font-bold text-red-600 uppercase">Без документов</span>
             </label>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
           <div className="flex items-center gap-2 flex-grow sm:flex-grow-0">
              <Input placeholder="Акт № / Дата..." value={docSearchQuery} onChange={(e:any) => setDocSearchQuery(e.target.value)} icon="search" className="h-12 !py-2 !text-xs w-full sm:w-[180px]" />
              <Input type="date" value={startDate} onChange={(e:any) => setStartDate(e.target.value)} icon="event" className="h-12 !py-2 !text-xs w-[140px]" />
              <Input type="date" value={endDate} onChange={(e:any) => setEndDate(e.target.value)} icon="event" className="h-12 !py-2 !text-xs w-[140px]" />
           </div>
           <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="tonal" onClick={() => { resetForm(); setFormData(prev => ({ ...prev, type: 'expense' })); setIsMainModalOpen(true); }} icon="request_quote" className="flex-1 sm:flex-initial">Расход</Button>
              {!isSpecialist && <Button onClick={() => { resetForm(); setFormData(prev => ({ ...prev, type: 'income' })); setIsMainModalOpen(true); }} icon="add_chart" className="flex-1 sm:flex-initial">Приход</Button>}
           </div>
        </div>
      </div>

      {!isSpecialist && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
           <Card label="Касса" val={formatBYN(totals.balance)} icon="account_balance_wallet" color={totals.balance >= 0 ? 'emerald' : 'red'} active={summaryFilter === 'cash'} onClick={() => setSummaryFilter(summaryFilter === 'cash' ? null : 'cash')} />
           <Card label="Дебиторка" val={formatBYN(totals.debt)} icon="pending_actions" color="blue" active={summaryFilter === 'debt'} onClick={() => setSummaryFilter(summaryFilter === 'debt' ? null : 'debt')} />
           <Card label="Всего приходов" val={formatBYN(totals.income)} icon="payments" color="slate" active={summaryFilter === 'total_income'} onClick={() => setSummaryFilter(summaryFilter === 'total_income' ? null : 'total_income')} />
           <Card label="Одобрено расходов" val={formatBYN(totals.expense)} icon="shopping_cart" color="red" active={summaryFilter === 'approved_expenses'} onClick={() => setSummaryFilter(summaryFilter === 'approved_expenses' ? null : 'approved_expenses')} />
        </div>
      )}

      <div className="bg-white rounded-[32px] border border-[#e1e2e1] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-4 w-10"></th>
                <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Тип / Дата</th>
                <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Объект / Описание</th>
                <th className="p-5 text-[10px] font-bold text-slate-400 uppercase w-10 text-center">Файл</th>
                <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Сумма</th>
                <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Факт</th>
                <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Статус</th>
                <th className="p-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map(t => {
                const docStatus = getTransactionDocStatus(t);
                return (
                  <React.Fragment key={t.id}>
                    <tr className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4 text-center">
                        {docStatus === 'missing' && <span className="material-icons-round text-red-500 text-lg animate-pulse" title="Требуется документ">warning</span>}
                        {docStatus === 'complete' && <span className="material-icons-round text-emerald-500 text-lg" title="Документы в порядке">description</span>}
                        {docStatus === 'none' && <span className="material-icons-round text-slate-200 text-lg">description</span>}
                      </td>
                      <td className="p-5">
                        <Badge color={t.type === 'income' ? 'emerald' : 'red'}>{t.type === 'income' ? 'ПРИХОД' : 'РАСХОД'}</Badge>
                        <p className="text-[10px] text-slate-400 font-bold mt-1">{formatDate(t.created_at)}</p>
                      </td>
                      <td className="p-5 cursor-pointer" onClick={() => { setSelectedTrans(t); setIsDetailsModalOpen(true); }}>
                        <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{t.objects?.name || '—'}</p>
                        <p className="text-xs text-slate-500 line-clamp-1">{t.description || t.category}</p>
                      </td>
                      <td className="p-5 text-center">
                        {t.doc_link && <a href={t.doc_link} target="_blank" onClick={(e) => e.stopPropagation()} className="text-blue-500 hover:text-blue-700"><span className="material-icons-round">attach_file</span></a>}
                      </td>
                      <td className="p-5 font-bold">{formatBYN(t.type === 'expense' ? (t.requested_amount || t.amount) : t.amount)}</td>
                      <td className="p-5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{formatBYN(t.type === 'income' ? (t.fact_amount || 0) : (t.status === 'approved' ? t.amount : 0))}</span>
                          {t.type === 'income' && (
                            <button onClick={(e) => { e.stopPropagation(); setExpandedRows(prev => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; }); }} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${expandedRows.has(t.id) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                              <span className="material-icons-round text-sm">{expandedRows.has(t.id) ? 'expand_less' : 'history'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-5">
                        <Badge color={t.status === 'approved' ? 'emerald' : t.status === 'partial' ? 'blue' : t.status === 'rejected' ? 'red' : 'amber'}>
                          {t.status?.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-5 text-right">
                        <div className="flex justify-end gap-1">
                          {t.type === 'income' && t.status !== 'approved' && !isSpecialist && (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); setSelectedTrans(t); setPaymentAmount(''); setPaymentComment(''); setRequiresDoc(false); setDocType('Акт'); setDocNumber(''); setDocDate(''); setIsPaymentModalOpen(true); }} className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-all" title="Внести оплату"><span className="material-icons-round text-sm">add_card</span></button>
                              {t.status === 'partial' && (
                                <button onClick={(e) => { e.stopPropagation(); setSelectedTrans(t); setIsFinalizeConfirmOpen(true); }} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all" title="Завершить (больше не доплатят)"><span className="material-icons-round text-sm">done_all</span></button>
                              )}
                            </>
                          )}
                          {t.type === 'expense' && t.status === 'pending' && canApprove && (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); setSelectedTrans(t); setApprovalAmount((t.requested_amount || t.amount).toString()); setIsApprovalModalOpen(true); }} className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-all" title="Утвердить"><span className="material-icons-round text-sm">check</span></button>
                              <button onClick={(e) => { e.stopPropagation(); setSelectedTrans(t); setIsRejectConfirmOpen(true); }} className="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all" title="Отклонить"><span className="material-icons-round text-sm">close</span></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedRows.has(t.id) && t.payments && t.payments.length > 0 && (
                      <tr className="bg-slate-50/50 animate-in slide-in-from-top-1 duration-200">
                        <td colSpan={8} className="p-0">
                          <div className="px-10 py-4 border-l-4 border-blue-500 ml-5 my-2 bg-white rounded-xl shadow-inner">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest">История частичных платежей</p>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-slate-400 border-b border-slate-100">
                                  <th className="pb-2 text-left font-medium">Дата</th>
                                  <th className="pb-2 text-left font-medium">Сумма</th>
                                  <th className="pb-2 text-left font-medium">Закр. док.</th>
                                  <th className="pb-2 text-left font-medium">Кто внес</th>
                                  <th className="pb-2 text-left font-medium">Комментарий</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {t.payments.map((p: any) => (
                                  <tr key={p.id}>
                                    <td className="py-2">{formatDate(p.payment_date)}</td>
                                    <td className="py-2 font-bold text-emerald-600">{formatBYN(p.amount)}</td>
                                    <td className="py-2">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openPaymentDetails(p, t);
                                        }}
                                        className="flex items-center gap-1 group/doc hover:bg-slate-50 px-2 py-1 rounded-lg transition-all"
                                      >
                                        {p.requires_doc ? (
                                          p.doc_number ? (
                                            <div className="flex items-center gap-1 text-emerald-600 font-bold">
                                              <span className="material-icons-round text-xs">description</span>
                                              <span>{p.doc_type} №{p.doc_number}</span>
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-1 text-red-500 font-bold">
                                              <span className="material-icons-round text-xs">warning</span>
                                              <span>Ожидается</span>
                                            </div>
                                          )
                                        ) : (
                                          <div className="flex items-center gap-1 text-slate-400 font-medium">
                                            <span className="material-icons-round text-xs opacity-50">remove_circle_outline</span>
                                            <span>Не требуется</span>
                                          </div>
                                        )}
                                      </button>
                                    </td>
                                    <td className="py-2 text-slate-500">{p.creator?.full_name}</td>
                                    <td className="py-2 text-slate-400 italic">{p.comment || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isPaymentDetailsModalOpen} onClose={() => setIsPaymentDetailsModalOpen(false)} title={isEditingDoc ? "Редактирование данных" : "Детали платежа"}>
        {selectedPayment && (
          <form onSubmit={handleUpdatePaymentDoc} className="space-y-6">
            {!isEditingDoc ? (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="bg-white p-5 rounded-3xl border border-slate-100 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Сумма платежа</p>
                      <p className="text-2xl font-bold text-emerald-600">{formatBYN(selectedPayment.amount)}</p>
                    </div>
                    <Badge color={selectedTrans?.type === 'income' ? 'emerald' : 'red'}>{selectedTrans?.type?.toUpperCase()}</Badge>
                  </div>
                  <div className="pt-3 border-t border-slate-50 grid grid-cols-2 gap-4">
                     <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Категория</p>
                       <p className="text-sm font-medium text-slate-700">{selectedTrans?.category || '—'}</p>
                     </div>
                     <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Дата платежа</p>
                       <p className="text-sm font-medium text-slate-700">{formatDate(selectedPayment.payment_date)}</p>
                     </div>
                  </div>
                </div>

                <div className="space-y-3">
                   <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="material-icons-round text-slate-400">person</span>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Кто внес</p>
                        <p className="text-sm font-medium">{selectedPayment.creator?.full_name}</p>
                      </div>
                   </div>
                   {selectedPayment.comment && (
                     <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="material-icons-round text-slate-400">comment</span>
                        <div className="flex-grow">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Комментарий к платежу</p>
                          <p className="text-sm text-slate-600 italic leading-relaxed">{selectedPayment.comment}</p>
                        </div>
                     </div>
                   )}
                </div>
              </div>
            ) : (
              <div className="bg-white p-5 rounded-3xl border border-blue-100 space-y-4 animate-in slide-in-from-top-2">
                 <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest ml-1">Редактирование условий документа</p>
                 <label className="flex items-center gap-3 cursor-pointer group p-3 bg-blue-50 rounded-2xl">
                    <input 
                      type="checkbox" 
                      checked={requiresDoc} 
                      onChange={(e) => setRequiresDoc(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-bold text-slate-700 uppercase tracking-tight">Требуется закрывающий документ</span>
                 </label>
              </div>
            )}

            <div className={`p-6 rounded-[28px] border transition-all ${requiresDoc ? 'bg-white border-blue-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-80'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${requiresDoc ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                    <span className="material-icons-round text-xl">{requiresDoc ? 'description' : 'block'}</span>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 leading-tight">Закрывающий документ</h5>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{requiresDoc ? 'Внесен или ожидается' : 'Не требуется'}</p>
                  </div>
                </div>
              </div>

              {requiresDoc ? (
                isEditingDoc ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <Select label="Тип документа" value={docType} onChange={(e:any) => setDocType(e.target.value)} options={DOC_TYPES} icon="description" />
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Номер документа" value={docNumber} onChange={(e:any) => setDocNumber(e.target.value)} icon="tag" />
                      <Input label="Дата документа" type="date" value={docDate} onChange={(e:any) => setDocDate(e.target.value)} icon="event" />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
                      <p className="text-[9px] font-bold text-blue-400 uppercase mb-0.5 tracking-widest">Тип и номер</p>
                      <p className="text-sm font-bold text-blue-900">{docType} №{docNumber || '—'}</p>
                    </div>
                    <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
                      <p className="text-[9px] font-bold text-blue-400 uppercase mb-0.5 tracking-widest">Дата документа</p>
                      <p className="text-sm font-bold text-blue-900">{formatDate(docDate)}</p>
                    </div>
                  </div>
                )
              ) : null}
            </div>

            <div className="flex gap-2 pt-2">
              {isEditingDoc ? (
                <>
                  <Button type="submit" className="flex-grow h-12" loading={loading} icon="save">Сохранить изменения</Button>
                  <Button type="button" variant="ghost" className="h-12" onClick={(e) => { e.preventDefault(); setIsEditingDoc(false); }}>Отмена</Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="tonal" className="flex-grow h-12" icon="edit" onClick={(e) => { e.preventDefault(); setIsEditingDoc(true); }}>Редактировать данные</Button>
                  <Button type="button" variant="ghost" className="h-12" onClick={(e) => { e.preventDefault(); setIsPaymentDetailsModalOpen(false); }}>Закрыть</Button>
                </>
              )}
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title="Детали финансовой записи">
        {selectedTrans && (
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <Badge color={selectedTrans.type === 'income' ? 'emerald' : 'red'}>{selectedTrans.type === 'income' ? 'ПРИХОД' : 'РАСХОД'}</Badge>
                <h3 className="text-2xl font-bold mt-2">{selectedTrans.category}</h3>
              </div>
              <div className="flex flex-col items-end gap-3">
                {canEditDelete && (
                  <div className="flex gap-1">
                    <button 
                      onClick={() => handleEditInit(selectedTrans)}
                      className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all shadow-sm"
                      title="Редактировать"
                    >
                      <span className="material-icons-round text-sm">edit</span>
                    </button>
                    <button 
                      onClick={() => setDeleteConfirm({ open: true, id: selectedTrans.id })}
                      className="w-9 h-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all shadow-sm"
                      title="Удалить"
                    >
                      <span className="material-icons-round text-sm">delete</span>
                    </button>
                  </div>
                )}
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Статус</p>
                  <Badge color={selectedTrans.status === 'approved' ? 'emerald' : selectedTrans.status === 'rejected' ? 'red' : 'amber'}>{selectedTrans.status?.toUpperCase()}</Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-white p-5 rounded-3xl border border-slate-100">
              <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Сумма запроса</p><p className="text-lg font-bold">{formatBYN(selectedTrans.requested_amount || selectedTrans.amount)}</p></div>
              <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Фактически</p><p className="text-lg font-bold text-emerald-600">{formatBYN(selectedTrans.fact_amount || (selectedTrans.status === 'approved' ? selectedTrans.amount : 0))}</p></div>
            </div>

            <div className="space-y-4">
              <DetailItem label="Объект" val={selectedTrans.objects?.name} icon="business" />
              <DetailItem label="Создал" val={selectedTrans.created_by_name} icon="person" />
              {selectedTrans.planned_date && <DetailItem label="Планируемая дата" val={formatDate(selectedTrans.planned_date)} icon="event" />}
              {selectedTrans.description && <DetailItem label="Описание" val={selectedTrans.description} icon="notes" />}
              {selectedTrans.doc_link && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <span className="material-icons-round text-blue-600">attach_file</span>
                  <a href={selectedTrans.doc_link} target="_blank" className="text-sm font-bold text-blue-700 underline truncate">{selectedTrans.doc_name || 'Прикрепленный документ'}</a>
                </div>
              )}
            </div>

            <Button variant="tonal" className="w-full" onClick={() => setIsDetailsModalOpen(false)}>Закрыть</Button>
          </div>
        )}
      </Modal>

      <Modal isOpen={isMainModalOpen} onClose={() => { setIsMainModalOpen(false); resetForm(); }} title={isEditMode ? 'Редактирование записи' : (formData.type === 'income' ? 'План прихода' : 'Заявка на расход')}>
        <form onSubmit={handleCreateTransaction} className="space-y-4">
          <Select label="Объект" required value={formData.object_id} onChange={(e:any) => setFormData({ ...formData, object_id: e.target.value })} options={[{value: '', label: 'Выберите объект'}, ...objects.map(o => ({value: o.id, label: o.name}))]} icon="business" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Сумма" type="number" step="0.01" required value={formData.amount} onChange={(e:any) => setFormData({ ...formData, amount: e.target.value })} icon="payments" />
            {formData.type === 'income' && (
              <Input label="Дата плана" type="date" required value={formData.planned_date} onChange={(e:any) => setFormData({ ...formData, planned_date: e.target.value })} icon="event" />
            )}
          </div>
          <Input label="Категория" required value={formData.category} onChange={(e:any) => setFormData({ ...formData, category: e.target.value })} icon="category" />
          
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Документация (опц.)</p>
             <div className="grid grid-cols-2 gap-4">
               <Input label="Имя документа" value={formData.doc_name} onChange={(e:any) => setFormData({ ...formData, doc_name: e.target.value })} icon="description" />
               <Input label="Ссылка" value={formData.doc_link} onChange={(e:any) => setFormData({ ...formData, doc_link: e.target.value })} icon="link" />
             </div>
          </div>

          <div className="w-full">
            <label className="block text-xs font-medium text-[#444746] mb-1.5 ml-1">Описание</label>
            <textarea className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:border-blue-500" rows={3} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
          </div>
          <Button type="submit" className="w-full h-14" loading={loading} icon="save">{isEditMode ? 'Сохранить изменения' : 'Создать запись'}</Button>
        </form>
      </Modal>

      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Внести оплату">
        {selectedTrans && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            const amt = Number(paymentAmount);
            const { error } = await supabase.from('transaction_payments').insert([{ 
              transaction_id: selectedTrans.id, 
              amount: amt, 
              comment: paymentComment, 
              created_by: profile.id,
              requires_doc: requiresDoc,
              doc_type: requiresDoc ? docType : null,
              doc_number: requiresDoc ? docNumber : null,
              doc_date: (requiresDoc && docDate) ? docDate : null
            }]);
            if (!error) {
              const newFact = (selectedTrans.fact_amount || 0) + amt;
              await supabase.from('transactions').update({ status: newFact >= selectedTrans.amount - 0.01 ? 'approved' : 'partial', fact_amount: newFact }).eq('id', selectedTrans.id);
              setIsPaymentModalOpen(false); 
              setToast({message: 'Платеж внесен', type: 'success'});
              await fetchData(true);
            } else {
              setToast({message: `Ошибка: ${error.message}`, type: 'error'});
            }
            setLoading(false);
          }} className="space-y-4">
            <div className="relative group">
              <Input label="Сумма оплаты" type="number" step="0.01" required value={paymentAmount} onChange={(e:any) => setPaymentAmount(e.target.value)} icon="account_balance_wallet" />
              <button 
                type="button" 
                onClick={() => setPaymentAmount((selectedTrans.amount - (selectedTrans.fact_amount || 0)).toFixed(2))}
                className="absolute right-3 top-[32px] px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg border border-blue-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
              >
                ОСТАТОК
              </button>
            </div>
            <Input label="Комментарий" value={paymentComment} onChange={(e:any) => setPaymentComment(e.target.value)} icon="comment" />
            
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={requiresDoc} 
                  onChange={(e) => setRequiresDoc(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-sm font-bold text-slate-700 uppercase tracking-tight group-hover:text-blue-600 transition-colors">Требуется закрывающий документ</span>
              </label>

              {requiresDoc && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                  <Select 
                    label="Тип документа" 
                    value={docType} 
                    onChange={(e:any) => setDocType(e.target.value)}
                    options={DOC_TYPES}
                    icon="description"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Номер документа" value={docNumber} onChange={(e:any) => setDocNumber(e.target.value)} icon="tag" placeholder="Напр: 123-А" />
                    <Input label="Дата документа" type="date" value={docDate} onChange={(e:any) => setDocDate(e.target.value)} icon="event" />
                  </div>
                </div>
              )}
            </div>

            <Button type="submit" className="w-full h-12" loading={loading} icon="check">Подтвердить платеж</Button>
          </form>
        )}
      </Modal>

      <Modal isOpen={isApprovalModalOpen} onClose={() => setIsApprovalModalOpen(false)} title="Утверждение расхода">
        {selectedTrans && (
          <form onSubmit={handleApproveExpense} className="space-y-4">
            <p className="text-sm text-slate-500">Запрошенная сумма: <b>{formatBYN(selectedTrans.requested_amount || selectedTrans.amount)}</b></p>
            <Input label="Сумма к утверждению" type="number" step="0.01" required value={approvalAmount} onChange={(e:any) => setApprovalAmount(e.target.value)} icon="payments" />
            <Button type="submit" className="w-full h-12" loading={loading} icon="check">Утвердить сумму</Button>
          </form>
        )}
      </Modal>

      <ConfirmModal isOpen={isRejectConfirmOpen} onClose={() => setIsRejectConfirmOpen(false)} onConfirm={handleRejectExpense} title="Отклонить заявку" message="Вы уверены, что хотите отклонить этот расход? Действие нельзя отменить." loading={loading} />
      <ConfirmModal isOpen={isFinalizeConfirmOpen} onClose={() => setIsFinalizeConfirmOpen(false)} onConfirm={handleFinalizeIncome} title="Финализировать приход" message="Клиент больше не будет доплачивать? Статус будет изменен на 'Завершено', а итоговая сумма прихода будет равна фактическим поступлениям." loading={loading} />
      <ConfirmModal 
        isOpen={deleteConfirm.open} 
        onClose={() => setDeleteConfirm({ open: false, id: null })} 
        onConfirm={handleDeleteTransaction} 
        title="Удаление записи" 
        message="Вы уверены, что хотите удалить эту финансовую запись? Она будет перемещена в корзину." 
        confirmVariant="danger" 
        loading={loading} 
      />
    </div>
  );
};

const Card = ({ label, val, icon, color, active, onClick }: any) => (
  <div onClick={onClick} className={`p-6 rounded-[28px] border transition-all cursor-pointer hover:shadow-md ${active ? 'bg-[#d3e4ff] border-[#005ac1]' : 'bg-white border-slate-200'}`}>
    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-widest">{label}</p>
    <p className={`text-xl font-bold ${active ? 'text-[#001d3d]' : color === 'emerald' ? 'text-emerald-600' : color === 'red' ? 'text-red-600' : color === 'blue' ? 'text-blue-600' : 'text-slate-900'}`}>{val}</p>
  </div>
);

const DetailItem = ({ label, val, icon }: any) => (
  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
    <span className="material-icons-round text-slate-400 text-lg">{icon}</span>
    <div className="min-w-0 flex-grow">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{label}</p>
      <p className="text-sm text-slate-700 font-medium truncate">{val || '—'}</p>
    </div>
  </div>
);

export default Finances;