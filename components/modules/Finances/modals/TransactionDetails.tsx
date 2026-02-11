
import React from 'react';
import { Badge, Button } from '../../../ui';
import { formatDate } from '../../../../lib/dateUtils';

interface TransactionDetailsProps {
  transaction: any;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  canManage: boolean;
}

const formatBYN = (val: number) => 
    new Intl.NumberFormat('ru-BY', { style: 'currency', currency: 'BYN', maximumFractionDigits: 2 }).format(val);

const DetailItem = ({ label, val, icon }: any) => (
  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
    <span className="material-icons-round text-slate-400 text-lg">{icon}</span>
    <div className="min-w-0 flex-grow">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{label}</p>
      <p className="text-sm text-slate-700 font-medium truncate">{val || '—'}</p>
    </div>
  </div>
);

export const TransactionDetails: React.FC<TransactionDetailsProps> = ({ transaction, onEdit, onDelete, onClose, canManage }) => {
  if (!transaction) return null;

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-start">
            <div>
            <Badge color={transaction.type === 'income' ? 'emerald' : 'red'}>{transaction.type === 'income' ? 'ПРИХОД' : 'РАСХОД'}</Badge>
            <h3 className="text-2xl font-bold mt-2">{transaction.category}</h3>
            </div>
            <div className="flex flex-col items-end gap-3">
            {canManage && (
                <div className="flex gap-1">
                <button 
                    onClick={onEdit}
                    className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all shadow-sm"
                    title="Редактировать"
                >
                    <span className="material-icons-round text-sm">edit</span>
                </button>
                <button 
                    onClick={onDelete}
                    className="w-9 h-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all shadow-sm"
                    title="Удалить"
                >
                    <span className="material-icons-round text-sm">delete</span>
                </button>
                </div>
            )}
            <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Статус</p>
                <Badge color={transaction.status === 'approved' ? 'emerald' : transaction.status === 'partial' ? 'blue' : transaction.status === 'rejected' ? 'red' : 'amber'}>{transaction.status?.toUpperCase()}</Badge>
            </div>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4 bg-white p-5 rounded-3xl border border-slate-100">
            <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Сумма запроса</p><p className="text-lg font-bold">{formatBYN(transaction.requested_amount || transaction.amount)}</p></div>
            <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Фактически</p><p className="text-lg font-bold text-emerald-600">{formatBYN(transaction.fact_amount || (transaction.status === 'approved' ? transaction.amount : 0))}</p></div>
        </div>

        <div className="space-y-4">
            <DetailItem label="Объект" val={transaction.objects?.name} icon="business" />
            <DetailItem label="Создал" val={transaction.created_by_name} icon="person" />
            {transaction.planned_date && <DetailItem label="Планируемая дата" val={formatDate(transaction.planned_date)} icon="event" />}
            {transaction.description && <DetailItem label="Описание" val={transaction.description} icon="notes" />}
            {transaction.doc_link && (
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <span className="material-icons-round text-blue-600">attach_file</span>
                <a href={transaction.doc_link} target="_blank" rel="noreferrer" className="text-sm font-bold text-blue-700 underline truncate">{transaction.doc_name || 'Прикрепленный документ'}</a>
            </div>
            )}
        </div>

        <Button variant="tonal" className="w-full" onClick={onClose}>Закрыть</Button>
    </div>
  );
};
