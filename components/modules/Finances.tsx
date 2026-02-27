
import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Button, Input, Modal, ConfirmModal, Select, useToast } from '../ui';
import { Transaction } from '../../types';
import { getMinskISODate, formatDate } from '../../lib/dateUtils';
import { useObjects } from '../../hooks/useObjects';
import { useTransactions } from '../../hooks/useTransactions';

// Sub-components
import { StatsOverview } from './Finances/StatsOverview';
import { TransactionTable } from './Finances/TransactionTable';
import { TransactionForm } from './Finances/modals/TransactionForm';
import { PaymentForm } from './Finances/modals/PaymentForm';
import { TransactionDetails } from './Finances/modals/TransactionDetails';
import { Analytics } from './Finances/Analytics';

const Finances: React.FC<{ profile: any; initialTransactionId?: string | null }> = ({ profile, initialTransactionId }) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'journal' | 'analytics'>('journal');
  const toast = useToast();
  
  // Date Helpers for Defaults
  const getMonthBounds = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: getMinskISODate(firstDay), end: getMinskISODate(lastDay) };
  };
  const defaults = getMonthBounds();

  // Filters
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [activeWidget, setActiveWidget] = useState<string | null>(null); // 'debtors', 'income_fact', 'income_plan', 'expense_fact', 'expense_plan'
  const [unclosedDocsOnly, setUnclosedDocsOnly] = useState(false);
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [selectedObjectId, setSelectedObjectId] = useState<string>(''); // GLOBAL OBJECT FILTER

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
  const isStorekeeper = profile?.role === 'storekeeper';
  const isSpecialist = profile?.role === 'specialist';
  
  // Storekeeper has financial rights
  const canApprove = isAdmin || isDirector || isManager || isStorekeeper;
  const canEditDelete = isAdmin || isDirector || isStorekeeper;

  // --- QUERIES ---

  // 1. Objects
  const { data: objects = [] } = useObjects();

  // 2. Transactions
  const { data: transactions = [], isLoading } = useTransactions({
    userId: profile?.id,
    isSpecialist
  });

  useEffect(() => {
    if (initialTransactionId && transactions.length > 0) {
      const t = transactions.find((t: any) => t.id === initialTransactionId);
      if (t) {
        setSelectedTransaction(t);
        setModalMode('details');
      }
    }
  }, [initialTransactionId, transactions]);

  // --- REALTIME ---
  useEffect(() => {
    const channel = supabase.channel('finances_rq_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => queryClient.invalidateQueries({ queryKey: ['transactions'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaction_payments' }, () => queryClient.invalidateQueries({ queryKey: ['transactions'] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // --- CALCULATIONS ---

  // Helper to calculate "Real" Fact Amount (handles legacy/simple approved items without explicit payments)
  const getFactAmount = (t: any) => {
      if (t.fact_amount && t.fact_amount > 0) return t.fact_amount;
      if (t.status === 'approved') return t.amount;
      return 0;
  };

  // 1. GLOBAL METRICS (Lifetime, Snapshot)
  const globalMetrics = useMemo(() => {
      const todayStr = getMinskISODate();
      
      // Filter by Object if selected
      let relevantTransactions = transactions;
      if (selectedObjectId) {
          relevantTransactions = transactions.filter(t => t.object_id === selectedObjectId);
      }

      // REAL BALANCE: Fact Income - Fact Expense
      const allIncome = relevantTransactions.filter(t => t.type === 'income').reduce((s, t) => s + getFactAmount(t), 0);
      const allExpense = relevantTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + getFactAmount(t), 0);
      const balance = allIncome - allExpense;

      // Debtors: Planned Income (Pending/Partial) where planned_date < today
      const debtorsList = relevantTransactions.filter(t => 
          t.type === 'income' && 
          (t.amount - getFactAmount(t)) > 0.01 && // Has debt
          t.planned_date && 
          t.planned_date < todayStr
      );
      const debtorsSum = debtorsList.reduce((s, t) => s + (t.amount - getFactAmount(t)), 0);

      return {
          balance,
          debtorsSum,
          debtorsCount: debtorsList.length
      };
  }, [transactions, selectedObjectId]);

  // 2. PERIOD FLOW METRICS (Depends on Dates)
  const periodMetrics = useMemo(() => {
      // 1. Filter by Object first
      let relevantTransactions = transactions;
      if (selectedObjectId) {
          relevantTransactions = transactions.filter(t => t.object_id === selectedObjectId);
      }

      // 2. Plan Metrics: Based on Transaction Date (planned_date)
      const planTransactions = relevantTransactions.filter(t => {
          const targetDate = t.planned_date || getMinskISODate(t.created_at);
          const matchesStart = !startDate || targetDate >= startDate;
          const matchesEnd = !endDate || targetDate <= endDate;
          return matchesStart && matchesEnd;
      });

      // Income Plan: Sum of remaining debt (EXPECTED MONEY IN)
      const incomePlanList = planTransactions.filter(t => 
          t.type === 'income' && 
          (t.amount - getFactAmount(t)) > 0.01
      );
      const incomePlanSum = incomePlanList.reduce((s, t) => s + (t.amount - getFactAmount(t)), 0);

      // Expense Plan: Sum of remaining payable (EXPECTED MONEY OUT)
      const expensePlanList = planTransactions.filter(t => 
          t.type === 'expense' && 
          t.status !== 'rejected'
      );
      const expensePlanSum = expensePlanList.reduce((s, t) => {
          const targetAmount = t.status === 'approved' ? t.amount : (t.requested_amount || t.amount);
          const done = getFactAmount(t);
          return s + Math.max(0, targetAmount - done);
      }, 0);

      // 3. Fact Metrics: Based on Actual Payment Dates
      let incomeFactSum = 0;
      let incomeFactCount = 0;
      let expenseFactSum = 0;
      let expenseFactCount = 0;

      relevantTransactions.forEach(t => {
          // Calculate Fact for this transaction in the given period
          let factInPeriod = 0;
          let hasFact = false;

          if (t.payments && t.payments.length > 0) {
              // If payments exist, sum those in range
              t.payments.forEach((p: any) => {
                  // Ensure we compare YYYY-MM-DD only
                  const pDate = p.payment_date ? p.payment_date.split('T')[0] : '';
                  const matchesStart = !startDate || pDate >= startDate;
                  const matchesEnd = !endDate || pDate <= endDate;
                  if (matchesStart && matchesEnd) {
                      factInPeriod += (p.amount || 0);
                      hasFact = true;
                  }
              });
          } else {
              // Legacy/Simple: Check transaction date
              // t.planned_date is YYYY-MM-DD usually. t.created_at is ISO.
              const rawDate = t.planned_date || t.created_at;
              const tDate = rawDate ? (rawDate.includes('T') ? rawDate.split('T')[0] : rawDate) : '';
              
              const matchesStart = !startDate || tDate >= startDate;
              const matchesEnd = !endDate || tDate <= endDate;
              
              if (matchesStart && matchesEnd) {
                  const amt = getFactAmount(t);
                  if (amt > 0) {
                      factInPeriod += amt;
                      hasFact = true;
                  }
              }
          }

          if (hasFact) {
              if (t.type === 'income') {
                  incomeFactSum += factInPeriod;
                  incomeFactCount++;
              } else {
                  expenseFactSum += factInPeriod;
                  expenseFactCount++;
              }
          }
      });

      return {
          incomeFactSum, incomeFactCount,
          incomePlanSum, incomePlanCount: incomePlanList.length,
          expenseFactSum, expenseFactCount,
          expensePlanSum, expensePlanCount: expensePlanList.length
      };
  }, [transactions, startDate, endDate, selectedObjectId]);

  // 3. FINAL LIST FILTERING
  const filteredTransactions = useMemo(() => {
    const todayStr = getMinskISODate();

    return transactions.filter((t: any) => {
      // 0. Object Filter (Top Priority)
      if (selectedObjectId && t.object_id !== selectedObjectId) return false;

      // 1. Text Search Filter (Documents)
      const searchLower = docSearchQuery.toLowerCase();
      const matchesDocSearch = !docSearchQuery || t.payments?.some((p: any) => 
        (p.doc_number?.toLowerCase().includes(searchLower)) ||
        (p.doc_type?.toLowerCase().includes(searchLower)) ||
        (p.doc_date && formatDate(p.doc_date).includes(docSearchQuery))
      );
      if (!matchesDocSearch) return false;

      // 2. Unclosed Docs Filter
      const hasUnclosedDoc = t.payments?.some((p: any) => p.requires_doc && !p.doc_number);
      if (unclosedDocsOnly && !hasUnclosedDoc) return false;

      // 3. WIDGET & DATE LOGIC
      
      // A. Debtor Widget Logic (Override dates)
      if (activeWidget === 'debtors') {
          return t.type === 'income' && 
                 (t.status === 'pending' || t.status === 'partial') &&
                 t.planned_date && 
                 t.planned_date < todayStr;
      }

      // B. Date Filter (Base) - CHANGED to use planned_date or created_at
      const targetDate = t.planned_date || getMinskISODate(t.created_at);
      const matchesDate = (!startDate || targetDate >= startDate) && (!endDate || targetDate <= endDate);
      if (!matchesDate) return false;

      // C. Specific Widget Filters - CHANGED to exclude fully paid items from PLAN
      if (activeWidget === 'income_fact') return t.type === 'income';
      
      if (activeWidget === 'income_plan') {
          const remaining = t.amount - (t.fact_amount || 0);
          return t.type === 'income' && t.status !== 'approved' && remaining > 0.01;
      }
      
      if (activeWidget === 'expense_fact') return t.type === 'expense' && t.status === 'approved';
      
      if (activeWidget === 'expense_plan') {
           const target = t.requested_amount || t.amount;
           const done = t.fact_amount || 0;
           return t.type === 'expense' && t.status !== 'approved' && (target - done) > 0.01;
      }

      return true;
    });
  }, [transactions, startDate, endDate, activeWidget, unclosedDocsOnly, docSearchQuery, selectedObjectId]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('ru-BY', { style: 'currency', currency: 'BYN', maximumFractionDigits: 2 }).format(val);

  // Actions
  const handleDeleteTransaction = async () => {
    if (!confirmConfig.id) return;
    // setLoading(true); // Handled by mutation or just wait
    const { error } = await supabase.from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', confirmConfig.id);
    if (!error) {
        toast.success('Запись удалена');
        setConfirmConfig({ ...confirmConfig, open: false });
        setModalMode('none');
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
    }
    // setLoading(false);
  };

  const handleDeletePayment = async (id: string) => {
    // setLoading(true);
    const { data: payment } = await supabase.from('transaction_payments').select('amount, transaction_id').eq('id', id).single();
    const { error } = await supabase.from('transaction_payments').delete().eq('id', id);
    if (!error && payment) {
        const trans = transactions.find(t => t.id === payment.transaction_id);
        if (trans) {
            const newFact = Math.max(0, (trans.fact_amount || 0) - payment.amount);
            const newStatus = newFact >= trans.amount - 0.01 ? 'approved' : (newFact > 0 ? 'partial' : 'pending');
            await supabase.from('transactions').update({ fact_amount: newFact, status: newStatus }).eq('id', payment.transaction_id);
        }
        toast.success('Платеж удален');
        setModalMode('none');
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
    }
    // setLoading(false);
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransaction) return;
    const amount = parseFloat(approvalAmount);
    // setLoading(true);
    await supabase.from('transactions').update({ status: 'approved', amount: amount, processed_by: profile.id, processed_at: new Date().toISOString() }).eq('id', selectedTransaction.id);
    setModalMode('none');
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    // setLoading(false);
  };

  const handleSimpleAction = async (action: 'reject' | 'finalize') => {
      if (!confirmConfig.data) return;
      // setLoading(true);
      if (action === 'reject') {
          await supabase.from('transactions').update({ status: 'rejected', processed_by: profile.id, processed_at: new Date().toISOString() }).eq('id', confirmConfig.data.id);
      } else {
          await supabase.from('transactions').update({ status: 'approved', amount: confirmConfig.data.fact_amount || 0 }).eq('id', confirmConfig.data.id);
      }
      setConfirmConfig({ ...confirmConfig, open: false });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      // setLoading(false);
  };

  const handleResetDates = () => { setStartDate(''); setEndDate(''); };
  const handleSetMonth = () => {
      const d = getMonthBounds();
      setStartDate(d.start);
      setEndDate(d.end);
  };

  return (
    <div className="animate-in fade-in duration-500">
      
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f] flex items-center gap-3">Финансы</h2>
          {!isSpecialist && (
            <div className="flex gap-2 mt-4 bg-slate-100 p-1 rounded-2xl w-fit">
              <button 
                onClick={() => setActiveTab('journal')} 
                className={`px-5 py-2 rounded-xl text-xs font-bold uppercase transition-all ${activeTab === 'journal' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Журнал
              </button>
              <button 
                onClick={() => setActiveTab('analytics')} 
                className={`px-5 py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-2 ${activeTab === 'analytics' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Аналитика
                <span className="material-icons-round text-sm">bar_chart</span>
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2 w-full lg:w-auto">
           <Button variant="tonal" onClick={() => setModalMode('create_expense')} icon="request_quote" className="flex-1 lg:flex-initial">Расход</Button>
           {!isSpecialist && <Button onClick={() => setModalMode('create_income')} icon="add_chart" className="flex-1 lg:flex-initial">Приход</Button>}
        </div>
      </div>

      {activeTab === 'analytics' ? (
        <Analytics transactions={transactions} objects={objects} formatCurrency={formatCurrency} />
      ) : (
        <>
          {/* Controls visible only in Journal mode */}
          <div className="flex flex-wrap gap-2 mb-6 items-center">
             
             {/* Object Filter */}
             <div className="w-[240px]">
                <Select 
                    value={selectedObjectId} 
                    onChange={(e:any) => setSelectedObjectId(e.target.value)}
                    options={[
                        {value: '', label: 'Все объекты (Сводка)'},
                        ...objects.map(o => ({value: o.id, label: o.name}))
                    ]}
                    icon="business"
                    className="!h-10 !py-2 !text-xs bg-white border-slate-200"
                />
             </div>

             <div className="h-8 w-[1px] bg-slate-200 mx-2 hidden md:block"></div>

             <div className="flex items-center gap-2">
                <Input placeholder="Акт № / Дата..." value={docSearchQuery} onChange={(e:any) => setDocSearchQuery(e.target.value)} icon="search" className="h-10 !py-2 !text-xs w-[160px]" />
                <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors h-10">
                  <input type="checkbox" checked={unclosedDocsOnly} onChange={(e) => setUnclosedDocsOnly(e.target.checked)} className="w-4 h-4 rounded text-red-600 focus:ring-blue-500" />
                  <span className={`text-[10px] font-bold uppercase ${unclosedDocsOnly ? 'text-red-600' : 'text-slate-400'}`}>Без документов</span>
                </label>
             </div>
             
             <div className="h-8 w-[1px] bg-slate-200 mx-2 hidden md:block"></div>

             <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-1 h-10">
                  <Input type="date" value={startDate} onChange={(e:any) => setStartDate(e.target.value)} className="h-full !py-1 !text-xs w-[110px] !border-0" title="Начало периода" />
                  <span className="text-slate-300 font-bold text-[10px]">-</span>
                  <Input type="date" value={endDate} onChange={(e:any) => setEndDate(e.target.value)} className="h-full !py-1 !text-xs w-[110px] !border-0" title="Конец периода" />
             </div>
             <div className="flex gap-1">
                  <button onClick={handleResetDates} className="px-3 h-10 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-bold uppercase hover:bg-slate-200 transition-colors">Все время</button>
                  <button onClick={handleSetMonth} className="px-3 h-10 rounded-xl bg-blue-50 text-blue-600 text-[10px] font-bold uppercase hover:bg-blue-100 transition-colors">Этот месяц</button>
             </div>
          </div>

          <StatsOverview 
            globalMetrics={globalMetrics}
            periodMetrics={periodMetrics}
            activeWidget={activeWidget}
            setActiveWidget={setActiveWidget}
            isSpecialist={isSpecialist} 
            formatCurrency={formatCurrency} 
          />

          <div className="mt-8">
            <h5 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1 flex items-center gap-2">
                 Журнал операций
                 {activeWidget && (
                     <span className="text-xs bg-slate-800 text-white px-2 py-0.5 rounded-lg lowercase animate-in fade-in">
                         фильтр: {activeWidget === 'debtors' ? 'дебиторка' : activeWidget.replace('_', ' ')}
                     </span>
                 )}
                 {selectedObjectId && (
                     <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-lg lowercase animate-in fade-in">
                         объект: {objects.find(o => o.id === selectedObjectId)?.name}
                     </span>
                 )}
            </h5>
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
        </>
      )}

      {/* --- MODALS --- */}

      <Modal isOpen={modalMode === 'create_income' || modalMode === 'create_expense' || modalMode === 'edit_transaction'} onClose={() => setModalMode('none')} title={modalMode.includes('edit') ? "Редактирование" : (modalMode === 'create_income' ? "Новый приход" : "Новый расход")}>
        <TransactionForm 
            mode={modalMode === 'edit_transaction' ? 'edit' : 'create'}
            initialData={selectedTransaction}
            objects={objects}
            profile={profile}
            onSuccess={() => { setModalMode('none'); toast.success('Успешно сохранено'); queryClient.invalidateQueries({ queryKey: ['transactions'] }); }}
        />
      </Modal>

      <Modal isOpen={modalMode === 'add_payment' || modalMode === 'edit_payment'} onClose={() => setModalMode('none')} title={modalMode === 'edit_payment' ? "Редактирование платежа" : "Внесение оплаты"}>
        <PaymentForm 
            transaction={selectedTransaction}
            payment={modalMode === 'edit_payment' ? selectedPayment : null}
            profile={profile}
            onSuccess={() => { setModalMode('none'); toast.success('Платеж сохранен'); queryClient.invalidateQueries({ queryKey: ['transactions'] }); }}
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
            <Button type="submit" className="w-full h-12" loading={isLoading} icon="check">Утвердить сумму</Button>
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
        loading={isLoading} 
      />
    </div>
  );
};

export default Finances;
