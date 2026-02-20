
import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Modal, Input, Badge, Select, ConfirmModal, useToast } from '../../ui';
import { Transaction } from '../../../types';
import { formatDate, getMinskISODate } from '../../../lib/dateUtils';
import { TransactionForm } from '../Finances/modals/TransactionForm';
import { PaymentForm } from '../Finances/modals/PaymentForm';
import { TransactionDetails } from '../Finances/modals/TransactionDetails';
import { TransactionTable } from '../Finances/TransactionTable';

const formatBYN = (amount: number = 0) => {
  return new Intl.NumberFormat('ru-BY', {
    style: 'currency',
    currency: 'BYN',
    minimumFractionDigits: 2
  }).format(amount);
};

// Local Widget Component
const FinanceWidget = ({ label, value, subValue, color, icon, onClick, isActive, count }: any) => (
  <div 
    onClick={onClick}
    className={`p-4 rounded-2xl border shadow-sm flex flex-col justify-between h-24 relative overflow-hidden group cursor-pointer transition-all ${
        isActive 
        ? 'bg-slate-800 border-slate-900 ring-2 ring-slate-200' 
        : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'
    }`}
  >
    <div className={`absolute top-0 right-0 p-3 transition-opacity ${isActive ? 'opacity-20 text-white' : `opacity-10 group-hover:opacity-20 ${color}`}`}>
        <span className="material-icons-round text-4xl">{icon}</span>
    </div>
    <p className={`text-[10px] font-bold uppercase tracking-widest z-10 ${isActive ? 'text-slate-400' : 'text-slate-400'}`}>{label}</p>
    <div className="z-10">
        <div className="flex items-baseline gap-2">
            <p className={`text-xl font-bold ${isActive ? 'text-white' : color.replace('bg-', 'text-').replace('/20', '')}`}>{value}</p>
            {count !== undefined && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isActive ? 'bg-slate-600 text-slate-200' : 'bg-slate-100 text-slate-500'}`}>
                    {count} шт
                </span>
            )}
        </div>
        {subValue && <p className={`text-[10px] mt-0.5 ${isActive ? 'text-slate-400' : 'text-slate-400'}`}>{subValue}</p>}
    </div>
  </div>
);

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

  // --- Calculations ---

  // 1. GLOBAL METRICS (Lifetime)
  const globalMetrics = useMemo(() => {
      const todayStr = getMinskISODate();
      const allIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + (t.fact_amount || 0), 0);
      const allExpense = transactions.filter(t => t.type === 'expense' && t.status === 'approved').reduce((s, t) => s + t.amount, 0);
      const balance = allIncome - allExpense;

      // Debtors: Planned Income (Pending/Partial) where planned_date < today
      const debtorsList = transactions.filter(t => 
          t.type === 'income' && 
          t.status !== 'approved' && 
          t.planned_date && 
          t.planned_date < todayStr
      );
      const debtorsSum = debtorsList.reduce((s, t) => s + (t.amount - (t.fact_amount || 0)), 0);

      return {
          balance,
          debtorsSum,
          debtorsCount: debtorsList.length
      };
  }, [transactions]);

  // 2. PERIOD FLOW METRICS (Depends on Dates)
  // These are for the Widgets display ONLY. They show stats for the selected period.
  const periodMetrics = useMemo(() => {
      const filteredByDate = transactions.filter(t => {
          const targetDate = t.planned_date || getMinskISODate(t.created_at);
          const matchesStart = !startDate || targetDate >= startDate;
          const matchesEnd = !endDate || targetDate <= endDate;
          return matchesStart && matchesEnd;
      });

      // Income Fact
      const incomeFactList = filteredByDate.filter(t => t.type === 'income');
      const incomeFactSum = incomeFactList.reduce((s, t) => s + (t.fact_amount || 0), 0);

      // Income Plan (Pending/Partial, NOT overdue or just generally pending in this period creation)
      // Usually "Plan" in a period view means "Plans created in this period" OR "Plans due in this period". 
      // Let's use created_at for consistency with list filter.
      const incomePlanList = filteredByDate.filter(t => 
          t.type === 'income' && 
          t.status !== 'approved' &&
          (t.amount - (t.fact_amount || 0)) > 0.01
      );
      const incomePlanSum = incomePlanList.reduce((s, t) => s + (t.amount - (t.fact_amount || 0)), 0);

      // Expense Fact
      const expenseFactList = filteredByDate.filter(t => t.type === 'expense' && t.status === 'approved');
      const expenseFactSum = expenseFactList.reduce((s, t) => s + t.amount, 0);

      // Expense Plan
      const expensePlanList = filteredByDate.filter(t => 
          t.type === 'expense' && 
          t.status !== 'approved'
      );
      const expensePlanSum = expensePlanList.reduce((s, t) => {
          const targetAmount = t.requested_amount || t.amount;
          const done = t.fact_amount || 0;
          return s + Math.max(0, targetAmount - done);
      }, 0);

      return {
          incomeFactSum, incomeFactCount: incomeFactList.length,
          incomePlanSum, incomePlanCount: incomePlanList.length,
          expenseFactSum, expenseFactCount: expenseFactList.length,
          expensePlanSum, expensePlanCount: expensePlanList.length
      };
  }, [transactions, startDate, endDate]);

  // 3. FINAL LIST FILTERING (For Table)
  const filteredTransactions = useMemo(() => {
      const todayStr = getMinskISODate();

      return transactions.filter(t => {
          // A. Debtor Widget Logic (Override everything)
          if (activeWidget === 'debtors') {
              return t.type === 'income' && 
                     (t.status === 'pending' || t.status === 'partial') && 
                     t.planned_date && 
                     t.planned_date < todayStr;
          }

          // B. Date Filter (Base) - Applies to all other widgets and default view
          const targetDate = t.planned_date || getMinskISODate(t.created_at);
          const matchesDate = (!startDate || targetDate >= startDate) && (!endDate || targetDate <= endDate);
          if (!matchesDate) return false;

          // C. Doc Filter
          if (unclosedDocsOnly) {
              const hasUnclosedDoc = t.payments?.some((p: any) => p.requires_doc && !p.doc_number);
              if (!hasUnclosedDoc) return false;
          }

          // D. Widget Specific Filters
          if (activeWidget === 'income_fact') return t.type === 'income'; // We show all income rows, fact amount is highlighted in table
          
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

          // Default (Balance/All)
          return true;
      });
  }, [transactions, startDate, endDate, unclosedDocsOnly, activeWidget]);


  // Actions
  const handleApproveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrans) return;
    const amount = Number(approvalAmount);
    await supabase.from('transactions').update({
      status: 'approved',
      amount,
      processed_by: profile.id,
      processed_at: new Date().toISOString()
    }).eq('id', selectedTrans.id);
    setIsApprovalModalOpen(false); await refreshData();
  };

  const handleDeleteTransaction = async () => {
    if (!deleteConfirm.id) return;
    await supabase.from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', deleteConfirm.id);
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
    </div>
  );
};
