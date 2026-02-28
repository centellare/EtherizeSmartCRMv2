
import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Button, Input, Modal, ConfirmModal, Select, useToast } from '../ui';
import { Transaction } from '../../types';
import { getMinskISODate, formatDate } from '../../lib/dateUtils';
import { useObjects } from '../../hooks/useObjects';
import { useTransactions } from '../../hooks/useTransactions';
import { useFinanceMutations } from '../../hooks/useFinanceMutations';
import { calculateGlobalMetrics, calculatePeriodMetrics, filterTransactions, getFactAmount } from '../../lib/financeUtils';

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
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
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

  const { deleteTransaction, deletePayment, approveTransaction, simpleAction } = useFinanceMutations(profile?.id);

  useEffect(() => {
    if (initialTransactionId && transactions.length > 0) {
      const t = transactions.find((t: Transaction) => t.id === initialTransactionId);
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

  // 1. GLOBAL METRICS (Lifetime, Snapshot)
  const globalMetrics = useMemo(() => {
      return calculateGlobalMetrics(transactions, selectedObjectId);
  }, [transactions, selectedObjectId]);

  // 2. PERIOD FLOW METRICS (Depends on Dates)
  const periodMetrics = useMemo(() => {
      return calculatePeriodMetrics(transactions, startDate, endDate, selectedObjectId);
  }, [transactions, startDate, endDate, selectedObjectId]);

  // 3. FINAL LIST FILTERING
  const filteredTransactions = useMemo(() => {
    return filterTransactions(transactions, {
        startDate,
        endDate,
        activeWidget,
        unclosedDocsOnly,
        docSearchQuery,
        selectedObjectId
    });
  }, [transactions, startDate, endDate, activeWidget, unclosedDocsOnly, docSearchQuery, selectedObjectId]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('ru-BY', { style: 'currency', currency: 'BYN', maximumFractionDigits: 2 }).format(val);

  // Actions
  const handleDeleteTransaction = async () => {
    if (!confirmConfig.id) return;
    await deleteTransaction.mutateAsync(confirmConfig.id);
    setConfirmConfig({ ...confirmConfig, open: false });
    setModalMode('none');
  };

  const handleDeletePayment = async (id: string) => {
    await deletePayment.mutateAsync({ id, transactions });
    setModalMode('none');
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransaction) return;
    const amount = parseFloat(approvalAmount);
    await approveTransaction.mutateAsync({ id: selectedTransaction.id, amount });
    setModalMode('none');
  };

  const handleSimpleAction = async (action: 'reject' | 'finalize') => {
      if (!confirmConfig.data) return;
      await simpleAction.mutateAsync({ action, data: confirmConfig.data });
      setConfirmConfig({ ...confirmConfig, open: false });
  };

  const handleResetDates = () => { setStartDate(''); setEndDate(''); };
  const handleSetMonth = () => {
      const d = getMonthBounds();
      setStartDate(d.start);
      setEndDate(d.end);
  };

  const handleExportExcel = () => {
    // Define headers
    const headers = [
      'Дата',
      'Тип',
      'Объект',
      'Категория',
      'Раздел',
      'Сумма (План)',
      'Сумма (Факт)',
      'Статус',
      'Комментарий',
      'Документ'
    ];

    // Map data
    const rows = filteredTransactions.map((t: any) => {
      const objectName = objects.find(o => o.id === t.object_id)?.name || 'Неизвестно';
      const type = t.type === 'income' ? 'Приход' : 'Расход';
      const status = t.status === 'approved' ? 'Утвержден' : 
                     t.status === 'rejected' ? 'Отклонен' : 
                     t.status === 'pending' ? 'Ожидание' : 
                     t.status === 'partial' ? 'Частично' : t.status;
      
      const docInfo = t.payments?.map((p: any) => p.doc_number ? `№${p.doc_number} от ${formatDate(p.doc_date)}` : '').filter(Boolean).join('; ') || '';

      return [
        formatDate(t.created_at),
        type,
        objectName,
        t.category || '',
        t.section || '',
        t.amount || 0,
        t.fact_amount || 0,
        status,
        t.description || '', // Comment field
        docInfo
      ];
    });

    // Create CSV content
    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    // Create blob and download
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `finances_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
                  <button onClick={handleExportExcel} className="px-3 h-10 rounded-xl bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase hover:bg-emerald-100 transition-colors flex items-center gap-1">
                      <span className="material-icons-round text-sm">download</span>
                      XLS
                  </button>
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
            onDelete={() => {
                if (selectedTransaction) {
                    setConfirmConfig({ open: true, type: 'delete_transaction', id: selectedTransaction.id })
                }
            }}
        />
      </Modal>

      <Modal isOpen={modalMode === 'approve'} onClose={() => setModalMode('none')} title="Утверждение расхода">
        <form onSubmit={handleApprove} className="space-y-4">
            <p className="text-sm text-slate-500">Запрошено: <b>{formatCurrency(selectedTransaction?.requested_amount || selectedTransaction?.amount || 0)}</b></p>
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
