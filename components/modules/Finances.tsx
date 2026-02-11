
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, measureQuery } from '../../lib/supabase';
import { Button, Input, Modal, ConfirmModal, Toast } from '../ui';
import { Transaction } from '../../types';
import { getMinskISODate, formatDate } from '../../lib/dateUtils';

// Sub-components
import { StatsOverview } from './Finances/StatsOverview';
import { TransactionTable } from './Finances/TransactionTable';
import { TransactionForm } from './Finances/modals/TransactionForm';
import { PaymentForm } from './Finances/modals/PaymentForm';
import { TransactionDetails } from './Finances/modals/TransactionDetails';

const Finances: React.FC<{ profile: any }> = ({ profile }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [objects, setObjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [summaryFilter, setSummaryFilter] = useState<string | null>(null);
  const [unclosedDocsOnly, setUnclosedDocsOnly] = useState(false);
  const [docSearchQuery, setDocSearchQuery] = useState('');

  // UI States
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [modalMode, setModalMode] = useState<'create_income' | 'create_expense' | 'edit_transaction' | 'add_payment' | 'edit_payment' | 'details' | 'approve' | 'none'>('none');
  
  // Selected Data
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  
  // Confirmations
  const [confirmConfig, setConfirmConfig] = useState<{ open: boolean; type: 'reject_expense' | 'finalize_income' | 'delete_transaction' | 'delete_payment'; id?: string; data?: any }>({ open: false, type: 'reject_expense' });
  const [approvalAmount, setApprovalAmount] = useState('');

  const isAdmin = profile?.role === 'admin';
  const isDirector = profile?.role === 'director';
  const isManager = profile?.role === 'manager';
  const isSpecialist = profile?.role === 'specialist';
  const canApprove = isAdmin || isDirector || isManager;
  const canEditDelete = isAdmin || isDirector;

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

      const result = await measureQuery(query.order('created_at', { ascending: false }));
      
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
  }, [profile?.id, isSpecialist]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime Logic
  useEffect(() => {
    const channel = supabase.channel('finances_main_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaction_payments' }, () => fetchData(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const filteredTransactions = useMemo(() => {
    const todayStr = getMinskISODate();

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

      if (summaryFilter === 'income') return t.type === 'income';
      if (summaryFilter === 'planned') return t.type === 'income' && t.status !== 'approved';
      // UPDATED: Debtors now strictly means OVERDUE planned income
      if (summaryFilter === 'debtors') {
          return t.type === 'income' && 
                 (t.status === 'pending' || t.status === 'partial') &&
                 t.planned_date && 
                 t.planned_date < todayStr;
      }
      if (summaryFilter === 'expenses') return t.type === 'expense';
      
      return typeFilter === 'all' || t.type === typeFilter;
    });
  }, [transactions, typeFilter, startDate, endDate, summaryFilter, unclosedDocsOnly, docSearchQuery]);

  const summary = useMemo(() => {
    const todayStr = getMinskISODate();
    const data = transactions.filter(t => {
      const tDateStr = getMinskISODate(t.created_at);
      return (!startDate || tDateStr >= startDate) && (!endDate || tDateStr <= endDate);
    });
    
    const incomeFact = data.filter(t => t.type === 'income').reduce((s, t) => s + (t.fact_amount || 0), 0);
    const expApprov = data.filter(t => t.type === 'expense' && t.status === 'approved').reduce((s, t) => s + t.amount, 0);
    const expPending = data.filter(t => t.type === 'expense' && t.status === 'pending');
    
    // Total Planned (Pending + Partial)
    const plannedRemain = data.filter(t => t.type === 'income' && t.status !== 'approved').reduce((s, t) => s + (t.amount - (t.fact_amount || 0)), 0);
    
    // Total Debtors (Overdue Pending + Partial)
    const debtorsTotal = data.filter(t => 
        t.type === 'income' && 
        t.status !== 'approved' &&
        t.planned_date && 
        t.planned_date < todayStr
    ).reduce((s, t) => s + (t.amount - (t.fact_amount || 0)), 0);

    return {
      balance: incomeFact - expApprov,
      incomeTotal: incomeFact,
      planned: plannedRemain,
      debtors: debtorsTotal,
      expensesApproved: expApprov,
      expensesPendingSum: expPending.reduce((s, t) => s + t.amount, 0),
      expensesPendingCount: expPending.length
    };
  }, [transactions, startDate, endDate]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('ru-BY', { style: 'currency', currency: 'BYN', maximumFractionDigits: 2 }).format(val);

  // Actions
  const handleDeleteTransaction = async () => {
    if (!confirmConfig.id) return;
    setLoading(true);
    const { error } = await supabase.from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', confirmConfig.id);
    if (!error) {
        setToast({ message: 'Запись удалена', type: 'success' });
        setConfirmConfig({ ...confirmConfig, open: false });
        setModalMode('none');
        fetchData(true);
    }
    setLoading(false);
  };

  const handleDeletePayment = async (id: string) => {
    setLoading(true);
    const { data: payment } = await supabase.from('transaction_payments').select('amount, transaction_id').eq('id', id).single();
    const { error } = await supabase.from('transaction_payments').delete().eq('id', id);
    if (!error && payment) {
        const trans = transactions.find(t => t.id === payment.transaction_id);
        if (trans) {
            const newFact = Math.max(0, (trans.fact_amount || 0) - payment.amount);
            const newStatus = newFact >= trans.amount - 0.01 ? 'approved' : (newFact > 0 ? 'partial' : 'pending');
            await supabase.from('transactions').update({ fact_amount: newFact, status: newStatus }).eq('id', payment.transaction_id);
        }
        setToast({ message: 'Платеж удален', type: 'success' });
        setModalMode('none'); // Close payment modal
        fetchData(true);
    }
    setLoading(false);
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransaction) return;
    const amount = parseFloat(approvalAmount);
    setLoading(true);
    await supabase.from('transactions').update({ status: 'approved', amount: amount, processed_by: profile.id, processed_at: new Date().toISOString() }).eq('id', selectedTransaction.id);
    setModalMode('none');
    fetchData(true);
    setLoading(false);
  };

  const handleSimpleAction = async (action: 'reject' | 'finalize') => {
      if (!confirmConfig.data) return;
      setLoading(true);
      if (action === 'reject') {
          await supabase.from('transactions').update({ status: 'rejected', processed_by: profile.id, processed_at: new Date().toISOString() }).eq('id', confirmConfig.data.id);
      } else {
          await supabase.from('transactions').update({ status: 'approved', amount: confirmConfig.data.fact_amount || 0 }).eq('id', confirmConfig.data.id);
      }
      setConfirmConfig({ ...confirmConfig, open: false });
      fetchData(true);
      setLoading(false);
  };

  return (
    <div className="animate-in fade-in duration-500">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f] flex items-center gap-3">Финансы</h2>
          <div className="flex flex-wrap gap-2 mt-3">
             <button onClick={() => { setTypeFilter('all'); setSummaryFilter(null); }} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase border ${typeFilter === 'all' && !summaryFilter ? 'bg-[#005ac1] text-white' : 'bg-white text-slate-500'}`}>Все</button>
             <button onClick={() => { setTypeFilter('income'); setSummaryFilter(null); }} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase border ${typeFilter === 'income' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500'}`}>Приходы</button>
             <button onClick={() => { setTypeFilter('expense'); setSummaryFilter(null); }} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase border ${typeFilter === 'expense' ? 'bg-red-600 text-white' : 'bg-white text-slate-500'}`}>Расходы</button>
             <div className="h-8 w-[1px] bg-slate-200 mx-2 hidden md:block"></div>
             <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors">
               <input type="checkbox" checked={unclosedDocsOnly} onChange={(e) => setUnclosedDocsOnly(e.target.checked)} className="w-4 h-4 rounded text-red-600 focus:ring-blue-500" />
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
              <Button variant="tonal" onClick={() => setModalMode('create_expense')} icon="request_quote" className="flex-1 sm:flex-initial">Расход</Button>
              {!isSpecialist && <Button onClick={() => setModalMode('create_income')} icon="add_chart" className="flex-1 sm:flex-initial">Приход</Button>}
           </div>
        </div>
      </div>

      <StatsOverview 
        summary={summary} 
        activeFilter={summaryFilter} 
        onFilterChange={setSummaryFilter} 
        isSpecialist={isSpecialist} 
        formatCurrency={formatCurrency} 
      />

      <div className="mt-8">
        <TransactionTable 
            transactions={filteredTransactions}
            expandedRows={expandedRows}
            toggleExpand={(id) => setExpandedRows(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })}
            formatCurrency={formatCurrency}
            isSpecialist={isSpecialist}
            canApprove={canApprove}
            onRowClick={(t) => { setSelectedTransaction(t); setModalMode('details'); }}
            onPaymentClick={(p, t) => { setSelectedPayment(p); setSelectedTransaction(t); setModalMode('edit_payment'); }}
            onAddPayment={(t) => { setSelectedTransaction(t); setModalMode('add_payment'); }}
            onApprove={(t) => { setSelectedTransaction(t); setApprovalAmount((t.requested_amount || t.amount).toString()); setModalMode('approve'); }}
            onReject={(t) => setConfirmConfig({ open: true, type: 'reject_expense', data: t })}
            onFinalize={(t) => setConfirmConfig({ open: true, type: 'finalize_income', data: t })}
        />
      </div>

      {/* --- MODALS --- */}

      <Modal isOpen={modalMode === 'create_income' || modalMode === 'create_expense' || modalMode === 'edit_transaction'} onClose={() => setModalMode('none')} title={modalMode.includes('edit') ? "Редактирование" : (modalMode === 'create_income' ? "Новый приход" : "Новый расход")}>
        <TransactionForm 
            mode={modalMode === 'edit_transaction' ? 'edit' : 'create'}
            initialData={selectedTransaction}
            objects={objects}
            profile={profile}
            onSuccess={() => { setModalMode('none'); setToast({message: 'Успешно сохранено', type: 'success'}); fetchData(true); }}
        />
      </Modal>

      <Modal isOpen={modalMode === 'add_payment' || modalMode === 'edit_payment'} onClose={() => setModalMode('none')} title={modalMode === 'edit_payment' ? "Редактирование платежа" : "Внесение оплаты"}>
        <PaymentForm 
            transaction={selectedTransaction}
            payment={modalMode === 'edit_payment' ? selectedPayment : null}
            profile={profile}
            onSuccess={() => { setModalMode('none'); setToast({message: 'Платеж сохранен', type: 'success'}); fetchData(true); }}
            onDelete={canEditDelete ? handleDeletePayment : undefined}
        />
      </Modal>

      <Modal isOpen={modalMode === 'details'} onClose={() => setModalMode('none')} title="Детали операции">
        <TransactionDetails 
            transaction={selectedTransaction}
            onClose={() => setModalMode('none')}
            canManage={canEditDelete}
            onEdit={() => setModalMode('edit_transaction')}
            onDelete={() => setConfirmConfig({ open: true, type: 'delete_transaction', id: selectedTransaction.id })}
        />
      </Modal>

      <Modal isOpen={modalMode === 'approve'} onClose={() => setModalMode('none')} title="Утверждение расхода">
        <form onSubmit={handleApprove} className="space-y-4">
            <p className="text-sm text-slate-500">Запрошено: <b>{formatCurrency(selectedTransaction?.requested_amount || selectedTransaction?.amount)}</b></p>
            <Input label="Сумма к утверждению" type="number" step="0.01" required value={approvalAmount} onChange={(e:any) => setApprovalAmount(e.target.value)} icon="payments" />
            <Button type="submit" className="w-full h-12" loading={loading} icon="check">Утвердить сумму</Button>
        </form>
      </Modal>

      {/* Confirmation Modals */}
      <ConfirmModal 
        isOpen={confirmConfig.open} 
        onClose={() => setConfirmConfig({ ...confirmConfig, open: false })} 
        onConfirm={() => confirmConfig.type === 'delete_transaction' ? handleDeleteTransaction() : handleSimpleAction(confirmConfig.type === 'reject_expense' ? 'reject' : 'finalize')} 
        title={confirmConfig.type === 'delete_transaction' ? "Удаление записи" : confirmConfig.type === 'reject_expense' ? "Отклонить заявку" : "Финализировать"} 
        message="Вы уверены? Это действие нельзя отменить."
        confirmVariant={confirmConfig.type === 'finalize_income' ? 'primary' : 'danger'} 
        loading={loading} 
      />
    </div>
  );
};

export default Finances;
