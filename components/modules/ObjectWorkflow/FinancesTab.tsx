
import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Modal, Input, Badge, Select, ConfirmModal, Toast } from '../../ui';
import { Transaction } from '../../../types';

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
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPaymentDetailsModalOpen, setIsPaymentDetailsModalOpen] = useState(false);
  const [isEditingDoc, setIsEditingDoc] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isFinalizeConfirmOpen, setIsFinalizeConfirmOpen] = useState(false);
  const [isRejectConfirmOpen, setIsRejectConfirmOpen] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  const [activeAnalysisFilter, setActiveAnalysisFilter] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [unclosedDocsOnly, setUnclosedDocsOnly] = useState(false);
  const [docSearchQuery, setDocSearchQuery] = useState('');

  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedTrans, setSelectedTrans] = useState<any>(null);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentComment, setPaymentComment] = useState('');
  const [requiresDoc, setRequiresDoc] = useState(false);
  const [docType, setDocType] = useState('Акт');
  const [docNumber, setDocNumber] = useState('');
  const [docDate, setDocDate] = useState('');
  const [approvalAmount, setApprovalAmount] = useState('');
  
  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({ 
    type: 'expense' as 'income' | 'expense',
    amount: '', 
    planned_date: today,
    category: '', 
    description: '',
    doc_link: '',
    doc_name: ''
  });

  const resetForm = () => {
    setFormData({
      type: 'expense',
      amount: '',
      planned_date: today,
      category: '',
      description: '',
      doc_link: '',
      doc_name: ''
    });
  };

  const isSpecialist = profile.role === 'specialist';
  const isManager = profile.role === 'manager';
  const isDirector = profile.role === 'director';
  const canApprove = isAdmin || isDirector || (isManager && object.responsible_id === profile.id);

  const summary = useMemo(() => {
    const data = transactions.filter(t => {
      const d = new Date(t.created_at);
      return (!startDate || d >= new Date(startDate)) && (!endDate || d <= new Date(endDate + 'T23:59:59'));
    });

    const incomeFact = data.filter(t => t.type === 'income').reduce((s, t) => s + (t.fact_amount || 0), 0);
    const expApprov = data.filter(t => t.type === 'expense' && t.status === 'approved').reduce((s, t) => s + t.amount, 0);
    const expPending = data.filter(t => t.type === 'expense' && t.status === 'pending');
    
    const plannedRemain = data.filter(t => t.type === 'income' && t.status !== 'approved')
      .reduce((s, t) => s + (t.amount - (t.fact_amount || 0)), 0);
    
    const debtorsTotal = data.filter(t => t.type === 'income' && (t.status === 'pending' || t.status === 'partial') && t.planned_date && t.planned_date < today)
      .reduce((s, t) => s + (t.amount - (t.fact_amount || 0)), 0);

    return {
      balance: incomeFact - expApprov,
      incomeTotal: incomeFact,
      planned: plannedRemain,
      debtors: debtorsTotal,
      expensesApproved: expApprov,
      expensesPendingSum: expPending.reduce((s, t) => s + t.amount, 0),
      expensesPendingCount: expPending.length
    };
  }, [transactions, startDate, endDate, today]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t: any) => {
      const d = new Date(t.created_at);
      if (startDate && d < new Date(startDate)) return false;
      if (endDate && d > new Date(endDate + 'T23:59:59')) return false;

      const searchLower = docSearchQuery.toLowerCase();
      const matchesDocSearch = !docSearchQuery || t.payments?.some((p: any) => 
        (p.doc_number?.toLowerCase().includes(searchLower)) ||
        (p.doc_type?.toLowerCase().includes(searchLower)) ||
        (p.doc_date?.includes(docSearchQuery))
      );
      if (!matchesDocSearch) return false;

      const hasUnclosedDoc = t.payments?.some((p: any) => p.requires_doc && !p.doc_number);
      if (unclosedDocsOnly && !hasUnclosedDoc) return false;

      if (activeAnalysisFilter === 'income') return t.type === 'income';
      if (activeAnalysisFilter === 'planned') return t.type === 'income' && t.status !== 'approved';
      if (activeAnalysisFilter === 'debtors') return t.type === 'income' && (t.status === 'pending' || t.status === 'partial') && t.planned_date && t.planned_date < today;
      if (activeAnalysisFilter === 'expenses') return t.type === 'expense';
      
      return true;
    });
  }, [transactions, activeAnalysisFilter, startDate, endDate, today, unclosedDocsOnly, docSearchQuery]);

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const amount = Number(formData.amount);
    const type = isSpecialist ? 'expense' : formData.type;
    const { error } = await supabase.from('transactions').insert([{
      object_id: object.id, type, amount, planned_amount: amount, requested_amount: amount,
      planned_date: type === 'income' ? formData.planned_date : null,
      category: formData.category, description: formData.description,
      doc_link: formData.doc_link || null, doc_name: formData.doc_name || null,
      status: 'pending', created_by: profile.id
    }]);
    if (!error) {
      setIsModalOpen(false);
      resetForm();
      await refreshData();
      setToast({message: 'Запись создана', type: 'success'});
    } else {
      setToast({message: `Ошибка: ${error.message}`, type: 'error'});
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
      await refreshData();
    } else {
      console.error('Update Payment Error:', error);
      setToast({message: `Ошибка БД: ${error.message}. Убедитесь, что политики RLS позволяют UPDATE.`, type: 'error'});
    }
    setLoading(false);
  };

  const handleApproveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrans) return;
    const amount = Number(approvalAmount);
    if (amount > (selectedTrans.requested_amount || selectedTrans.amount)) {
      alert('Сумма не может быть больше запрошенной');
      return;
    }
    setLoading(true);
    await supabase.from('transactions').update({
      status: 'approved',
      amount,
      processed_by: profile.id,
      processed_at: new Date().toISOString()
    }).eq('id', selectedTrans.id);
    setIsApprovalModalOpen(false); await refreshData(); setLoading(false);
  };

  const handleRejectExpense = async () => {
    if (!selectedTrans) return;
    setLoading(true);
    await supabase.from('transactions').update({ status: 'rejected', processed_by: profile.id, processed_at: new Date().toISOString() }).eq('id', selectedTrans.id);
    setIsRejectConfirmOpen(false); await refreshData(); setLoading(false);
  };

  const handleFinalizeIncome = async () => {
    if (!selectedTrans) return;
    setLoading(true);
    await supabase.from('transactions').update({ status: 'approved', amount: selectedTrans.fact_amount || 0 }).eq('id', selectedTrans.id);
    setIsFinalizeConfirmOpen(false); await refreshData(); setLoading(false);
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
    <div className="space-y-6 animate-in fade-in duration-500">
       {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
       <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <h4 className="text-xl font-medium">Финансы объекта</h4>
          <div className="flex flex-wrap gap-2 items-center">
             <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-slate-200">
                <Input placeholder="Документ №..." value={docSearchQuery} onChange={(e:any) => setDocSearchQuery(e.target.value)} className="!border-0 !p-0 h-6 text-[10px] w-24" />
                <Input type="date" value={startDate} onChange={(e:any) => setStartDate(e.target.value)} className="!border-0 !p-0 h-6 text-[10px] w-24" />
                <span className="text-[10px] text-slate-300 font-bold">ПО</span>
                <Input type="date" value={endDate} onChange={(e:any) => setEndDate(e.target.value)} className="!border-0 !p-0 h-6 text-[10px] w-24" />
             </div>
             <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-full border border-slate-200">
               <input type="checkbox" checked={unclosedDocsOnly} onChange={(e) => setUnclosedDocsOnly(e.target.checked)} className="w-3 h-3 rounded" />
               <span className="text-[9px] font-bold text-red-600 uppercase">Нет док-ов</span>
             </label>
             <Button variant="tonal" icon="request_quote" onClick={() => { resetForm(); setFormData(prev => ({ ...prev, type: 'expense' })); setIsModalOpen(true); }} className="h-10 text-xs">Расход</Button>
             {!isSpecialist && <Button icon="add_chart" onClick={() => { resetForm(); setFormData(prev => ({ ...prev, type: 'income' })); setIsModalOpen(true); }} className="h-10 text-xs">План прихода</Button>}
          </div>
       </div>

       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Баланс" val={formatBYN(summary.balance)} color={summary.balance >= 0 ? 'emerald' : 'red'} active={!activeAnalysisFilter} onClick={() => setActiveAnalysisFilter(null)} />
          {!isSpecialist && (
            <>
              <StatCard label="Приходы" val={formatBYN(summary.incomeTotal)} color="slate" active={activeAnalysisFilter === 'income'} onClick={() => setActiveAnalysisFilter('income')} />
              <StatCard label="Планируемые" val={formatBYN(summary.planned)} color="blue" active={activeAnalysisFilter === 'planned'} onClick={() => setActiveAnalysisFilter('planned')} />
              <StatCard label="Дебиторка" val={formatBYN(summary.debtors)} color="red" active={activeAnalysisFilter === 'debtors'} onClick={() => setActiveAnalysisFilter('debtors')} />
            </>
          )}
          <StatCard 
            label="Расходы" 
            val={formatBYN(summary.expensesApproved)} 
            subVal={`${formatBYN(summary.expensesPendingSum)} (${summary.expensesPendingCount})`}
            color="red" 
            active={activeAnalysisFilter === 'expenses'} 
            onClick={() => setActiveAnalysisFilter('expenses')} 
          />
       </div>
       
       <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-4 w-10"></th>
                <th className="p-5 text-[10px] uppercase font-bold text-slate-400">Тип / Дата</th>
                <th className="p-5 text-[10px] uppercase font-bold text-slate-400">Описание</th>
                <th className="p-5 text-[10px] uppercase font-bold text-slate-400">Сумма</th>
                <th className="p-5 text-[10px] uppercase font-bold text-slate-400">Факт</th>
                <th className="p-5 text-[10px] uppercase font-bold text-slate-400">Статус</th>
                <th className="p-5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map(t => {
                const docStatus = getTransactionDocStatus(t);
                return (
                  <React.Fragment key={t.id}>
                    <tr className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4 text-center">
                        {docStatus === 'missing' && <span className="material-icons-round text-red-500 text-lg animate-pulse">warning</span>}
                        {docStatus === 'complete' && <span className="material-icons-round text-emerald-500 text-lg">description</span>}
                        {docStatus === 'none' && <span className="material-icons-round text-slate-200 text-lg">description</span>}
                      </td>
                      <td className="p-5">
                        <Badge color={t.type === 'income' ? 'emerald' : 'red'}>{t.type === 'income' ? 'ПРИХОД' : 'РАСХОД'}</Badge>
                        <p className="text-[10px] text-slate-400 font-bold mt-1">{new Date(t.created_at).toLocaleDateString()}</p>
                      </td>
                      <td className="p-5 cursor-pointer" onClick={() => { setSelectedTrans(t); setIsDetailsModalOpen(true); }}>
                        <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{t.category}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[10px] text-slate-400 italic line-clamp-1">{t.description}</p>
                          {t.doc_link && <span className="material-icons-round text-sm text-blue-500">attach_file</span>}
                        </div>
                      </td>
                      <td className="p-5 font-bold">{formatBYN(t.type === 'expense' ? (t.requested_amount || t.amount) : t.amount)}</td>
                      <td className="p-5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{formatBYN(t.type === 'income' ? (t.fact_amount || 0) : (t.status === 'approved' ? t.amount : 0))}</span>
                          {t.type === 'income' && (
                            <button onClick={(e) => { e.stopPropagation(); setExpandedRows(prev => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; }); }} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${expandedRows.has(t.id) ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
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
                                <button onClick={(e) => { e.stopPropagation(); setSelectedTrans(t); setIsFinalizeConfirmOpen(true); }} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all" title="Финализировать"><span className="material-icons-round text-sm">done_all</span></button>
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
                      <tr className="bg-slate-50/50">
                        <td colSpan={7} className="p-0">
                          <div className="px-10 py-4 ml-5 my-2 bg-white rounded-xl border-l-4 border-blue-500 shadow-inner">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">История платежей</p>
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
                              <tbody className="divide-y divide-slate-100">
                                {t.payments.map((p: any) => (
                                  <tr key={p.id}>
                                    <td className="py-2">{new Date(p.payment_date).toLocaleDateString()}</td>
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
                                    <td className="py-2 text-slate-500">{p.creator?.full_name || p.created_by_name}</td>
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
                       <p className="text-sm font-medium text-slate-700">{new Date(selectedPayment.payment_date).toLocaleDateString()}</p>
                     </div>
                  </div>
                </div>

                <div className="space-y-3">
                   <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="material-icons-round text-slate-400">person</span>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Кто внес</p>
                        <p className="text-sm font-medium">{selectedPayment.creator?.full_name || selectedPayment.created_by_name}</p>
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
                      <p className="text-sm font-bold text-blue-900">{docDate ? new Date(docDate).toLocaleDateString() : '—'}</p>
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

      <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title="Детали операции">
        {selectedTrans && (
          <div className="space-y-6">
            <Badge color={selectedTrans.type === 'income' ? 'emerald' : 'red'}>{selectedTrans.type === 'income' ? 'ПРИХОД' : 'РАСХОД'}</Badge>
            <h3 className="text-2xl font-bold">{selectedTrans.category}</h3>
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-5 rounded-3xl border border-slate-100">
              <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Запрос</p><p className="text-lg font-bold">{formatBYN(selectedTrans.requested_amount || selectedTrans.amount)}</p></div>
              <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Факт</p><p className="text-lg font-bold text-emerald-600">{formatBYN(selectedTrans.fact_amount || (selectedTrans.status === 'approved' ? selectedTrans.amount : 0))}</p></div>
            </div>
            {selectedTrans.description && <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100"><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Описание</p><p className="text-sm text-slate-600 italic">{selectedTrans.description}</p></div>}
            {selectedTrans.planned_date && <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100"><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Планируемая дата</p><p className="text-sm font-medium">{new Date(selectedTrans.planned_date).toLocaleDateString()}</p></div>}
            {selectedTrans.doc_link && <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-3"><span className="material-icons-round text-blue-600">attach_file</span><a href={selectedTrans.doc_link} target="_blank" className="text-sm font-bold text-blue-700 underline truncate">{selectedTrans.doc_name || 'Просмотр документа'}</a></div>}
            <Button variant="tonal" className="w-full" onClick={() => setIsDetailsModalOpen(false)}>Закрыть</Button>
          </div>
        )}
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={formData.type === 'income' ? 'План прихода' : 'Заявка на расход'}>
        <form onSubmit={handleSaveTransaction} className="space-y-4">
           <div className="grid grid-cols-2 gap-4">
             <Input label="Сумма" type="number" step="0.01" required value={formData.amount} onChange={(e:any) => setFormData({ ...formData, amount: e.target.value })} icon="payments" />
             {formData.type === 'income' && (
               <Input label="Дата плана" type="date" required value={formData.planned_date} onChange={(e:any) => setFormData({ ...formData, planned_date: e.target.value })} icon="event" min={today} />
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
           <Button type="submit" className="w-full h-14" loading={loading} icon="save">Создать запись</Button>
        </form>
      </Modal>

      {/* Внесение оплаты */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Внести платеж">
        {selectedTrans && (
          <form onSubmit={async (e) => {
            e.preventDefault(); setLoading(true);
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
              setToast({message: 'Платеж успешно внесен', type: 'success'});
              await refreshData(); 
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

      {/* Утверждение расхода */}
      <Modal isOpen={isApprovalModalOpen} onClose={() => setIsApprovalModalOpen(false)} title="Утверждение расхода">
        {selectedTrans && (
          <form onSubmit={handleApproveExpense} className="space-y-4">
            <p className="text-sm text-slate-500">Запрошено: <b>{formatBYN(selectedTrans.requested_amount || selectedTrans.amount)}</b></p>
            <Input label="Сумма к утверждению" type="number" step="0.01" required value={approvalAmount} onChange={(e:any) => setApprovalAmount(e.target.value)} icon="payments" />
            <Button type="submit" className="w-full h-12" loading={loading} icon="check">Утвердить сумму</Button>
          </form>
        )}
      </Modal>

      {/* Подтверждения */}
      <ConfirmModal isOpen={isRejectConfirmOpen} onClose={() => setIsRejectConfirmOpen(false)} onConfirm={handleRejectExpense} title="Отклонить расход" message="Вы уверены, что хотите отклонить эту заявку?" loading={loading} />
      <ConfirmModal isOpen={isFinalizeConfirmOpen} onClose={() => setIsFinalizeConfirmOpen(false)} onConfirm={handleFinalizeIncome} title="Финализировать приход" message="Статус будет изменен на 'Завершено', а итоговая сумма прихода будет установлена равной фактическим выплатам." loading={loading} />
    </div>
  );
};

const StatCard = ({ label, val, subVal, color, active, onClick }: any) => (
  <div onClick={onClick} className={`p-5 rounded-[24px] border transition-all cursor-pointer hover:shadow-md ${active ? 'bg-[#d3e4ff] border-[#005ac1]' : 'bg-white border-slate-200'}`}>
    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-widest">{label}</p>
    <p className={`text-lg font-bold ${active ? 'text-[#001d3d]' : color === 'emerald' ? 'text-emerald-600' : color === 'red' ? 'text-red-600' : color === 'blue' ? 'text-blue-600' : 'text-slate-900'}`}>{val}</p>
    {subVal && <p className={`text-[9px] font-bold uppercase mt-1 ${active ? 'text-[#005ac1]/70' : 'text-slate-400'}`}>{subVal}</p>}
  </div>
);
