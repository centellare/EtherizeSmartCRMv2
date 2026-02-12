
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Toast } from '../../ui';
import { formatDate } from '../../../lib/dateUtils';

interface InvoiceViewProps {
  invoiceId: string;
  onClose: () => void;
}

const InvoiceView: React.FC<InvoiceViewProps> = ({ invoiceId, onClose }) => {
  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data: inv } = await supabase.from('invoices').select('*, client:clients(*), creator:profiles(full_name)').eq('id', invoiceId).single();
    const { data: invItems } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId);
    const { data: set } = await supabase.from('company_settings').select('*').limit(1).maybeSingle();
    const { data: tpl } = await supabase.from('document_templates').select('*').eq('type', 'invoice').limit(1).maybeSingle();

    setInvoice(inv);
    setItems(invItems || []);
    setSettings(set || { company_name: 'Моя Компания', requisites: '', bank_details: '' });
    setTemplate(tpl || { header_text: '', footer_text: '', signatory_1: 'Руководитель', signatory_2: 'Бухгалтер' });
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [invoiceId]);

  const handleStatusChange = async (newStatus: string) => {
      setStatusLoading(true);
      try {
          // 1. Update Invoice Status
          await supabase.from('invoices').update({ status: newStatus }).eq('id', invoiceId);
          
          // 2. Reservation Logic (If sent/paid and was draft)
          if ((newStatus === 'sent' || newStatus === 'paid') && invoice.status === 'draft') {
              // Trigger reservation logic
              // Loop through invoice items and try to find free 'in_stock' items to reserve
              for (const item of items) {
                  if (!item.product_id) continue;
                  
                  // Find available items
                  const { data: available } = await supabase.from('inventory_items')
                      .select('id')
                      .eq('product_id', item.product_id)
                      .eq('status', 'in_stock')
                      .is('reserved_for_invoice_id', null)
                      .is('deleted_at', null)
                      .limit(item.quantity); // Grab only needed amount
                  
                  if (available && available.length > 0) {
                      const ids = available.map(a => a.id);
                      // Update them to Reserved
                      await supabase.from('inventory_items')
                          .update({ 
                              status: 'reserved', 
                              reserved_for_invoice_id: invoiceId 
                          })
                          .in('id', ids);
                  }
              }
              setToast({ message: 'Счет отправлен. Товар зарезервирован.', type: 'success' });
          } else {
              setToast({ message: 'Статус счета обновлен', type: 'success' });
          }

          fetchData();
      } catch (e: any) {
          setToast({ message: 'Ошибка: ' + e.message, type: 'error' });
      } finally {
          setStatusLoading(false);
      }
  };

  const handlePrint = () => {
    const content = document.getElementById('invoice-printable');
    if (!content) return;
    const win = window.open('', '_blank');
    if (win) {
        win.document.write(`
            <html>
                <head>
                    <title>Счет №${invoice?.number}</title>
                    <style>
                        body { font-family: sans-serif; padding: 40px; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid black; padding: 5px; }
                        .no-border td { border: none; }
                    </style>
                </head>
                <body>
                    ${content.innerHTML}
                    <script>setTimeout(()=>window.print(), 800)</script>
                </body>
            </html>
        `);
        win.document.close();
    }
  };

  if (loading) return <div className="p-10 text-center">Загрузка...</div>;
  if (!invoice) return <div className="p-10 text-center">Счет не найден</div>;

  return (
    <div className="h-full flex flex-col bg-slate-50">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        
        <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm sticky top-0 z-50">
            <div className="flex items-center gap-4">
                <Button variant="secondary" icon="arrow_back" onClick={onClose}>Назад</Button>
                {invoice.status === 'draft' && (
                    <Button 
                        onClick={() => handleStatusChange('sent')} 
                        loading={statusLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        icon="send"
                    >
                        Отправить и Зарезервировать
                    </Button>
                )}
                {invoice.status === 'sent' && (
                    <Button 
                        onClick={() => handleStatusChange('paid')} 
                        loading={statusLoading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        icon="check_circle"
                    >
                        Отметить оплату
                    </Button>
                )}
            </div>
            <Button icon="print" onClick={handlePrint}>Печать</Button>
        </div>

        <div className="flex-grow overflow-y-auto p-8">
            <div id="invoice-printable" className="bg-white max-w-[210mm] mx-auto p-[15mm] shadow-lg text-black text-sm relative">
                {/* Status Stamp */}
                {invoice.status !== 'draft' && (
                    <div className={`absolute top-10 right-10 border-4 ${invoice.status === 'paid' ? 'border-emerald-600 text-emerald-600' : 'border-blue-600 text-blue-600'} rounded-xl px-4 py-2 font-bold text-2xl uppercase opacity-80 transform rotate-12 pointer-events-none`}>
                        {invoice.status === 'sent' ? 'ОТПРАВЛЕН' : invoice.status === 'paid' ? 'ОПЛАЧЕН' : invoice.status}
                    </div>
                )}

                {/* Bank Header */}
                <table className="w-full mb-6 border border-black collapse">
                    <tbody>
                        <tr>
                            <td colSpan={2} rowSpan={2} className="border border-black p-2 w-1/2 align-top">
                                <div className="text-xs mb-1">{settings.bank_details}</div>
                                <div className="font-bold text-xs">Банк получателя</div>
                            </td>
                            <td className="border border-black p-2 w-[10%] text-xs">БИК</td>
                            <td className="border border-black p-2 w-[40%]">-</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2 text-xs">Сч. №</td>
                            <td className="border border-black p-2">-</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2 text-xs">ИНН -</td>
                            <td className="border border-black p-2 text-xs">КПП -</td>
                            <td rowSpan={2} className="border border-black p-2 align-middle text-xs">Сч. №</td>
                            <td rowSpan={2} className="border border-black p-2 align-middle">-</td>
                        </tr>
                        <tr>
                            <td colSpan={2} className="border border-black p-2">
                                <div className="font-bold text-sm">{settings.company_name}</div>
                                <div className="text-xs">Получатель</div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <h1 className="text-xl font-bold border-b-2 border-black pb-2 mb-4">
                    Счет на оплату № {invoice.number} от {formatDate(invoice.created_at)}
                </h1>

                <div className="mb-6 space-y-4">
                    <div className="flex">
                        <span className="w-24 text-xs">Поставщик:</span>
                        <span className="font-bold text-sm">{settings.company_name}, {settings.requisites}</span>
                    </div>
                    <div className="flex">
                        <span className="w-24 text-xs">Покупатель:</span>
                        <span className="font-bold text-sm">{invoice.client?.name}, {invoice.client?.requisites}</span>
                    </div>
                </div>

                {/* Items Table */}
                <table className="w-full mb-4 border-collapse text-xs">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-black p-1 w-8">№</th>
                            <th className="border border-black p-1">Товары (работы, услуги)</th>
                            <th className="border border-black p-1 w-10">Кол-во</th>
                            <th className="border border-black p-1 w-10">Ед.</th>
                            <th className="border border-black p-1 w-20">Цена</th>
                            <th className="border border-black p-1 w-20">Сумма</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => (
                            <tr key={item.id}>
                                <td className="border border-black p-1 text-center">{idx + 1}</td>
                                <td className="border border-black p-1">{item.name}</td>
                                <td className="border border-black p-1 text-center">{item.quantity}</td>
                                <td className="border border-black p-1 text-center">{item.unit}</td>
                                <td className="border border-black p-1 text-right">{item.price.toFixed(2)}</td>
                                <td className="border border-black p-1 text-right">{item.total.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="flex justify-end mb-6">
                    <div className="w-48 text-right font-bold text-sm">
                        <div className="flex justify-between mb-1"><span>Итого:</span><span>{invoice.total_amount.toFixed(2)}</span></div>
                        {invoice.has_vat ? (
                            <div className="flex justify-between mb-1"><span>В т.ч. НДС (20%):</span><span>{(invoice.total_amount * 0.2 / 1.2).toFixed(2)}</span></div>
                        ) : (
                            <div className="text-xs mb-1">Без НДС</div>
                        )}
                        <div className="flex justify-between border-t border-black pt-1 mt-1 text-base"><span>Всего к оплате:</span><span>{invoice.total_amount.toFixed(2)}</span></div>
                    </div>
                </div>

                <div className="mb-8 text-xs">
                    {template.header_text}
                </div>

                <div className="border-t-2 border-black pt-4 flex justify-between mt-12">
                    <div className="w-[45%] flex items-end gap-2">
                        <span className="font-bold text-xs">{template.signatory_1}</span>
                        <div className="flex-grow border-b border-black mb-1"></div>
                        <span className="text-xs italic">({invoice.creator?.full_name?.split(' ')[0] || 'Иванов И.И.'})</span>
                    </div>
                    <div className="w-[45%] flex items-end gap-2">
                        <span className="font-bold text-xs">{template.signatory_2}</span>
                        <div className="flex-grow border-b border-black mb-1"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default InvoiceView;
