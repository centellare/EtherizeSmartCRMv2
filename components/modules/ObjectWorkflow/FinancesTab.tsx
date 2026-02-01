
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
  
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedTrans, setSelectedTrans] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  
  const [formData, setFormData] = useState({ 
    type: 'expense' as 'income' | 'expense',
    amount: '', 
    planned_date: new Date().toISOString().split('T')[0],
    category: '', 
    description: '',
    doc_link: '',
    doc_name: ''
  });

  const [approvalForm, setApprovalForm] = useState({ amount: '' });

  const isDirector = profile.role === 'director';
  const isSpecialist = profile.role === 'specialist';
  const isResponsibleManager = profile.role === 'manager' && object.responsible_id === profile.id;
  const canApprove = isAdmin || isDirector || isResponsibleManager;

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
    // В ObjectWorkflow/index.tsx уже приходит отфильтрованный список для специалиста
    return transactions.filter(t => {
      const matchesType = typeFilter === 'all' || t.type === typeFilter;
      const tDate = new Date(t.created_at);
      const matchesStart = !startDate || tDate >= new Date(startDate);
      const matchesEnd = !endDate || tDate <= new Date(endDate + 'T23:59:59');
      return matchesType && matchesStart && matchesEnd;
    });
  }, [transactions, typeFilter, startDate, endDate]);

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const amount = Number(formData.amount);
    
    // Специалист может вносить только расходы
    const finalType = isSpecialist ? 'expense' : formData.type;

    const { error } = await supabase.from('transactions').insert([{
      object_id: object.id,
      type: finalType,
      amount: amount,
      planned_amount: amount,
      planned_date: finalType === 'income' ? formData.planned_date : null,
      category: formData.category,
      description: formData.description,
      doc_link: formData.doc_link || null,
      doc_name: formData.doc_name || null,
      status: 'pending',
      created_by: profile.id
    }]);

    if (!error) {
      setIsModalOpen(false);
      resetForm();
      await refreshData();
    }
    setLoading(false);
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrans) return;

    const amountToAdd = Number(paymentAmount);
    const balanceLeft = selectedTrans.amount - (selectedTrans.fact_amount || 0);

    if (amountToAdd > balanceLeft + 0.01) {
      alert(`Ошибка: Сумма платежа превышает остаток по счету! Остаток: ${balanceLeft.toFixed(2)} BYN.`);
      return;
    }

    setLoading(true);
    const currentFact = Number(selectedTrans.fact_amount || 0);
    const newTotalPaid = currentFact + amountToAdd;

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
    await refreshData();
    setLoading(false);
  };

  const handleFinalizeIncome = async () => {
    if (!selectedTrans) return;
    setLoading(true);
    const updates: any = {
      amount: selectedTrans.fact_amount,
      status: 'approved'
    };
    if (selectedTrans.amount !== selectedTrans.fact_amount) {
      updates.requested_amount = selectedTrans.amount;
    }
    await supabase.from('transactions').update(updates).eq('id', selectedTrans.id);
    setIsFinalizeConfirmOpen(false);
    await refreshData();
    setLoading(false);
  };

  const handleApproveAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrans) return;
    setLoading(true);
    const finalAmount = Number(approvalForm.amount);
    const payload: any = { status: 'approved' };
    if (finalAmount !== selectedTrans.amount) {
      payload.amount = finalAmount;
      payload.requested_amount = selectedTrans.amount;
    }
    await supabase.from('transactions').update(payload).eq('id', selectedTrans.id);
    setIsApprovalModalOpen(false);
    await refreshData();
    setLoading(false);
  };

  const handleReject = async (id: string) => {
    await supabase.from('transactions').update({ status: 'rejected' }).eq('id', id);
    await refreshData();
  };

  const currentDebt = selectedTrans ? (selectedTrans.amount - (selectedTrans.fact_amount || 0)) : 0;
  const isOverpaidAttempt = Number(paymentAmount) > currentDebt + 0.01;

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
            {isSpecialist && (
              <p className="text-xs text-slate-500 mt-1 italic">Доступен просмотр и внесение только ваших расходов.</p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
             {!isSpecialist && (
               <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={(e:any) => setStartDate(e.target.value)} 
                    icon="event" 
                    className="h-10 !py-1 !text-[11px] !rounded-xl min-w-[130px]"
                  />
                  <span className="text-slate-300 text-[10px] font-bold uppercase">—</span>
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={(e:any) => setEndDate(e.target.value)} 
                    icon="event" 
                    className="h-10 !py-1 !text-[11px] !rounded-xl min-w-[130px]"
                  />
               </div>
             )}
             <div className="flex gap-2 w-full sm:w-auto ml-1">
                <Button variant="tonal" icon="request_quote" onClick={() => { resetForm(); setFormData(p => ({...p, type: 'expense'})); setIsModalOpen(true); }} className="flex-1 text-xs h-10">Внести расход</Button>
                {!isSpecialist && <Button icon="add_chart" onClick={() => { resetForm(); setFormData(p => ({...p, type: 'income'})); setIsModalOpen(true); }} className="flex-1 text-xs h-10">План прихода</Button>}
             </div>
          </div>
       </div>
       
       <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-5 text-[10px] uppercase font-bold text-slate-400">Тип / Дата</th>
                  <th className="p-5 text-[10px] uppercase font-bold text-slate-400">Описание</th>
                  <th className="p-5 text-[10px] uppercase font-bold text-slate-400">Сумма (План)</th>
                  <th className="p-5 text-[10px] uppercase font-bold text-slate-400">Факт</th>
                  <th className="p-5 text-[10px] uppercase font-bold text-slate-400">Статус</th>
                  <th className="p-5 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map(t => {
                  const isExpanded = expandedRows.has(t.id);
                  const payments = t.payments || [];
                  const hasPayments = payments.length > 0;
                  const balanceLeft = t.amount - (t.fact_amount || 0);
                  const lastPayment = hasPayments ? payments[0] : null;

                  const todayStr = new Date().toISOString().split('T')[0];
                  const isOverdue = t.type === 'income' && t.status !== 'approved' && t.planned_date && t.planned_date < todayStr;
                  const daysDiff = isOverdue ? Math.floor((new Date(todayStr).getTime() - new Date(t.planned_date!).getTime()) / (1000 * 86400)) : 0;
                  
                  return (
                    <React.Fragment key={t.id}>
                      <tr className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-slate-50' : ''} ${isOverdue ? 'border-l-4 border-l-red-500' : ''}`}>
                        <td className="p-5">
                          <Badge color={t.type === 'income' ? 'emerald' : 'red'}>
                            {t.type === 'income' ? 'ПРИХОД' : 'РАСХОД'}
                          </Badge>
                          <p className="text-[10px] text-slate-400 font-bold mt-1.5">{new Date(t.created_at).toLocaleDateString()}</p>
                        </td>
                        <td className="p-5">
                          <div className="flex items-center gap-2">
                             <p className="text-sm font-medium">{t.category}</p>
                             {t.doc_link && (
                               <a href={t.doc_link} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700">
                                 <span className="material-icons-round text-sm">attach_file</span>
                               </a>
                             )}
                          </div>
                          <p className="text-[10px] text-slate-400 italic truncate max-w-[200px]">{t.description}</p>
                        </td>
                        <td className="p-5">
                          <div className="flex flex-col">
                            <span className={`font-bold text-base ${t.type === 'income' ? 'text-emerald-700' : 'text-red-700'}`}>
                              {formatBYN(t.amount)}
                            </span>
                            {!isSpecialist && t.planned_date && (
                              <div className="flex flex-col mt-0.5">
                                <div className="flex items-center gap-1">
                                   <span className={`text-[9px] font-bold uppercase ${isOverdue ? 'text-red-600' : 'text-blue-500'}`}>
                                     Срок: {new Date(t.planned_date).toLocaleDateString()}
                                   </span>
                                   {isOverdue && <span className="material-icons-round text-[12px] text-red-600 animate-pulse">priority_high</span>}
                                </div>
                                {isOverdue && (
                                  <span className="text-[8px] font-bold text-red-500 uppercase tracking-tighter">Просрочено {daysDiff} дн.</span>
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
                                   className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isExpanded ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
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
                          ) : '—'}
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
                                <button onClick={() => { setSelectedTrans(t); setPaymentAmount(''); setIsPaymentModalOpen(true); }} className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center shadow-sm">
                                  <span className="material-icons-round text-sm">add_card</span>
                                </button>
                                {t.status === 'partial' && (
                                  <button onClick={() => { setSelectedTrans(t); setIsFinalizeConfirmOpen(true); }} className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center shadow-sm">
                                    <span className="material-icons-round text-sm">verified</span>
                                  </button>
                                )}
                              </div>
                            )}
                            {t.type === 'expense' && t.status === 'pending' && canApprove && (
                               <div className="flex gap-1">
                                 <button onClick={() => { setSelectedTrans(t); setApprovalForm({amount: t.amount.toString()}); setIsApprovalModalOpen(true); }} className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center shadow-sm">
                                   <span className="material-icons-round text-sm">done</span>
                                 </button>
                                 <button onClick={() => handleReject(t.id)} className="w-9 h-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-sm">
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
                                          <span className="text-[9px] text-slate-400 font-bold uppercase">{new Date(p.payment_date).toLocaleDateString()} в {new Date(p.payment_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
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
          </div>
       </div>

      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Внести платеж">
        {selectedTrans && (
          <form onSubmit={handleAddPayment} className="space-y-6">
            <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl">
               <div className="flex justify-between items-center mb-1">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ожидаемый остаток</p>
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

       <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={isSpecialist ? 'Новый расход' : (formData.type === 'income' ? 'План прихода' : 'Запрос на расход')}>
        <form onSubmit={handleSaveTransaction} className="space-y-4">
           <Input label="Сумма (BYN)" type="number" step="0.01" required value={formData.amount} onChange={(e:any) => setFormData({...formData, amount: e.target.value})} icon="payments" />
           
           {!isSpecialist && formData.type === 'income' && (
             <Input label="Плановая дата зачисления" type="date" required value={formData.planned_date} onChange={(e:any) => setFormData({...formData, planned_date: e.target.value})} icon="event" />
           )}
           
           <Input label="Категория" required value={formData.category} onChange={(e:any) => setFormData({...formData, category: e.target.value})} icon="category" />
           
           <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Документация (опционально)</p>
              <Input label="Название документа" value={formData.doc_name} onChange={(e:any) => setFormData({...formData, doc_name: e.target.value})} icon="description" />
              <Input label="Ссылка" value={formData.doc_link} onChange={(e:any) => setFormData({...formData, doc_link: e.target.value})} icon="link" />
           </div>
           
           <div className="w-full">
            <label className="block text-xs font-medium text-[#444746] mb-1.5 ml-1">Описание / Заметки</label>
            <textarea className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm outline-none focus:border-blue-500 shadow-inner" rows={3} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
           </div>
           
           <Button type="submit" className="w-full h-12" loading={loading} icon="save">Создать запись</Button>
        </form>
      </Modal>

      <Modal isOpen={isApprovalModalOpen} onClose={() => setIsApprovalModalOpen(false)} title="Подтверждение суммы">
        {selectedTrans && (
          <form onSubmit={handleApproveAction} className="space-y-5">
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
               <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Запрошенная сумма</p>
               <p className="text-xl font-bold text-blue-900">{formatBYN(selectedTrans.amount)}</p>
            </div>
            <Input label="Одобренная сумма (BYN)" type="number" step="0.01" autoFocus required value={approvalForm.amount} onChange={(e:any) => setApprovalForm({...approvalForm, amount: e.target.value})} icon="fact_check" />
            <Button type="submit" className="w-full h-12" icon="verified" loading={loading}>Подтвердить</Button>
          </form>
        )}
      </Modal>

      <ConfirmModal 
        isOpen={isFinalizeConfirmOpen}
        onClose={() => setIsFinalizeConfirmOpen(false)}
        onConfirm={handleFinalizeIncome}
        title="Завершение платежа"
        message={`Вы уверены, что хотите завершить этот приход? Плановая сумма (${formatBYN(selectedTrans?.amount)}) будет приравнена к фактически внесенной (${formatBYN(selectedTrans?.fact_amount)}).`}
        confirmLabel="Да, закрыть счет"
        confirmVariant="tonal"
        loading={loading}
      />
    </div>
  );
};
