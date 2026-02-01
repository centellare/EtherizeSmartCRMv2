
import React, { useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Modal, Input, Badge, Select, ConfirmModal } from '../../ui';
import { Transaction } from '../../../types';

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
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isFinalizeConfirmOpen, setIsFinalizeConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isRejectConfirmOpen, setIsRejectConfirmOpen] = useState(false);
  
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedTrans, setSelectedTrans] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentComment, setPaymentComment] = useState('');
  const [approvalAmount, setApprovalAmount] = useState('');
  
  const [formData, setFormData] = useState({ 
    type: 'expense' as 'income' | 'expense',
    amount: '', 
    planned_date: new Date().toISOString().split('T')[0],
    category: '', 
    description: '',
    doc_link: '',
    doc_name: ''
  });

  const isDirector = profile.role === 'director';
  const isManager = profile.role === 'manager';
  const isSpecialist = profile.role === 'specialist';
  
  const canApproveOnThisObject = isAdmin || isDirector || (isManager && object.responsible_id === profile.id);

  const toggleRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetForm = () => {
    setFormData({
      type: 'expense',
      amount: '',
      planned_date: new Date().toISOString().split('T')[0],
      category: '',
      description: '',
      doc_link: '',
      doc_name: ''
    });
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesType = typeFilter === 'all' || t.type === typeFilter;
      const tDate = new Date(t.created_at);
      const matchesStart = !startDate || tDate >= new Date(startDate);
      const matchesEnd = !endDate || tDate <= new Date(endDate + 'T23:59:59');
      return matchesType && matchesStart && matchesEnd;
    });
  }, [transactions, typeFilter, startDate, endDate]);

  const objectSummary = useMemo(() => {
    const dateFiltered = transactions.filter(t => {
      const tDate = new Date(t.created_at);
      const matchesStart = !startDate || tDate >= new Date(startDate);
      const matchesEnd = !endDate || tDate <= new Date(endDate + 'T23:59:59');
      return matchesStart && matchesEnd;
    });

    const factIncome = dateFiltered.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.fact_amount || 0), 0);
    const planIncome = dateFiltered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const debt = planIncome - factIncome;
    const factExpenses = dateFiltered.filter(t => t.type === 'expense' && t.status === 'approved').reduce((sum, t) => sum + t.amount, 0);
    return { balance: factIncome - factExpenses, debt, planIncome, factExpenses };
  }, [transactions, startDate, endDate]);

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const amount = Number(formData.amount);
    const finalType = isSpecialist ? 'expense' : formData.type;
    await supabase.from('transactions').insert([{
      object_id: object.id,
      type: finalType,
      amount: amount,
      planned_amount: amount,
      requested_amount: amount,
      planned_date: finalType === 'income' ? formData.planned_date : null,
      category: formData.category,
      description: formData.description,
      doc_link: formData.doc_link || null,
      doc_name: formData.doc_name || null,
      status: 'pending',
      created_by: profile.id
    }]);
    setIsModalOpen(false); resetForm(); await refreshData();
    setLoading(false);
  };

  const handleApproveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrans) return;
    setLoading(true);
    const finalAmount = Number(approvalAmount);
    await supabase.from('transactions').update({ 
      status: 'approved', 
      amount: finalAmount, 
      requested_amount: selectedTrans.requested_amount || selectedTrans.amount,
      processed_by: profile.id,
      processed_at: new Date().toISOString()
    }).eq('id', selectedTrans.id);
    setIsApprovalModalOpen(false); setSelectedTrans(null); await refreshData();
    setLoading(false);
  };

  const handleRejectExpense = async () => {
    if (!selectedTrans) return;
    setLoading(true);
    await supabase.from('transactions').update({ 
      status: 'rejected',
      processed_by: profile.id,
      processed_at: new Date().toISOString()
    }).eq('id', selectedTrans.id);
    setIsRejectConfirmOpen(false); setSelectedTrans(null); await refreshData();
    setLoading(false);
  };

  const handleSoftDelete = async () => {
    if (!selectedTrans) return;
    setLoading(true);
    await supabase.from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', selectedTrans.id);
    setIsDeleteConfirmOpen(false); setSelectedTrans(null); await refreshData();
    setLoading(false);
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrans) return;
    const amountToAdd = Number(paymentAmount);
    const balanceLeft = selectedTrans.amount - (selectedTrans.fact_amount || 0);
    if (amountToAdd > balanceLeft + 0.01) return;

    setLoading(true);
    await supabase.from('transaction_payments').insert([{ 
      transaction_id: selectedTrans.id, 
      amount: amountToAdd, 
      comment: paymentComment,
      created_by: profile.id 
    }]);
    const newFact = (selectedTrans.fact_amount || 0) + amountToAdd;
    await supabase.from('transactions').update({ 
      status: newFact >= selectedTrans.amount - 0.01 ? 'approved' : 'partial', 
      fact_amount: newFact 
    }).eq('id', selectedTrans.id);
    setIsPaymentModalOpen(false); setPaymentAmount(''); setPaymentComment(''); await refreshData();
    setLoading(false);
  };

  const handleFinalizeIncome = async () => {
    if (!selectedTrans) return;
    setLoading(true);
    await supabase.from('transactions').update({ 
      status: 'approved', 
      amount: selectedTrans.fact_amount || 0,
      description: (selectedTrans.description || '') + ' (Закрыто вручную)',
      processed_by: profile.id,
      processed_at: new Date().toISOString()
    }).eq('id', selectedTrans.id);
    setIsFinalizeConfirmOpen(false); setSelectedTrans(null); await refreshData();
    setLoading(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
       <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h4 className="text-xl font-medium">Финансы объекта</h4>
            {!isSpecialist && (
              <div className="flex gap-2 mt-2">
                <button onClick={() => setTypeFilter('all')} className={`px-4 py-1 rounded-full text-[10px] font-bold uppercase border transition-all ${typeFilter === 'all' ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}>Все</button>
                <button onClick={() => setTypeFilter('income')} className={`px-4 py-1 rounded-full text-[10px] font-bold uppercase border transition-all ${typeFilter === 'income' ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}>Приходы</button>
                <button onClick={() => setTypeFilter('expense')} className={`px-4 py-1 rounded-full text-[10px] font-bold uppercase border transition-all ${typeFilter === 'expense' ? 'bg-red-600 border-red-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}>Расходы</button>
              </div>
            )}
          </div>
          <div className="flex gap-2 items-center">
             <div className="flex items-center gap-2 mr-4 bg-white px-3 py-1.5 rounded-2xl border border-slate-200">
                <Input type="date" value={startDate} onChange={(e:any) => setStartDate(e.target.value)} className="!border-0 !p-0 h-6 text-[10px] w-28" />
                <span className="text-[10px] text-slate-300 font-bold">ПО</span>
                <Input type="date" value={endDate} onChange={(e:any) => setEndDate(e.target.value)} className="!border-0 !p-0 h-6 text-[10px] w-28" />
             </div>
             <Button variant="tonal" icon="request_quote" onClick={() => { resetForm(); setFormData((p: any) => ({...p, type: 'expense'})); setIsModalOpen(true); }} className="text-xs h-10">Внести расход</Button>
             {!isSpecialist && <Button icon="add_chart" onClick={() => { resetForm(); setFormData((p: any) => ({...p, type: 'income'})); setIsModalOpen(true); }} className="text-xs h-10">План прихода</Button>}
          </div>
       </div>

       {!isSpecialist && (
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Баланс</p><p className={`text-xl font-bold ${objectSummary.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatBYN(objectSummary.balance)}</p></div>
            <div className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Дебиторка</p><p className="text-xl font-bold text-blue-600">{formatBYN(objectSummary.debt)}</p></div>
            <div className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Приходы (План)</p><p className="text-xl font-bold text-slate-800">{formatBYN(objectSummary.planIncome)}</p></div>
            <div className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Расходы</p><p className="text-xl font-bold text-red-600">{formatBYN(objectSummary.factExpenses)}</p></div>
         </div>
       )}
       
       <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-5 text-[10px] uppercase font-bold text-slate-400">Тип / Дата</th>
                <th className="p-5 text-[10px] uppercase font-bold text-slate-400">Описание</th>
                <th className="p-5 text-[10px] uppercase font-bold text-slate-400">Сумма (Запрос)</th>
                <th className="p-5 text-[10px] uppercase font-bold text-slate-400">Факт / Утв.</th>
                <th className="p-5 text-[10px] uppercase font-bold text-slate-400">Статус</th>
                <th className="p-5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map(t => {
                const isExpanded = expandedRows.has(t.id);
                return (
                  <React.Fragment key={t.id}>
                    <tr className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-slate-50' : ''}`}>
                      <td className="p-5"><Badge color={t.type === 'income' ? 'emerald' : 'red'}>{t.type === 'income' ? 'ПРИХОД' : 'РАСХОД'}</Badge><p className="text-[10px] text-slate-400 font-bold mt-1.5">{new Date(t.created_at).toLocaleDateString()}</p></td>
                      <td className="p-5">
                        <p className="text-sm font-medium">{t.category}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[10px] text-slate-400 italic truncate max-w-[200px]">{t.description}</p>
                          {t.doc_link && (
                            <a href={t.doc_link} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700" title={t.doc_name || 'Открыть документ'}>
                              <span className="material-icons-round text-sm">attach_file</span>
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="p-5 font-bold">
                        {formatBYN(t.type === 'expense' ? (t.requested_amount || t.amount) : t.amount)}
                      </td>
                      <td className="p-5">
                        {t.type === 'income' ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{formatBYN(t.fact_amount || 0)}</span>
                            <button onClick={(e) => toggleRow(t.id, e)} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-all">
                               <span className="material-icons-round text-sm">{isExpanded ? 'expand_less' : 'history'}</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm font-bold text-slate-700">
                            {t.status === 'approved' ? formatBYN(t.amount) : '—'}
                          </span>
                        )}
                      </td>
                      <td className="p-5">
                        <Badge color={t.status === 'approved' ? 'emerald' : t.status === 'partial' ? 'blue' : t.status === 'rejected' ? 'red' : 'amber'}>
                          {t.status?.toUpperCase()}
                        </Badge>
                        {t.processor_name && (
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-tighter">
                            {t.status === 'approved' ? 'Утв: ' : 'Откл: '} {t.processor_name.split(' ')[0]}
                          </p>
                        )}
                      </td>
                      <td className="p-5 text-right">
                        <div className="flex justify-end gap-1.5">
                          {t.type === 'income' && t.status !== 'approved' && !isSpecialist && (
                            <>
                              <button onClick={() => { setSelectedTrans(t); setPaymentAmount(''); setPaymentComment(''); setIsPaymentModalOpen(true); }} className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-all" title="Внести платеж"><span className="material-icons-round text-sm">add_card</span></button>
                              <button onClick={() => { setSelectedTrans(t); setIsFinalizeConfirmOpen(true); }} className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all" title="Завершить как итог"><span className="material-icons-round text-sm">done_all</span></button>
                            </>
                          )}
                          {t.type === 'expense' && t.status === 'pending' && canApproveOnThisObject && (
                            <>
                              <button onClick={() => { setSelectedTrans(t); setApprovalAmount((t.requested_amount || t.amount).toString()); setIsApprovalModalOpen(true); }} className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-all" title="Утвердить"><span className="material-icons-round text-sm">check</span></button>
                              <button onClick={() => { setSelectedTrans(t); setIsRejectConfirmOpen(true); }} className="w-9 h-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all" title="Отклонить"><span className="material-icons-round text-sm">close</span></button>
                            </>
                          )}
                          {isAdmin && (
                            <button onClick={() => { setSelectedTrans(t); setIsDeleteConfirmOpen(true); }} className="w-9 h-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all"><span className="material-icons-round text-sm">delete</span></button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={6} className="p-4 pl-16">
                           <div className="space-y-2">
                              {t.payments && t.payments.length > 0 ? t.payments.map(p => (
                                <div key={p.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-bold text-emerald-700">+{formatBYN(p.amount)}</span>
                                    {p.comment && <p className="text-[11px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded mt-1">«{p.comment}»</p>}
                                  </div>
                                  <div className="text-right">
                                     <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{p.created_by_name}</p>
                                     <p className="text-[9px] text-slate-300 font-bold uppercase">{new Date(p.payment_date).toLocaleString()}</p>
                                  </div>
                                </div>
                              )) : (
                                <p className="text-xs text-slate-400 italic">Оплат по этой записи нет</p>
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
       </div>

      <Modal isOpen={isApprovalModalOpen} onClose={() => setIsApprovalModalOpen(false)} title="Утвердить расход">
        {selectedTrans && (
          <form onSubmit={handleApproveExpense} className="space-y-4">
             <div className="p-4 bg-blue-50 rounded-2xl">
                <p className="text-xs text-blue-800 font-bold uppercase mb-1">Запрошено:</p>
                <p className="text-xl font-bold text-blue-900">{formatBYN(selectedTrans.requested_amount || selectedTrans.amount)}</p>
             </div>
             <Input label="Сумма к выдаче" type="number" step="0.01" required value={approvalAmount} onChange={(e:any) => setApprovalAmount(e.target.value)} icon="fact_check" />
             <Button type="submit" className="w-full h-12" loading={loading} icon="done">Подтвердить</Button>
          </form>
        )}
      </Modal>

      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Внести платеж">
        {selectedTrans && (
          <form onSubmit={handleAddPayment} className="space-y-4">
             {(() => {
                const balanceLeft = selectedTrans.amount - (selectedTrans.fact_amount || 0);
                const currentVal = Number(paymentAmount) || 0;
                const isOverpaid = currentVal > balanceLeft + 0.01;
                return (
                  <>
                    <div className={`p-4 rounded-2xl mb-2 transition-colors ${isOverpaid ? 'bg-red-50' : 'bg-emerald-50'}`}>
                        <p className={`text-xs font-medium ${isOverpaid ? 'text-red-800' : 'text-emerald-800'}`}>Остаток долга: <span className="font-bold">{formatBYN(balanceLeft)}</span></p>
                    </div>
                    <div className="relative">
                        <Input label="Сумма оплаты" type="number" step="0.01" required value={paymentAmount} onChange={(e:any) => setPaymentAmount(e.target.value)} icon="account_balance_wallet" className={isOverpaid ? '!border-red-500' : ''} />
                        <button 
                          type="button" 
                          onClick={() => setPaymentAmount(balanceLeft.toFixed(2))}
                          className="absolute right-3 top-9 px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold uppercase rounded-lg hover:bg-emerald-700"
                        >
                          Вся сумма
                        </button>
                    </div>
                    <Input label="Заметка к платежу" value={paymentComment} onChange={(e:any) => setPaymentComment(e.target.value)} icon="comment" />
                    <Button type="submit" className="w-full h-12" loading={loading} icon="check" disabled={isOverpaid || currentVal <= 0}>Оплатить</Button>
                  </>
                );
             })()}
          </form>
        )}
      </Modal>

      <ConfirmModal isOpen={isRejectConfirmOpen} onClose={() => setIsRejectConfirmOpen(false)} onConfirm={handleRejectExpense} title="Отклонить заявку?" message="Расход будет помечен как отклоненный." confirmVariant="danger" loading={loading} />
      <ConfirmModal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} onConfirm={handleSoftDelete} title="Удалить операцию?" message="Транзакция будет перемещена в корзину." loading={loading} />
      <ConfirmModal isOpen={isFinalizeConfirmOpen} onClose={() => setIsFinalizeConfirmOpen(false)} onConfirm={handleFinalizeIncome} title="Завершить приход?" message="План будет приравнен к фактической сумме." confirmVariant="tonal" loading={loading} />
      
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Новая финансовая запись">
        <form onSubmit={handleSaveTransaction} className="space-y-4">
           <div className="grid grid-cols-2 gap-4">
             <Input label="Сумма" type="number" step="0.01" required value={formData.amount} onChange={(e:any) => setFormData((p: any) => ({...p, amount: e.target.value}))} icon="payments" />
             <Input label="Дата плана" type="date" value={formData.planned_date} onChange={(e:any) => setFormData((p: any) => ({...p, planned_date: e.target.value}))} icon="calendar_today" />
           </div>
           <Input label="Категория" required value={formData.category} onChange={(e:any) => setFormData((p: any) => ({...p, category: e.target.value}))} icon="category" />
           <Input label="Описание" value={formData.description} onChange={(e:any) => setFormData((p: any) => ({...p, description: e.target.value}))} icon="notes" />
           
           <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Документация (опц.)</p>
             <div className="grid grid-cols-2 gap-4">
               <Input label="Имя документа" value={formData.doc_name} onChange={(e:any) => setFormData((p: any) => ({...p, doc_name: e.target.value}))} icon="description" />
               <Input label="Ссылка" value={formData.doc_link} onChange={(e:any) => setFormData((p: any) => ({...p, doc_link: e.target.value}))} icon="link" />
             </div>
          </div>
          <Button type="submit" className="w-full h-14" loading={loading} icon="save">Создать</Button>
        </form>
      </Modal>
    </div>
  );
};
