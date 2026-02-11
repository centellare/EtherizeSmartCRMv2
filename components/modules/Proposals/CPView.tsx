
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../ui';
import { formatDate } from '../../../lib/dateUtils';

interface CPViewProps {
  proposalId: string;
  onClose: () => void;
}

const CPView: React.FC<CPViewProps> = ({ proposalId, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCP = async () => {
      setLoading(true);
      
      // Fetch Header
      const { data: cp, error: cpError } = await supabase
        .from('commercial_proposals')
        .select('*, client:clients(name), creator:profiles(full_name)')
        .eq('id', proposalId)
        .single();
      
      if (cpError) {
        console.error("Error fetching CP header:", cpError);
      }

      // Fetch Items
      const { data: cpItems, error: itemsError } = await supabase
        .from('cp_items')
        .select('*')
        .eq('cp_id', proposalId);

      if (itemsError) {
        console.error("Error fetching CP items:", itemsError);
      }

      setData(cp);
      setItems(cpItems || []);
      setLoading(false);
    };
    fetchCP();
  }, [proposalId]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, any[]> = {};
    items.forEach(item => {
      const category = item.snapshot_global_category || 'Прочее';
      if (!groups[category]) groups[category] = [];
      groups[category].push(item);
    });
    return Object.keys(groups).sort().reduce((obj: Record<string, any[]>, key) => {
      obj[key] = groups[key];
      return obj;
    }, {} as Record<string, any[]>);
  }, [items]);

  const handlePrint = () => {
    const content = document.getElementById('cp-printable-area');
    if (!content) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Генерируем HTML для печати
    const htmlContent = content.outerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Коммерческое предложение ${data?.number ? `№${data.number}` : ''}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
          <style>
            body { 
              font-family: 'Roboto', sans-serif; 
              margin: 0; 
              padding: 0; 
              background-color: white;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            @page {
              size: A4;
              margin: 10mm; 
            }
            /* Сброс стилей контейнера для печати на всю ширину */
            #cp-printable-area {
              margin: 0 !important;
              box-shadow: none !important;
              max-width: none !important;
              width: 100% !important;
              min-height: auto !important;
              padding: 0 !important;
            }
            /* Скрываем элементы, которые не должны быть на бумаге (на всякий случай) */
            .no-print { display: none !important; }
          </style>
        </head>
        <body>
          ${htmlContent}
          <script>
            // Задержка для загрузки Tailwind и шрифтов
            setTimeout(() => {
              window.print();
              // window.close(); // Можно раскомментировать для авто-закрытия
            }, 800);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) return <div className="p-10 text-center">Загрузка...</div>;
  if (!data) return <div className="p-10 text-center">КП не найдено или доступ запрещен</div>;

  const calculatedBase = items.reduce((acc, i) => acc + (i.final_price_byn * i.quantity), 0);
  const calculatedVat = data.has_vat ? calculatedBase * 0.2 : 0;
  const calculatedTotal = calculatedBase + calculatedVat;
  const displayTotal = calculatedTotal === 0 && data.total_amount_byn > 0 ? data.total_amount_byn : calculatedTotal;
  
  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Toolbar */}
      <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Button variant="secondary" icon="arrow_back" onClick={onClose}>Назад</Button>
        </div>
        <div className="flex gap-2">
          <Button icon="print" onClick={handlePrint}>Печать / PDF</Button>
        </div>
      </div>

      {/* Printable Area Wrapper */}
      <div className="flex-grow overflow-y-auto p-8">
        {/* ID used for selecting content to print */}
        <div id="cp-printable-area" className="bg-white max-w-[210mm] mx-auto min-h-[297mm] p-[15mm] shadow-lg flex flex-col">
          
          {/* Header */}
          <div className="flex justify-between items-start mb-10 border-b-2 border-slate-800 pb-6">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 uppercase tracking-tight mt-2">Коммерческое<br/>предложение</h1>
              
              {data.title && (
                <p className="text-lg italic text-slate-600 mt-2 font-medium">{data.title}</p>
              )}

              <div className="flex items-center gap-3 mt-4">
                <span className="text-3xl font-bold text-slate-700">№ {data.number}</span>
                <span className="text-3xl text-slate-300 font-light">|</span>
                <span className="text-3xl font-bold text-slate-700">{formatDate(data.created_at)}</span>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-blue-700">SmartHome CRM</h2>
              <p className="text-sm text-slate-500 mt-1">Интеллектуальные системы</p>
              <div className="text-xs text-slate-400 mt-4">
                <p>Тел: +375 29 000 00 00</p>
                <p>Email: info@smarthome.by</p>
              </div>
            </div>
          </div>

          {/* Client Info */}
          <div className="mb-8 flex flex-col gap-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Заказчик</p>
            <p className="text-2xl font-bold text-slate-900">{data.client?.name}</p>
          </div>

          {/* Table */}
          <table className="w-full text-left text-sm mb-8 border-collapse table-fixed">
            <thead>
              <tr className="border-b-2 border-slate-800">
                <th className="py-2 text-[10px] font-bold text-slate-500 uppercase w-8">№</th>
                <th className="py-2 text-[10px] font-bold text-slate-500 uppercase w-[35%]">Наименование</th>
                <th className="py-2 text-[10px] font-bold text-slate-500 uppercase text-center w-12">Ед.</th>
                <th className="py-2 text-[10px] font-bold text-slate-500 uppercase text-center w-16">Кол-во</th>
                <th className="py-2 text-[10px] font-bold text-slate-500 uppercase text-right w-24">Цена</th>
                <th className="py-2 text-[10px] font-bold text-slate-500 uppercase text-right w-24">Сумма</th>
                {data.has_vat && (
                  <>
                    <th className="py-2 text-[10px] font-bold text-slate-500 uppercase text-right w-20">НДС 20%</th>
                    <th className="py-2 text-[10px] font-bold text-slate-500 uppercase text-right w-24">Всего</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 border-b border-slate-200">
              {items.length > 0 ? (
                Object.entries(groupedItems).map(([category, catItems]: [string, any[]]) => {
                  const catQty = catItems.reduce((sum: number, i: any) => sum + i.quantity, 0);
                  const catSum = catItems.reduce((sum: number, i: any) => sum + (i.final_price_byn * i.quantity), 0);
                  const catVat = data.has_vat ? catSum * 0.2 : 0;
                  const catTotal = catSum + catVat;

                  return (
                    <React.Fragment key={category}>
                      {/* Category Header Row */}
                      <tr className="bg-slate-100 break-inside-avoid">
                        <td colSpan={3} className="py-2 px-2 font-bold text-xs text-slate-700 uppercase tracking-wide">{category}</td>
                        <td className="py-2 px-1 text-center font-bold text-xs text-slate-700">{catQty}</td>
                        <td className="py-2 px-1 text-right"></td>
                        <td className="py-2 px-1 text-right font-bold text-xs text-slate-700">{catSum.toFixed(2)}</td>
                        {data.has_vat && (
                          <>
                            <td className="py-2 px-1 text-right font-bold text-xs text-slate-500">{catVat.toFixed(2)}</td>
                            <td className="py-2 px-1 text-right font-bold text-xs text-slate-700">{catTotal.toFixed(2)}</td>
                          </>
                        )}
                      </tr>
                      
                      {/* Items Rows */}
                      {catItems.map((item: any, idx: number) => {
                        const rowSum = item.final_price_byn * item.quantity;
                        const rowVat = data.has_vat ? rowSum * 0.2 : 0;
                        const rowTotal = rowSum + rowVat;

                        return (
                          <tr key={item.id} className="break-inside-avoid">
                            <td className="py-3 text-slate-400 text-xs align-top">{idx + 1}</td>
                            <td className="py-3 font-medium text-slate-900 align-top pr-2">
                              {item.snapshot_name || 'Архивный товар'}
                            </td>
                            <td className="py-3 text-center text-slate-500 align-top text-xs">
                              {item.snapshot_unit || 'шт'}
                            </td>
                            <td className="py-3 text-center text-slate-900 align-top text-sm">
                              {item.quantity}
                            </td>
                            <td className="py-3 text-right text-slate-600 align-top">{item.final_price_byn.toFixed(2)}</td>
                            <td className="py-3 text-right text-slate-800 align-top">{rowSum.toFixed(2)}</td>
                            {data.has_vat && (
                              <>
                                <td className="py-3 text-right text-slate-500 align-top text-xs">{rowVat.toFixed(2)}</td>
                                <td className="py-3 text-right text-slate-900 align-top">{rowTotal.toFixed(2)}</td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={data.has_vat ? 8 : 6} className="py-8 text-center text-slate-400 italic bg-slate-50">
                    Список позиций пуст или недоступен для просмотра
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-12 break-inside-avoid">
            <div className="w-72 space-y-2 bg-slate-50 p-4 rounded-xl">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Сумма без НДС:</span>
                <span className="font-bold">{calculatedBase.toFixed(2)} BYN</span>
              </div>
              {data.has_vat && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">НДС (20%):</span>
                  <span className="font-bold">{calculatedVat.toFixed(2)} BYN</span>
                </div>
              )}
              <div className="flex justify-between text-xl pt-4 border-t border-slate-300 mt-2">
                <span className="font-bold text-slate-900">ИТОГО:</span>
                <span className="font-bold text-blue-700">{displayTotal.toFixed(2)} BYN</span>
              </div>
            </div>
          </div>

          <div className="flex-grow"></div>

          {/* Signatures Footer */}
          <div className="mt-12 pt-8 border-t-2 border-slate-800 break-inside-avoid">
            <h3 className="text-lg font-bold text-slate-900 uppercase mb-8">Подписи сторон</h3>
            <div className="flex flex-row justify-between gap-12">
              
              {/* Left: Supplier */}
              <div className="w-1/2">
                <p className="font-bold text-sm mb-6 uppercase tracking-wider">Поставщик:</p>
                <div className="space-y-6">
                  <div className="flex items-end gap-2">
                    <span className="text-sm text-slate-500 w-16 shrink-0">Дата:</span>
                    <div className="border-b border-black flex-grow"></div>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-sm text-slate-500 w-16 shrink-0">Подпись:</span>
                    <div className="border-b border-black flex-grow"></div>
                  </div>
                  <div className="mt-2 text-sm text-center font-medium text-slate-900">
                    {data.creator?.full_name || '____________________'}
                  </div>
                </div>
              </div>

              {/* Right: Buyer */}
              <div className="w-1/2">
                <p className="font-bold text-sm mb-6 uppercase tracking-wider">Покупатель:</p>
                <div className="space-y-6">
                  <div className="flex items-end gap-2">
                    <span className="text-sm text-slate-500 w-16 shrink-0">Дата:</span>
                    <div className="border-b border-black flex-grow"></div>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-sm text-slate-500 w-16 shrink-0">Подпись:</span>
                    <div className="border-b border-black flex-grow"></div>
                  </div>
                  <div className="mt-8 text-center text-slate-300 font-bold border-2 border-dashed border-slate-300 w-24 h-24 rounded-full flex items-center justify-center mx-auto opacity-50">
                    М.П.
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-12 text-center text-[10px] text-slate-400">
            <p>Предложение действительно в течение 5 рабочих дней с даты выставления.</p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CPView;
