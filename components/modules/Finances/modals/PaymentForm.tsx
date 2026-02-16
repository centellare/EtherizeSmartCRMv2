
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Button, Input, Select } from '../../../ui';
import { formatDate, getMinskISODate } from '../../../../lib/dateUtils';

interface PaymentFormProps {
  transaction: any;
  payment?: any; // If editing
  profile: any;
  onSuccess: () => void;
  onDelete?: (id: string) => void; // Available only in edit mode
}

const DOC_TYPES = [
  { value: 'Акт', label: 'Акт' },
  { value: 'ТН', label: 'ТН' },
  { value: 'ТТН', label: 'ТТН' }
];

export const PaymentForm: React.FC<PaymentFormProps> = ({ transaction, payment, profile, onSuccess, onDelete }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
      amount: '',
      payment_date: getMinskISODate(),
      comment: '',
      requires_doc: false,
      doc_type: 'Акт',
      doc_number: '',
      doc_date: ''
  });

  const isEdit = !!payment;

  useEffect(() => {
      if (isEdit && payment) {
          setFormData({
              amount: payment.amount.toString(),
              payment_date: payment.payment_date ? getMinskISODate(payment.payment_date) : getMinskISODate(),
              comment: payment.comment || '',
              requires_doc: payment.requires_doc || false,
              doc_type: payment.doc_type || 'Акт',
              doc_number: payment.doc_number || '',
              doc_date: payment.doc_date || ''
          });
      } else if (transaction) {
          // Default amount = remaining balance
          const remaining = Math.max(0, transaction.amount - (transaction.fact_amount || 0));
          setFormData(prev => ({
              ...prev,
              amount: remaining > 0 ? remaining.toFixed(2) : ''
          }));
      }
  }, [transaction, payment, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const amt = parseFloat(formData.amount);
    
    if (isNaN(amt) || amt < 0) {
        alert("Некорректная сумма");
        setLoading(false);
        return;
    }

    try {
        const payload = {
            amount: amt,
            payment_date: formData.payment_date ? new Date(formData.payment_date).toISOString() : new Date().toISOString(),
            comment: formData.comment,
            requires_doc: formData.requires_doc,
            doc_type: formData.requires_doc ? formData.doc_type : null,
            doc_number: formData.requires_doc ? formData.doc_number : null,
            doc_date: (formData.requires_doc && formData.doc_date) ? formData.doc_date : null
        };

        if (isEdit) {
            const { error } = await supabase.from('transaction_payments').update(payload).eq('id', payment.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('transaction_payments').insert([{
                transaction_id: transaction.id,
                created_by: profile.id,
                ...payload
            }]);
            if (error) throw error;
        }

        // Recalculate transaction status/fact
        if (!isEdit) {
             const newFact = (transaction.fact_amount || 0) + amt;
             const status = newFact >= transaction.amount - 0.01 ? 'approved' : 'partial';
             await supabase.from('transactions').update({ status, fact_amount: newFact }).eq('id', transaction.id);
        }

        onSuccess();
    } catch (err: any) {
        alert('Ошибка: ' + err.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            {/* Amount Field */}
            {!isEdit ? (
                <div className="relative group">
                    <Input label="Сумма оплаты" type="number" step="0.01" required value={formData.amount} onChange={(e:any) => setFormData({...formData, amount: e.target.value})} icon="account_balance_wallet" />
                    <button 
                        type="button" 
                        onClick={() => setFormData({...formData, amount: (transaction.amount - (transaction.fact_amount || 0)).toFixed(2)})}
                        className="absolute right-3 top-[32px] px-2 py-1 bg-blue-50 text-blue-600 text-[9px] font-bold rounded border border-blue-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                        title="Вставить остаток долга"
                    >
                        ОСТАТОК
                    </button>
                </div>
            ) : (
                 <div className="bg-white p-2 px-4 rounded-xl border border-slate-100 flex flex-col justify-center">
                     <p className="text-[10px] font-bold text-slate-400 uppercase">Сумма</p>
                     <p className="text-xl font-bold text-emerald-600">{formData.amount} BYN</p>
                 </div>
            )}

            {/* Date Field */}
            <Input 
                label="Дата платежа" 
                type="date" 
                required 
                value={formData.payment_date} 
                onChange={(e:any) => setFormData({...formData, payment_date: e.target.value})} 
                icon="calendar_today" 
            />
        </div>

        <Input label="Комментарий" value={formData.comment} onChange={(e:any) => setFormData({...formData, comment: e.target.value})} icon="comment" />
        
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer group">
            <input 
                type="checkbox" 
                checked={formData.requires_doc} 
                onChange={(e) => setFormData({...formData, requires_doc: e.target.checked})}
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-sm font-bold text-slate-700 uppercase tracking-tight group-hover:text-blue-600 transition-colors">Требуется закрывающий документ</span>
            </label>

            {formData.requires_doc && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <Select 
                label="Тип документа" 
                value={formData.doc_type} 
                onChange={(e:any) => setFormData({...formData, doc_type: e.target.value})}
                options={DOC_TYPES}
                icon="description"
                />
                <div className="grid grid-cols-2 gap-4">
                <Input label="Номер документа" value={formData.doc_number} onChange={(e:any) => setFormData({...formData, doc_number: e.target.value})} icon="tag" placeholder="Напр: 123-А" />
                <Input label="Дата документа" type="date" value={formData.doc_date} onChange={(e:any) => setFormData({...formData, doc_date: e.target.value})} icon="event" />
                </div>
            </div>
            )}
        </div>

        <div className="flex gap-2 pt-2">
            <Button type="submit" className="w-full h-12" loading={loading} icon={isEdit ? "save" : "check"}>{isEdit ? "Сохранить" : "Подтвердить платеж"}</Button>
            {isEdit && onDelete && (
                <Button type="button" variant="danger" className="w-12 h-12 !px-0" onClick={() => onDelete(payment.id)} icon="delete"></Button>
            )}
        </div>
    </form>
  );
};
