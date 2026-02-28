
import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Modal, Input, Badge, Select, ConfirmModal, useToast, FinanceWidget } from '../../ui';
import { Transaction } from '../../../types';
import { formatDate, getMinskISODate } from '../../../lib/dateUtils';
import { TransactionForm } from '../Finances/modals/TransactionForm';
import { PaymentForm } from '../Finances/modals/PaymentForm';
import { TransactionDetails } from '../Finances/modals/TransactionDetails';
import { TransactionTable } from '../Finances/TransactionTable';
import { calculateGlobalMetrics, calculatePeriodMetrics, filterTransactions, getFactAmount } from '../../../lib/financeUtils';
import { useFinanceMutations } from '../../../hooks/useFinanceMutations';

const formatBYN = (amount: number = 0) => {
  return new Intl.NumberFormat('ru-BY', {
    style: 'currency',
    currency: 'BYN',
    minimumFractionDigits: 2
  }).format(amount);
};

interface FinancesTabProps {
  object: any;
  profile: any;
  transactions: any[];
  isAdmin: boolean;
  refreshData: () => Promise<void>;
}

export const FinancesTab: React.FC<FinancesTabProps> = ({
  object,
  profile,
  transactions,
  isAdmin,
  refreshData
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPaymentDetailsModalOpen, setIsPaymentDetailsModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isFinalizeConfirmOpen, setIsFinalizeConfirmOpen] = useState(false);
  const [isRejectConfirmOpen, setIsRejectConfirmOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null; type: 'transaction' | 'payment' }>({ open: false, id: null, type: 'transaction' });
  const toast = useToast();
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [unclosedDocsOnly, setUnclosedDocsOnly] = useState(false);
  const [activeWidget, setActiveWidget] = useState<string | null>(null); // 'debtors', 'income_fact', 'income_plan', 'expense_fact', 'expense_plan'

  // States for selection
  const [selectedTrans, setSelectedTrans] = useState<any>(null);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [approvalAmount, setApprovalAmount] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const isSpecialist = profile.role === 'specialist';
  const isManager = profile.role === 'manager';
  const isDirector = profile.role === 'director';
  const canApprove = isAdmin || isDirector || (isManager && object.responsible_id === profile.id);
  const canEditDelete = isAdmin || isDirector;

  const { deleteTransaction, approveTransaction, simpleAction } = useFinanceMutations(profile.id);

  // --- Calculations ---

  // 1. GLOBAL METRICS (Lifetime)
  const globalMetrics = useMemo(() => {
      return calculateGlobalMetrics(transactions);
  }, [transactions]);

  // 2. PERIOD FLOW METRICS (Depends on Dates)
  // These are for the Widgets display ONLY. They show stats for the selected period.
  const periodMetrics = useMemo(() => {
      return calculatePeriodMetrics(transactions, startDate, endDate);
  }, [transactions, startDate, endDate]);

  // 3. FINAL LIST FILTERING (For Table)
  const filteredTransactions = useMemo(() => {
      return filterTransactions(transactions, {
          startDate,
          endDate,
          activeWidget,
          unclosedDocsOnly
      });
  }, [transactions, startDate, endDate, unclosedDocsOnly, activeWidget]);


  // Actions
  const handleApproveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrans) return;
    const amount = Number(approvalAmount);
    await approveTransaction.mutateAsync({ id: selectedTrans.id, amount });
    setIsApprovalModalOpen(false); 
    await refreshData();
  };

  const handleDeleteTransaction = async () => {
    if (!deleteConfirm.id) return;
    await deleteTransaction.mutateAsync(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: null, type: 'transaction' });
    setIsDetailsModalOpen(false);
    await refreshData();
  };

  const handleResetDates = () => { setStartDate(''); setEndDate(''); };
  const handleSetMonth = () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(getMinskISODate(start));
      setEndDate(getMinskISODate(end));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
       
       {/* Header & Main Actions */}
       <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
             <h4 className="text-xl font-medium">Финансы объекта</h4>
             <p className="text-sm text-slate-500">Управление бюджетом и платежами</p>
          </div>
          <div className="flex gap-2">
             <Button variant="tonal" icon="request_quote" onClick={() => { setSelectedTrans(null); setIsModalOpen(true); }} className="h-10 text-xs">Внести расход</Button>
             {!isSpecialist && <Button icon="add_chart" onClick={() => { setSelectedTrans({type: 'income'}); setIsModalOpen(true); }} className="h-10 text-xs">План прихода</Button>}
          </div>
       </div>

       {!isSpecialist && (
         <>
            {/* Block 1: Project State (Snapshot) */}
            <div className="bg-slate-50 rounded-[28px] p-5 border border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                    <span className="material-icons-round text-slate-400">analytics</span>
                    <h5 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Текущее состояние (Все время)</h5>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FinanceWidget 
                        label="Баланс (Cash)" 
                        value={formatBYN(globalMetrics.balance)} 
                        color={globalMetrics.balance >= 0 ? 'text-emerald-600' : 'text-red-600'} 
                        icon="account_balance"
                        isActive={activeWidget === null}
                        onClick={() => setActiveWidget(null)}
                    />
                    <FinanceWidget 
                        label="Дебиторка (Просрочено)" 
                        value={formatBYN(globalMetrics.debtorsSum)} 
                        color="text-red-600" 
                        icon="priority_high"
                        count={globalMetrics.debtorsCount}
                        isActive={activeWidget === 'debtors'}
                        onClick={() => setActiveWidget(activeWidget === 'debtors' ? null : 'debtors')}
                    />
                </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-4 py-2">
               <div className="flex items-center gap-2 bg-white rounded-2xl border border-slate-200 px-3 py-1 shadow-sm">
                  <Input type="date" value={startDate} onChange={(e:any) => setStartDate(e.target.value)} className="!border-0 !p-0 !h-auto !text-xs w-24 bg-transparent focus:ring-0" />
                  <span className="text-slate-300 font-bold">-</span>
                  <Input type="date" value={endDate} onChange={(e:any) => setEndDate(e.target.value)} className="!border-0 !p-0 !h-auto !text-xs w-24 bg-transparent focus:ring-0" />
               </div>
               <div className="flex gap-1">
                  <button onClick={handleResetDates} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-bold uppercase hover:bg-slate-200 transition-colors">Все время</button>
                  <button onClick={handleSetMonth} className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-bold uppercase hover:bg-blue-100 transition-colors">Этот месяц</button>
               </div>
               <label className="flex items-center gap-2 cursor-pointer ml-auto">
                   <input type="checkbox" checked={unclosedDocsOnly} onChange={(e) => setUnclosedDocsOnly(e.target.checked)} className="w-4 h-4 rounded text-red-600 focus:ring-blue-500" />
                   <span className={`text-[10px] font-bold uppercase ${unclosedDocsOnly ? 'text-red-600' : 'text-slate-400'}`}>Без документов</span>
               </label>
            </div>

            {/* Block 2: Period Flow */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <FinanceWidget 
                    label="Приход (Факт)" 
                    value={formatBYN(periodMetrics.incomeFactSum)} 
                    count={periodMetrics.incomeFactCount}
                    color="text-emerald-600" 
                    icon="trending_up"
                    isActive={activeWidget === 'income_fact'}
                    onClick={() => setActiveWidget(activeWidget === 'income_fact' ? null : 'income_fact')}
                />
                <FinanceWidget 
                    label="Ожидаемый приход" 
                    value={formatBYN(periodMetrics.incomePlanSum)} 
                    count={periodMetrics.incomePlanCount}
                    color="text-blue-400" 
                    icon="event_note"
                    isActive={activeWidget === 'income_plan'}
                    onClick={() => setActiveWidget(activeWidget === 'income_plan' ? null : 'income_plan')}
                />
                <FinanceWidget 
                    label="Затраты (Факт)" 
                    value={formatBYN(periodMetrics.expenseFactSum)} 
                    count={periodMetrics.expenseFactCount}
                    color="text-red-600" 
                    icon="money_off"
                    isActive={activeWidget === 'expense_fact'}
                    onClick={() => setActiveWidget(activeWidget === 'expense_fact' ? null : 'expense_fact')}
                />
                <FinanceWidget 
                    label="План затрат (Остаток)" 
                    value={formatBYN(periodMetrics.expensePlanSum)} 
                    count={periodMetrics.expensePlanCount}
                    color="text-amber-500" 
                    icon="request_quote"
                    isActive={activeWidget === 'expense_plan'}
                    onClick={() => setActiveWidget(activeWidget === 'expense_plan' ? null : 'expense_plan')}
                />
            </div>
         </>
       )}

       {/* Transactions List */}
       <div className="mt-4">
          <h5 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1 flex items-center gap-2">
             Журнал операций
             {activeWidget && (
                 <span className="text-xs bg-slate-800 text-white px-2 py-0.5 rounded-lg lowercase animate-in fade-in">
                     фильтр: {activeWidget === 'debtors' ? 'дебиторка' : activeWidget.replace('_', ' ')}
                 </span>
             )}
          </h5>
          <TransactionTable 
            transactions={filteredTransactions}
            expandedRows={expandedRows}
            toggleExpand={(id) => setExpandedRows(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })}
            formatCurrency={formatBYN}
            isSpecialist={isSpecialist}
            canApprove={canApprove}
            onRowClick={(t) => { setSelectedTrans(t); setIsDetailsModalOpen(true); }}
            onPaymentClick={(p, t) => { setSelectedPayment(p); setSelectedTrans(t); setIsPaymentDetailsModalOpen(true); }}
            onAddPayment={(t) => { setSelectedTrans(t); setIsPaymentModalOpen(true); }}
            onApprove={(t) => { setSelectedTrans(t); setApprovalAmount((t.requested_amount || t.amount).toString()); setIsApprovalModalOpen(true); }}
            onReject={(t) => { setSelectedTrans(t); setIsRejectConfirmOpen(true); }}
            onFinalize={(t) => { setSelectedTrans(t); setIsFinalizeConfirmOpen(true); }}
          />
       </div>

       {/* MODALS */}
       
       <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditMode ? 'Редактирование' : (selectedTrans?.type === 'income' ? 'План прихода' : 'Планирование расхода')}>
          <TransactionForm 
            mode={isEditMode ? 'edit' : 'create'}
            initialData={selectedTrans}
            objects={[object]} // Pass current object to form
            profile={profile}
            onSuccess={() => { setIsModalOpen(false); refreshData(); toast.success('Успешно сохранено'); }}
          />
       </Modal>

       <Modal isOpen={isPaymentModalOpen || (isPaymentDetailsModalOpen && isEditMode)} onClose={() => { setIsPaymentModalOpen(false); setIsEditMode(false); }} title={isEditMode ? "Редактирование платежа" : "Внесение оплаты"}>
          <PaymentForm 
            transaction={selectedTrans}
            payment={isEditMode ? selectedPayment : null}
            profile={profile}
            onSuccess={() => { setIsPaymentModalOpen(false); setIsPaymentDetailsModalOpen(false); setIsEditMode(false); refreshData(); toast.success('Платеж сохранен'); }}
          />
       </Modal>

       <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title="Детали операции">
          <TransactionDetails 
            transaction={selectedTrans}
            onClose={() => setIsDetailsModalOpen(false)}
            canManage={canEditDelete}
            onEdit={() => { setIsDetailsModalOpen(false); setIsEditMode(true); setIsModalOpen(true); }}
            onDelete={() => setDeleteConfirm({ open: true, id: selectedTrans.id, type: 'transaction' })}
          />
       </Modal>

       {/* Approval Modal */}
       <Modal isOpen={isApprovalModalOpen} onClose={() => setIsApprovalModalOpen(false)} title="Утверждение расхода">
        <form onSubmit={handleApproveExpense} className="space-y-4">
            <p className="text-sm text-slate-500">Запрошено: <b>{formatBYN(selectedTrans?.requested_amount || selectedTrans?.amount)}</b></p>
            <Input label="Сумма к утверждению" type="number" step="0.01" required value={approvalAmount} onChange={(e:any) => setApprovalAmount(e.target.value)} icon="payments" />
            <Button type="submit" className="w-full h-12" icon="check">Утвердить сумму</Button>
        </form>
       </Modal>

       <ConfirmModal 
        isOpen={deleteConfirm.open} 
        onClose={() => setDeleteConfirm({ ...deleteConfirm, open: false })} 
        onConfirm={handleDeleteTransaction} 
        title="Удаление записи" 
        message="Вы уверены? Запись будет удалена безвозвратно."
        confirmVariant="danger"
       />

       <ConfirmModal
        isOpen={isRejectConfirmOpen}
        onClose={() => setIsRejectConfirmOpen(false)}
        onConfirm={async () => {
            if (selectedTrans) {
                await simpleAction.mutateAsync({ action: 'reject', data: selectedTrans });
                setIsRejectConfirmOpen(false);
                await refreshData();
            }
        }}
        title="Отклонить запрос"
        message="Вы уверены, что хотите отклонить этот запрос на расход?"
        confirmVariant="danger"
       />

       <ConfirmModal
        isOpen={isFinalizeConfirmOpen}
        onClose={() => setIsFinalizeConfirmOpen(false)}
        onConfirm={async () => {
            if (selectedTrans) {
                await simpleAction.mutateAsync({ action: 'finalize', data: selectedTrans });
                setIsFinalizeConfirmOpen(false);
                await refreshData();
            }
        }}
        title="Подтвердить приход"
        message="Вы уверены, что хотите подтвердить получение средств?"
        confirmVariant="primary"
       />
    </div>
  );
};
