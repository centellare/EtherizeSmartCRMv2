
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Toast } from '../../ui';
import { formatDate } from '../../../lib/dateUtils';
import { sumInWords } from '../../../lib/formatUtils';

interface InvoiceViewProps {
  invoiceId: string;
  onClose: () => void;
}

const InvoiceView: React.FC<InvoiceViewProps> = ({ invoiceId, onClose }) => {
  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Default hardcoded settings if DB is empty, ensuring Ratio Domus is default
  const defaultSettings = {
      company_name: 'ООО "РАЦИО ДОМУС"',
      requisites: 'Адрес: БЕЛАРУСЬ, Г. МИНСК, УЛ. Ф.СКОРИНЫ, ДОМ 14, ОФ. 117, 220076\nУНП: 193736741',
      bank_details: "Карт-счет: BY82ALFA30122E47040010270000 в BYN в ЗАО 'Альфа-Банк', БИК: ALFABY2X",
      logo_url: ''
  };

  const fetchData = async () => {
    setLoading(true);
    const { data: inv } = await supabase.from('invoices').select('*, client:clients(*), object:objects(name, address), creator:profiles(full_name)').eq('id', invoiceId).single();
    const { data: invItems } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId);
    const { data: set } = await supabase.from('company_settings').select('*').limit(1).maybeSingle();

    setInvoice(inv);
    setItems(invItems || []);
    
    if (set) {
        setSettings({
            company_name: set.company_name || defaultSettings.company_name,
            requisites: set.requisites || defaultSettings.requisites,
            bank_details: set.bank_details || defaultSettings.bank_details,
            logo_url: (set as any).logo_url || ''
        });
    } else {
        setSettings(defaultSettings);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [invoiceId]);

  const handleStatusChange = async (newStatus: string) => {
      setStatusLoading(true);
      try {
          await supabase.from('invoices').update({ status: newStatus }).eq('id', invoiceId);
          if ((newStatus === 'sent' || newStatus === 'paid') && invoice.status === 'draft') {
              for (const item of items) {
                  if (!item.product_id) continue;
                  const { data: available } = await supabase.from('inventory_items')
                      .select('id')
                      .eq('product_id', item.product_id)
                      .eq('status', 'in_stock')
                      .is('reserved_for_invoice_id', null)
                      .limit(item.quantity);
                  
                  if (available && available.length > 0) {
                      const ids = available.map(a => a.id);
                      await supabase.from('inventory_items').update({ status: 'reserved', reserved_for_invoice_id: invoiceId }).in('id', ids);
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
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>
                        @media print {
                            @page { margin: 0; size: A4; } /* Hides browser headers */
                            body { margin: 0; -webkit-print-color-adjust: exact; }
                            #invoice-printable {
                                margin: 0;
                                width: 100%;
                                padding: 15mm 20mm !important; /* Simulate document margin */
                                box-shadow: none !important;
                            }
                        }
                    </style>
                </head>
                <body>
                    ${content.outerHTML}
                    <script>setTimeout(()=>window.print(), 800)</script>
                </body>
            </html>
        `);
        win.document.close();
    }
  };

  if (loading) return <div className="p-10 text-center">Загрузка...</div>;
  if (!invoice) return <div className="p-10 text-center">Счет не найден</div>;

  const vatRate = invoice.has_vat ? 20 : 0;
  const tableItems = items.map(item => {
      const priceWithVat = item.price || 0; 
      const totalWithVat = item.total || 0;
      const priceNoVat = invoice.has_vat ? priceWithVat / 1.2 : priceWithVat;
      const totalNoVat = invoice.has_vat ? totalWithVat / 1.2 : totalWithVat;
      const totalVatSum = totalWithVat - totalNoVat;
      // Fixed: included priceWithVat in the return object
      return { ...item, priceWithVat, priceNoVat, totalNoVat, totalVatSum, totalWithVat };
  });

  const totalSum = invoice.total_amount || 0;
  const totalVatSum = tableItems.reduce((acc, i) => acc + i.totalVatSum, 0);
  const deliveryAddress = invoice.object?.address || 'Адрес не указан';
  const payerInfo = invoice.client?.requisites || invoice.client?.address || 'Реквизиты не заполнены';

  return (
    <div className="h-full flex flex-col bg-slate-50">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        
        <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm sticky top-0 z-50">
            <div className="flex items-center gap-4">
                <Button variant="secondary" icon="arrow_back" onClick={onClose}>Назад</Button>
                {invoice.status === 'draft' && (
                    <Button onClick={() => handleStatusChange('sent')} loading={statusLoading} className="bg-blue-600 hover:bg-blue-700 text-white" icon="send">Отправить и Зарезервировать</Button>
                )}
                {invoice.status === 'sent' && (
                    <Button onClick={() => handleStatusChange('paid')} loading={statusLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white" icon="check_circle">Отметить оплату</Button>
                )}
            </div>
            <Button icon="print" onClick={handlePrint}>Печать</Button>
        </div>

        <div className="flex-grow overflow-y-auto p-4 md:p-8 flex justify-center">
            <div id="invoice-printable" className="bg-white w-[210mm] min-h-[297mm] p-[10mm] shadow-lg text-black font-serif relative">
                
                {/* HEADER */}
                <div className="flex justify-between items-start mb-8">
                    {/* LOGO */}
                    <div className="w-[40%]">
                        {settings.logo_url ? (
                            <img src={settings.logo_url} alt="Logo" className="max-h-[80px] max-w-full object-contain" />
                        ) : (
                            <div className="border-2 border-blue-800 text-blue-800 font-bold text-2xl p-2 inline-block">
                                RATIO DOMUS
                                <span className="block text-[8px] font-normal tracking-widest uppercase">smart group</span>
                            </div>
                        )}
                    </div>
                    {/* REQUISITES - RIGHT ALIGNED */}
                    <div className="w-[55%] text-right text-[10px] leading-relaxed">
                        <h2 className="font-bold text-sm uppercase mb-2">{settings.company_name}</h2>
                        <p className="whitespace-pre-wrap">{settings.requisites}</p>
                        <p className="mt-1">{settings.bank_details}</p>
                    </div>
                </div>

                <div className="border-b-2 border-black mb-6"></div>

                {/* TITLE */}
                <div className="text-center mb-8">
                    <h1 className="text-xl font-bold uppercase">СЧЕТ-ПРОТОКОЛ</h1>
                    <p className="text-sm font-bold">согласования свободных отпускных цен</p>
                    <p className="text-sm font-bold mt-1">№ {invoice.number} от {formatDate(invoice.created_at)}</p>
                </div>

                {/* CUSTOMER INFO */}
                <div className="mb-6 text-[12px]">
                    <div className="grid grid-cols-[120px_1fr] gap-2">
                        <div className="font-bold">Покупатель:</div>
                        <div className="font-bold">{invoice.client?.name}</div>
                        
                        {invoice.client?.contact_person && (
                            <>
                                <div className="font-bold">Контактное лицо:</div>
                                <div>{invoice.client.contact_person}</div>
                            </>
                        )}
                        {invoice.client?.phone && (
                            <>
                                <div className="font-bold">Телефон:</div>
                                <div>{invoice.client.phone}</div>
                            </>
                        )}
                        {invoice.object && (
                            <>
                                <div className="font-bold">Объект:</div>
                                <div>{invoice.object.name}</div>
                            </>
                        )}
                    </div>
                </div>

                {/* TABLE */}
                <table className="w-full border-collapse border border-black text-[10px] mb-2">
                    <thead>
                        <tr className="text-center font-bold">
                            <th className="border border-black p-1">№ п/п</th>
                            <th className="border border-black p-1 w-[35%]">Предмет счета</th>
                            <th className="border border-black p-1">Ед. изм.</th>
                            <th className="border border-black p-1">Кол-во</th>
                            <th className="border border-black p-1">Цена единицы<br/>руб.</th>
                            <th className="border border-black p-1">Сумма, руб. без<br/>НДС</th>
                            <th className="border border-black p-1">НДС,%</th>
                            <th className="border border-black p-1">Сумма НДС,<br/>руб.</th>
                            <th className="border border-black p-1">Сумма с НДС,<br/>руб.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tableItems.map((item, idx) => (
                            <tr key={idx} className="align-top">
                                <td className="border border-black p-1 text-center">{idx + 1}</td>
                                <td className="border border-black p-1">{item.name}</td>
                                <td className="border border-black p-1 text-center">{item.unit}</td>
                                <td className="border border-black p-1 text-center">{item.quantity}</td>
                                <td className="border border-black p-1 text-right">{item.priceWithVat.toFixed(2)}</td>
                                <td className="border border-black p-1 text-right">{item.totalNoVat.toFixed(2)}</td>
                                <td className="border border-black p-1 text-center">{vatRate}</td>
                                <td className="border border-black p-1 text-right">{item.totalVatSum.toFixed(2)}</td>
                                <td className="border border-black p-1 text-right">{item.totalWithVat.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* TOTALS */}
                <div className="flex justify-end mb-4">
                    <div className="text-[11px] font-bold text-right">
                        <div className="border border-black p-1 px-2 inline-block min-w-[100px]">{totalSum.toFixed(2)}</div>
                    </div>
                </div>

                <div className="text-[11px] mb-6">
                    <p className="font-bold">Итог на сумму, белорусских рублей: {totalSum.toFixed(2)} <span className="font-normal">{sumInWords(totalSum)}</span></p>
                    <p className="font-bold mt-1">в том числе сумма НДС, белорусских рублей: {totalVatSum.toFixed(2)} <span className="font-normal">{sumInWords(totalVatSum)}</span></p>
                </div>

                {/* TERMS */}
                <div className="border border-black p-2 text-[9px] mb-6">
                    <ol className="list-decimal list-inside space-y-1">
                        <li>Поставщик обязуется поставить Покупателю, а Покупатель обязуется принять и оплатить товар, указанный в <b>Счет-Протоколе</b>.</li>
                        <li>Цель приобретения товара: Собственное потребление.</li>
                        <li>Оплата товара Покупателем осуществляется в белорусских рублях путем перечисления денежных средств на расчетный счет Поставщика в течение 3 (Трёх) рабочих дней с даты выставления счета в размере 100,00% стоимости товара на сумму {totalSum.toFixed(2)} руб.</li>
                        <li>Срок поставки товара: в течение 20 (двадцать) рабочих дней с момента получения Поставщиком предварительной оплаты товара в полном объеме. Отгрузка производится со склада поставщика по адресу г. Минск. При получении оборудования при себе иметь: доверенность, счет с подписью и печатью.</li>
                        <li>При отсутствии претензий по качеству Товара его приемка Покупателем оформляется путем подписания товарно-транспортной (товарной) накладной.</li>
                    </ol>
                </div>

                {/* SIGNATURES */}
                <div className="flex justify-between items-start text-[11px] mt-8">
                    <div className="w-[48%]">
                        <div className="font-bold mb-8 border-b-2 border-black pb-1">Поставщик:</div>
                        <div className="font-bold">{settings.company_name}</div>
                        <div className="mt-1 whitespace-pre-wrap">{settings.requisites}</div>
                        <div className="mt-1">Р/С {settings.bank_details.split('Карт-счет: ')[1] || settings.bank_details}</div>
                        <div className="mt-12 flex items-end">
                            <span>Поставщик</span>
                            <div className="flex-grow border-b border-black mx-2"></div>
                        </div>
                    </div>
                    
                    <div className="w-[48%]">
                        <div className="font-bold mb-8 border-b-2 border-black pb-1">Покупатель (Плательщик):</div>
                        <div className="font-bold mb-1">Адрес объекта: {deliveryAddress}</div>
                        <div className="text-[10px] text-gray-600 mb-2">Юр. адрес / Реквизиты: {payerInfo}</div>
                        
                        <div className="mt-8 flex items-end">
                            <span>Покупатель (Плательщик)</span>
                            <div className="flex-grow border-b border-black mx-2"></div>
                        </div>
                    </div>
                </div>

                {/* FOOTER DATES */}
                <div className="flex justify-between text-[10px] mt-16">
                    <div>Поставщик ____________________ {formatDate(invoice.created_at)}</div>
                    <div>Покупатель (Плательщик) ____________________ {formatDate(invoice.created_at)}</div>
                </div>

            </div>
        </div>
    </div>
  );
};

export default InvoiceView;
