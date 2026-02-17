
import React, { useEffect, useState, useMemo } from 'react';
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
  
  // Print Options
  const [showBundleDetails, setShowBundleDetails] = useState(false);

  // ULTRA SAFE HELPERS
  const toNum = (val: any): number => {
    if (val === null || val === undefined) return 0;
    const n = Number(val);
    return isNaN(n) ? 0 : n;
  };

  const toStr = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const defaultSettings = {
      company_name: 'ООО "РАЦИО ДОМУС"',
      requisites: 'Адрес: БЕЛАРУСЬ, Г. МИНСК, УЛ. Ф.СКОРИНЫ, ДОМ 14, ОФ. 117, 220076\nУНП: 193736741',
      bank_details: "Карт-счет: BY82ALFA30122E47040010270000 в BYN в ЗАО 'Альфа-Банк', БИК: ALFABY2X",
      logo_url: ''
  };

  const fetchData = async () => {
    setLoading(true);
    try {
        const { data: inv, error: invError } = await supabase.from('invoices').select('*, client:clients(*), object:objects(name, address), creator:profiles(full_name)').eq('id', invoiceId).single();
        if (invError) throw invError;
        
        const { data: invItems, error: itemsError } = await supabase.from('invoice_items').select('*, product:products(has_serial, base_price, type)').eq('invoice_id', invoiceId).order('id');
        if (itemsError) throw itemsError;

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
    } catch (e: any) {
        console.error("Error fetching invoice:", e);
        setToast({ message: "Ошибка загрузки: " + e.message, type: 'error' });
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [invoiceId]);

  // MOVED UP: Calculations inside useMemo must be unconditional
  const hasVat = invoice?.has_vat ?? false;

  const tableItems = useMemo(() => {
      if (!items || items.length === 0) return [];

      const roots = items.filter(i => !i.parent_id);
      const childrenMap: Record<string, any[]> = {};
      
      items.forEach(i => {
          if (i.parent_id) {
              if (!childrenMap[i.parent_id]) childrenMap[i.parent_id] = [];
              childrenMap[i.parent_id].push(i);
          }
      });

      const result: any[] = [];
      
      roots.forEach((root, idx) => {
          const rootNum = (idx + 1).toString();
          const priceWithVat = toNum(root.price); 
          const totalWithVat = toNum(root.total);
          const priceNoVat = hasVat ? priceWithVat / 1.2 : priceWithVat;
          const totalNoVat = hasVat ? totalWithVat / 1.2 : totalWithVat;
          const totalVatSum = totalWithVat - totalNoVat;

          result.push({
              id: root.id,
              uniqueKey: `root-${root.id}-${idx}`,
              name: root.name,
              product_id: root.product_id,
              unit: root.unit,
              quantity: toNum(root.quantity),
              displayNumber: rootNum,
              priceWithVat, priceNoVat, totalNoVat, totalVatSum, totalWithVat,
              isChild: false
          });

          if (showBundleDetails && childrenMap[root.id]) {
              childrenMap[root.id].forEach((child, cIdx) => {
                  const childNum = `${rootNum}.${cIdx + 1}`;
                  const cPriceWithVat = toNum(child.price); 
                  const cTotalWithVat = toNum(child.total);
                  const cPriceNoVat = hasVat ? cPriceWithVat / 1.2 : cPriceWithVat;
                  const cTotalNoVat = hasVat ? cTotalWithVat / 1.2 : cTotalWithVat;
                  const cTotalVatSum = cTotalWithVat - cTotalNoVat;

                  result.push({
                      id: child.id,
                      uniqueKey: `child-${child.id}-${cIdx}`,
                      name: child.name,
                      product_id: child.product_id,
                      unit: child.unit,
                      quantity: toNum(child.quantity),
                      displayNumber: childNum,
                      priceWithVat: cPriceWithVat,
                      priceNoVat: cPriceNoVat,
                      totalNoVat: cTotalNoVat,
                      totalVatSum: cTotalVatSum,
                      totalWithVat: cTotalWithVat,
                      isChild: true
                  });
              });
          }
      });

      return result;
  }, [items, showBundleDetails, hasVat]);

  const handleStatusChange = async (newStatus: string) => {
      setStatusLoading(true);
      try {
          await supabase.from('invoices').update({ status: newStatus }).eq('id', invoiceId);
          if ((newStatus === 'sent' || newStatus === 'paid') && invoice.status === 'draft') {
              setToast({ message: 'Статус счета обновлен (авто-резерв)', type: 'success' });
          } else {
              setToast({ message: 'Статус счета обновлен', type: 'success' });
          }
          fetchData();
      } catch (e: any) {
          console.error(e);
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
                            @page { margin: 0; size: A4; }
                            body { margin: 0; -webkit-print-color-adjust: exact; }
                            #invoice-printable {
                                margin: 0;
                                width: 100%;
                                padding: 15mm 20mm !important;
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

  // --- RENDER BLOCK STARTS HERE ---

  if (loading) return <div className="p-10 text-center">Загрузка...</div>;
  if (!invoice) return <div className="p-10 text-center">Счет не найден</div>;

  const vatRate = hasVat ? 20 : 0;
  const totalSum = toNum(invoice.total_amount);
  const calculatedTotalVat = hasVat ? totalSum - (totalSum / 1.2) : 0;

  // Safe strings
  const clientName = toStr(invoice.client?.name);
  const objectName = toStr(invoice.object?.name);
  const companyName = toStr(settings?.company_name);
  const companyReqs = toStr(settings?.requisites);
  const companyBank = toStr(settings?.bank_details);

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
            <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={showBundleDetails} onChange={e => setShowBundleDetails(e.target.checked)} className="rounded text-blue-600" />
                    Раскрыть комплекты
                </label>
                <Button icon="print" onClick={handlePrint}>Печать</Button>
            </div>
        </div>

        <div className="flex-grow overflow-y-auto p-4 md:p-8 flex justify-center">
            <div id="invoice-printable" className="bg-white w-[210mm] min-h-[297mm] p-[10mm] shadow-lg text-black font-serif relative">
                
                {/* HEADER */}
                <div className="flex justify-between items-start mb-8">
                    <div className="w-[40%]">
                        {settings?.logo_url ? (
                            <img src={settings.logo_url} alt="Logo" className="max-h-[80px] max-w-full object-contain" />
                        ) : (
                            <div className="border-2 border-blue-800 text-blue-800 font-bold text-2xl p-2 inline-block">
                                RATIO DOMUS
                                <span className="block text-[8px] font-normal tracking-widest uppercase">smart group</span>
                            </div>
                        )}
                    </div>
                    <div className="w-[55%] text-right text-[10px] leading-relaxed">
                        <h2 className="font-bold text-sm uppercase mb-2">{companyName}</h2>
                        <p className="whitespace-pre-wrap">{companyReqs}</p>
                        <p className="mt-1">{companyBank}</p>
                    </div>
                </div>

                <div className="border-b-2 border-black mb-6"></div>

                <div className="text-center mb-8">
                    <h1 className="text-xl font-bold uppercase">СЧЕТ-ПРОТОКОЛ</h1>
                    <p className="text-sm font-bold">согласования свободных отпускных цен</p>
                    <p className="text-sm font-bold mt-1">№ {toStr(invoice.number)} от {formatDate(invoice.created_at)}</p>
                </div>

                <div className="mb-6 text-[12px]">
                    <div className="grid grid-cols-[120px_1fr] gap-2">
                        <div className="font-bold">Покупатель:</div>
                        <div className="font-bold">{clientName}</div>
                        {invoice.object && (
                            <>
                                <div className="font-bold">Объект:</div>
                                <div>{objectName}</div>
                            </>
                        )}
                    </div>
                </div>

                <table className="w-full border-collapse border border-black text-[10px] mb-2">
                    <thead>
                        <tr className="text-center font-bold">
                            <th className="border border-black p-1">№</th>
                            <th className="border border-black p-1 w-[35%]">Предмет счета</th>
                            <th className="border border-black p-1">Ед.</th>
                            <th className="border border-black p-1">Кол-во</th>
                            <th className="border border-black p-1">Цена (без НДС)</th>
                            <th className="border border-black p-1">Сумма (без НДС)</th>
                            <th className="border border-black p-1">НДС,%</th>
                            <th className="border border-black p-1">Сумма НДС</th>
                            <th className="border border-black p-1">Сумма с НДС</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tableItems.map((item) => (
                            <tr key={item.uniqueKey} className="align-top">
                                <td className="border border-black p-1 text-center">
                                    {toStr(item.displayNumber)}
                                </td>
                                <td className="border border-black p-1">
                                    <div className={item.isChild ? 'pl-4' : ''}>
                                        {toStr(item.name)}
                                        {!item.product_id && !showBundleDetails && (
                                            <span className="block text-[8px] italic mt-0.5">(Комплект оборудования)</span>
                                        )}
                                    </div>
                                </td>
                                <td className="border border-black p-1 text-center">{toStr(item.unit)}</td>
                                <td className="border border-black p-1 text-center">{item.quantity}</td>
                                <td className="border border-black p-1 text-right">{item.priceNoVat.toFixed(2)}</td>
                                <td className="border border-black p-1 text-right">{item.totalNoVat.toFixed(2)}</td>
                                <td className="border border-black p-1 text-center">{vatRate}</td>
                                <td className="border border-black p-1 text-right">{item.totalVatSum.toFixed(2)}</td>
                                <td className="border border-black p-1 text-right">{item.totalWithVat.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="flex justify-end mb-4">
                    <div className="text-[11px] font-bold text-right">
                        <div className="border border-black p-1 px-2 inline-block min-w-[100px]">{totalSum.toFixed(2)}</div>
                    </div>
                </div>

                <div className="text-[11px] mb-6">
                    <p className="font-bold">Итог на сумму, белорусских рублей: {totalSum.toFixed(2)} <span className="font-normal">{sumInWords(totalSum)}</span></p>
                    <p className="font-bold mt-1">в том числе сумма НДС: {calculatedTotalVat.toFixed(2)} <span className="font-normal">{sumInWords(calculatedTotalVat)}</span></p>
                </div>

                {/* TERMS (Static for now) */}
                <div className="border border-black p-2 text-[9px] mb-6">
                    <ol className="list-decimal list-inside space-y-1">
                        <li>Поставщик обязуется поставить Покупателю, а Покупатель обязуется принять и оплатить товар.</li>
                        <li>Оплата 100% в течение 3 рабочих дней.</li>
                        <li>Срок поставки до 20 рабочих дней.</li>
                    </ol>
                </div>

                {/* SIGNATURES */}
                <div className="flex justify-between items-start text-[11px] mt-12">
                    <div className="w-[48%]">
                        <div className="font-bold mb-4">Поставщик: {companyName}</div>
                        <div className="flex items-end gap-2">
                            <span>Руководитель</span>
                            <div className="flex-grow border-b border-black"></div>
                            <span>/ ФИО /</span>
                        </div>
                    </div>
                    <div className="w-[48%]">
                        <div className="font-bold mb-4">Покупатель: {clientName}</div>
                        <div className="flex items-end gap-2">
                            <span>Подпись</span>
                            <div className="flex-grow border-b border-black"></div>
                            <span>/ ФИО /</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default InvoiceView;
