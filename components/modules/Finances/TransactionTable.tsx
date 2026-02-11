
import React from 'react';
import { Badge } from '../../ui';
import { formatDate } from '../../../lib/dateUtils';

interface TransactionTableProps {
  transactions: any[];
  expandedRows: Set<string>;
  toggleExpand: (id: string) => void;
  formatCurrency: (val: number) => string;
  onRowClick: (t: any) => void;
  onPaymentClick: (payment: any, t: any) => void;
  onAddPayment: (t: any) => void;
  onApprove: (t: any) => void;
  onReject: (t: any) => void;
  onFinalize: (t: any) => void;
  isSpecialist: boolean;
  canApprove: boolean;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  expandedRows,
  toggleExpand,
  formatCurrency,
  onRowClick,
  onPaymentClick,
  onAddPayment,
  onApprove,
  onReject,
  onFinalize,
  isSpecialist,
  canApprove
}) => {
  
  const getTransactionDocStatus = (t: any) => {
    const p = t.payments || [];
    if (p.length === 0) return 'none';
    const docsRequired = p.filter((pay: any) => pay.requires_doc);
    if (docsRequired.length === 0) return 'none';
    const allIn = docsRequired.every((pay: any) => !!pay.doc_number);
    return allIn ? 'complete' : 'missing';
  };

  return (
    <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-left min-w-[900px]">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-4 w-10"></th>
              <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Тип / Дата</th>
              <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Объект / Описание</th>
              <th className="p-5 text-[10px] font-bold text-slate-400 uppercase w-10 text-center">Файл</th>
              <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Сумма</th>
              <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Факт</th>
              <th className="p-5 text-[10px] font-bold text-slate-400 uppercase">Статус</th>
              <th className="p-5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-20 text-center">
                  <div className="flex flex-col items-center opacity-30">
                    <span className="material-icons-round text-6xl mb-4">payments</span>
                    <p className="text-lg font-medium italic">Финансовые операции не найдены</p>
                  </div>
                </td>
              </tr>
            ) : (
              transactions.map(t => {
                const docStatus = getTransactionDocStatus(t);
                return (
                  <React.Fragment key={t.id}>
                    <tr className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4 text-center">
                        {docStatus === 'missing' && <span className="material-icons-round text-red-500 text-lg animate-pulse" title="Требуется документ">warning</span>}
                        {docStatus === 'complete' && <span className="material-icons-round text-emerald-500 text-lg" title="Документы в порядке">description</span>}
                        {docStatus === 'none' && <span className="material-icons-round text-slate-200 text-lg">description</span>}
                      </td>
                      <td className="p-5">
                        <Badge color={t.type === 'income' ? 'emerald' : 'red'}>{t.type === 'income' ? 'ПРИХОД' : 'РАСХОД'}</Badge>
                        <p className="text-[10px] text-slate-400 font-bold mt-1">{formatDate(t.created_at)}</p>
                      </td>
                      <td className="p-5 cursor-pointer" onClick={() => onRowClick(t)}>
                        <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{t.objects?.name || '—'}</p>
                        <p className="text-xs text-slate-500 line-clamp-1">{t.description || t.category}</p>
                      </td>
                      <td className="p-5 text-center">
                        {t.doc_link && <a href={t.doc_link} target="_blank" onClick={(e) => e.stopPropagation()} className="text-blue-500 hover:text-blue-700"><span className="material-icons-round">attach_file</span></a>}
                      </td>
                      <td className="p-5 font-bold">{formatCurrency(t.type === 'expense' ? (t.requested_amount || t.amount) : t.amount)}</td>
                      <td className="p-5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{formatCurrency(t.type === 'income' ? (t.fact_amount || 0) : (t.status === 'approved' ? t.amount : 0))}</span>
                          {t.type === 'income' && (
                            <button onClick={(e) => { e.stopPropagation(); toggleExpand(t.id); }} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${expandedRows.has(t.id) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                              <span className="material-icons-round text-sm">{expandedRows.has(t.id) ? 'expand_less' : 'history'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-5">
                        <Badge color={t.status === 'approved' ? 'emerald' : t.status === 'partial' ? 'blue' : t.status === 'rejected' ? 'red' : 'amber'}>
                          {t.status === 'partial' && <span className="material-icons-round text-[10px] mr-1">incomplete_circle</span>}
                          {t.status?.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-5 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {t.type === 'income' && t.status !== 'approved' && !isSpecialist && (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); onAddPayment(t); }} className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-all" title="Внести оплату"><span className="material-icons-round text-sm">add_card</span></button>
                              {t.status === 'partial' && (
                                <button onClick={(e) => { e.stopPropagation(); onFinalize(t); }} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all" title="Завершить"><span className="material-icons-round text-sm">done_all</span></button>
                              )}
                            </>
                          )}
                          {t.type === 'expense' && t.status === 'pending' && canApprove && (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); onApprove(t); }} className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-all" title="Утвердить"><span className="material-icons-round text-sm">check</span></button>
                              <button onClick={(e) => { e.stopPropagation(); onReject(t); }} className="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all" title="Отклонить"><span className="material-icons-round text-sm">close</span></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedRows.has(t.id) && t.payments && t.payments.length > 0 && (
                      <tr className="bg-slate-50/50 animate-in slide-in-from-top-1 duration-200">
                        <td colSpan={8} className="p-0">
                          <div className="px-10 py-4 border-l-4 border-blue-500 ml-5 my-2 bg-white rounded-xl shadow-inner">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest">История платежей</p>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-slate-400 border-b border-slate-100">
                                  <th className="pb-2 text-left font-medium">Дата</th>
                                  <th className="pb-2 text-left font-medium">Сумма</th>
                                  <th className="pb-2 text-left font-medium">Документ</th>
                                  <th className="pb-2 text-left font-medium">Автор</th>
                                  <th className="pb-2 text-left font-medium">Комментарий</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {t.payments.map((p: any) => (
                                  <tr key={p.id} onClick={(e) => { e.stopPropagation(); onPaymentClick(p, t); }} className="cursor-pointer hover:bg-blue-50/50 transition-colors">
                                    <td className="py-2">{formatDate(p.payment_date)}</td>
                                    <td className="py-2 font-bold text-emerald-600">{formatCurrency(p.amount)}</td>
                                    <td className="py-2">
                                      {p.requires_doc ? (
                                        p.doc_number ? (
                                          <span className="text-emerald-600 font-bold flex items-center gap-1"><span className="material-icons-round text-[10px]">description</span> {p.doc_type} №{p.doc_number}</span>
                                        ) : (
                                          <span className="text-red-500 font-bold flex items-center gap-1"><span className="material-icons-round text-[10px]">warning</span> Ожидается</span>
                                        )
                                      ) : (
                                        <span className="text-slate-400">Не требуется</span>
                                      )}
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
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
