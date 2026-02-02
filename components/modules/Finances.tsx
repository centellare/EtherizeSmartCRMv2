
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, measureQuery } from '../../lib/supabase';
import { Button, Input, Select, Modal, Badge, ConfirmModal, Toast } from '../ui';
import { Transaction } from '../../types';

const formatBYN = (amount: number = 0) => {
  return new Intl.NumberFormat('ru-BY', {
    style: 'currency',
    currency: 'BYN',
    minimumFractionDigits: 2
  }).format(amount);
};

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

  const [isMainModalOpen, setIsMainModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isFinalizeConfirmOpen, setIsFinalizeConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isRejectConfirmOpen, setIsRejectConfirmOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  
  const [selectedTrans, setSelectedTrans] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentComment, setPaymentComment] = useState('');
  const [approvalAmount, setApprovalAmount] = useState('');
  
  const today = new Date().toISOString().split('T')[0];

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
  };

  const isAdmin = profile?.role === 'admin';
  const isDirector = profile?.role === 'director';
  const isManager = profile?.role === 'manager';
  const isSpecialist = profile?.role === 'specialist';
  const canApprove = isAdmin || isDirector || isManager;

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
    const tChannel = supabase.channel('finances_realtime_global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchData(true))
      .subscribe();
    return () => { supabase.removeChannel(tChannel); };
  }, [fetchData]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t: Transaction) => {
      const tDate = new Date(t.created_at);
      const matchesStart = !startDate || tDate >= new Date(startDate);
      const matchesEnd = !endDate || tDate <= new Date(endDate + 'T23:59:59');
      if (!matchesStart || !matchesEnd) return false;

      if (summaryFilter === 'cash') return (t.type === 'income' && t.status !== 'pending') || (t.type === 'expense' && t.status === 'approved');
      if (summaryFilter === 'debt') return t.type === 'income' && t.status !== 'approved';
      if (summaryFilter === 'total_income') return t.type === 'income';
      if (summaryFilter === 'approved_expenses') return t.type === 'expense' && t.status === 'approved';
      
      return typeFilter === 'all' || t.type === typeFilter;
    });
  }, [transactions, typeFilter, startDate, endDate, summaryFilter]);

  const totals = useMemo(() => {
    const data = transactions.filter(t => {
      const d = new Date(t.created_at);
      return (!startDate || d >= new Date(startDate)) && (!endDate || d <= new Date(endDate + 'T23:59:59'));
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
      fetchData(true); 
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
      fetchData(true);
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
      fetchData(true);
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
      fetchData(true);
    }
    setLoading(false);
  };

  return (
    <div className="animate-in fade-in duration-500">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f] flex items-center gap-3">Финансы</h2>
          <div className="flex gap-2 mt-3">
             <button onClick={() => { setTypeFilter('all'); setSummaryFilter(null); }} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase border ${typeFilter === 'all' && !summaryFilter ? 'bg-[#005ac1] text-white' : 'bg-white text-slate-500'}`}>Все</button>
             <button onClick={() => { setTypeFilter('income'); setSummaryFilter(null); }} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase border ${typeFilter === 'income' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500'}`}>Приходы</button>
             <button onClick={() => { setTypeFilter('expense'); setSummaryFilter(null); }} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase border ${typeFilter === 'expense' ? 'bg-red-600 text-white' : 'bg-white text-slate-500'}`}>Расходы</button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2">
           <div className="flex items-center gap-2">
              <Input type="date" value={startDate} onChange={(e:any) => setStartDate(e.target.value)} icon="event" className="h-12 !py-2 !text-xs w-[140px]" />
              <Input type="date" value={endDate} onChange={(e:any) => setEndDate(e.target.value)} icon="event" className="h-12 !py-2 !text-xs w-[140px]" />
           </div>
           <div className="flex gap-2 ml-2">
              <Button variant="tonal" onClick={() => { resetForm(); setFormData(prev => ({ ...prev, type: 'expense' })); setIsMainModalOpen(true); }} icon="request_quote">Расход</Button>
              {!isSpecialist && <Button onClick={() => { resetForm(); setFormData(prev => ({ ...prev, type: 'income' })); setIsMainModalOpen(true); }} icon="add_chart">Приход</Button>}
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
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Тип / Дата</th>
              <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Объект / Описание</th>
              <th className="p-5 text-[10px] font-bold text-slate-400 uppercase w-10">Док</th>
              <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Сумма</th>
              <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Факт</th>
              <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Статус</th>
              <th className="p-5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTransactions.map(t => (
              <React.Fragment key={t.id}>
                <tr className="hover:bg-slate-50 transition-colors group">
                  <td className="p-5">
                    <Badge color={t.type === 'income' ? 'emerald' : 'red'}>{t.type === 'income' ? 'ПРИХОД' : 'РАСХОД'}</Badge>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">{new Date(t.created_at).toLocaleDateString()}</p>
                  </td>
                  <td className="p-5 cursor-pointer" onClick={() => { setSelectedTrans(t); setIsDetailsModalOpen(true); }}>
                    <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{t.objects?.name || '—'}</p>
                    <p className="text-xs text-slate-500 line-clamp-1">{t.description || t.category}</p>
                  </td>
                  <td className="p-5">
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
                          <button onClick={(e) => { e.stopPropagation(); setSelectedTrans(t); setPaymentAmount(''); setPaymentComment(''); setIsPaymentModalOpen(true); }} className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-all" title="Внести оплату"><span className="material-icons-round text-sm">add_card</span></button>
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
                    <td colSpan={7} className="p-0">
                      <div className="px-10 py-4 border-l-4 border-blue-500 ml-5 my-2 bg-white rounded-xl shadow-inner">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest">История частичных платежей</p>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-slate-400 border-b border-slate-100">
                              <th className="pb-2 text-left font-medium">Дата</th>
                              <th className="pb-2 text-left font-medium">Сумма</th>
                              <th className="pb-2 text-left font-medium">Кто внес</th>
                              <th className="pb-2 text-left font-medium">Комментарий</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {t.payments.map((p: any) => (
                              <tr key={p.id}>
                                <td className="py-2">{new Date(p.payment_date).toLocaleDateString()}</td>
                                <td className="py-2 font-bold text-emerald-600">{formatBYN(p.amount)}</td>
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
            ))}
          </tbody>
        </table>
      </div>

      {/* Модалка деталей транзакции */}
      <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title="Детали финансовой записи">
        {selectedTrans && (
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <Badge color={selectedTrans.type === 'income' ? 'emerald' : 'red'}>{selectedTrans.type === 'income' ? 'ПРИХОД' : 'РАСХОД'}</Badge>
                <h3 className="text-2xl font-bold mt-2">{selectedTrans.category}</h3>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Статус</p>
                <Badge color={selectedTrans.status === 'approved' ? 'emerald' : selectedTrans.status === 'rejected' ? 'red' : 'amber'}>{selectedTrans.status?.toUpperCase()}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-white p-5 rounded-3xl border border-slate-100">
              <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Сумма запроса</p><p className="text-lg font-bold">{formatBYN(selectedTrans.requested_amount || selectedTrans.amount)}</p></div>
              <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Фактически</p><p className="text-lg font-bold text-emerald-600">{formatBYN(selectedTrans.fact_amount || (selectedTrans.status === 'approved' ? selectedTrans.amount : 0))}</p></div>
            </div>

            <div className="space-y-4">
              <DetailItem label="Объект" val={selectedTrans.objects?.name} icon="business" />
              <DetailItem label="Создал" val={selectedTrans.created_by_name} icon="person" />
              {selectedTrans.planned_date && <DetailItem label="Планируемая дата" val={new Date(selectedTrans.planned_date).toLocaleDateString()} icon="event" />}
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

      {/* Основная форма создания */}
      <Modal isOpen={isMainModalOpen} onClose={() => setIsMainModalOpen(false)} title={formData.type === 'income' ? 'План прихода' : 'Заявка на расход'}>
        <form onSubmit={handleCreateTransaction} className="space-y-4">
          <Select label="Объект" required value={formData.object_id} onChange={(e:any) => setFormData({ ...formData, object_id: e.target.value })} options={[{value: '', label: 'Выберите объект'}, ...objects.map(o => ({value: o.id, label: o.name}))]} icon="business" />
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

      {/* Внесение платежа (Приход) */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Внести оплату">
        {selectedTrans && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            const amt = Number(paymentAmount);
            await supabase.from('transaction_payments').insert([{ transaction_id: selectedTrans.id, amount: amt, comment: paymentComment, created_by: profile.id }]);
            const newFact = (selectedTrans.fact_amount || 0) + amt;
            await supabase.from('transactions').update({ status: newFact >= selectedTrans.amount - 0.01 ? 'approved' : 'partial', fact_amount: newFact }).eq('id', selectedTrans.id);
            setIsPaymentModalOpen(false); fetchData(true); setLoading(false);
          }} className="space-y-4">
            <Input label="Сумма оплаты" type="number" step="0.01" required value={paymentAmount} onChange={(e:any) => setPaymentAmount(e.target.value)} icon="account_balance_wallet" />
            <Input label="Комментарий" value={paymentComment} onChange={(e:any) => setPaymentComment(e.target.value)} icon="comment" />
            <Button type="submit" className="w-full h-12" loading={loading} icon="check">Подтвердить платеж</Button>
          </form>
        )}
      </Modal>

      {/* Утверждение расхода */}
      <Modal isOpen={isApprovalModalOpen} onClose={() => setIsApprovalModalOpen(false)} title="Утверждение расхода">
        {selectedTrans && (
          <form onSubmit={handleApproveExpense} className="space-y-4">
            <p className="text-sm text-slate-500">Запрошенная сумма: <b>{formatBYN(selectedTrans.requested_amount || selectedTrans.amount)}</b></p>
            <Input label="Сумма к утверждению" type="number" step="0.01" required value={approvalAmount} onChange={(e:any) => setApprovalAmount(e.target.value)} icon="payments" />
            <Button type="submit" className="w-full h-12" loading={loading} icon="check">Утвердить сумму</Button>
          </form>
        )}
      </Modal>

      {/* Подтверждения */}
      <ConfirmModal isOpen={isRejectConfirmOpen} onClose={() => setIsRejectConfirmOpen(false)} onConfirm={handleRejectExpense} title="Отклонить заявку" message="Вы уверены, что хотите отклонить этот расход? Действие нельзя отменить." loading={loading} />
      <ConfirmModal isOpen={isFinalizeConfirmOpen} onClose={() => setIsFinalizeConfirmOpen(false)} onConfirm={handleFinalizeIncome} title="Финализировать приход" message="Клиент больше не будет доплачивать? Статус будет изменен на 'Завершено', а итоговая сумма прихода будет равна фактическим поступлениям." loading={loading} />
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
