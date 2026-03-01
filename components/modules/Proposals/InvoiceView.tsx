
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, useToast } from '../../ui';
import { formatDate } from '../../../lib/dateUtils';
import { sumInWords, replaceDocumentTags } from '../../../lib/formatUtils';
import { notifyRole } from '../../../lib/notifications';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ContractGenerator } from './ContractGenerator';

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
  const [editMode, setEditMode] = useState(false);
  const [showContractGenerator, setShowContractGenerator] = useState(false);
  const [viewingContract, setViewingContract] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [preamble, setPreamble] = useState('');
  const [footer, setFooter] = useState('');
  const toast = useToast();
  
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

        const { data: contractData } = await (supabase as any).from('contracts').select('*').eq('invoice_id', invoiceId).is('deleted_at', null);
        setContracts(contractData || []);

        setInvoice(inv);
        setItems(invItems || []);
        
        let preambleText = (inv as any).preamble;
        let footerText = (inv as any).footer;

        if (!preambleText || !footerText) {
            const { data: tmpl } = await supabase.from('document_templates').select('*').eq('type', 'invoice').limit(1).maybeSingle();
            if (!preambleText && tmpl && tmpl.header_text) {
                preambleText = tmpl.header_text;
            }
            if (!footerText && tmpl && tmpl.footer_text) {
                footerText = tmpl.footer_text;
            }
        }

        setPreamble(preambleText || '');
        
        if (footerText) {
            setFooter(footerText);
        } else {
            // Default footer if empty
            setFooter(`1. Поставщик обязуется поставить Покупателю, а Покупатель обязуется принять и оплатить товар.\n2. Оплата 100% ${(inv as any).due_date ? `в срок до ${formatDate((inv as any).due_date)}` : 'в течение 3 рабочих дней'}.\n3. Срок поставки до 20 рабочих дней.`);
        }

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
        toast.error("Ошибка загрузки: " + e.message);
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
          // 1. Update Invoice Status
          const { error: updateError } = await supabase.from('invoices').update({ status: newStatus }).eq('id', invoiceId);
          if (updateError) throw updateError;

          // 2. Logic for Reservation & Deficit (Only when moving from Draft -> Sent/Paid)
          if ((newStatus === 'sent' || newStatus === 'paid') && invoice.status === 'draft') {
              
              // Notify storekeeper about new shipment task
              await notifyRole(['storekeeper'], `Счет №${invoice.number} готов к отгрузке (статус: ${newStatus})`, `#proposals/invoices/${invoiceId}`);

              // A. Get invoice items (products only, flatten hierarchy)
              const { data: invItems } = await supabase
                  .from('invoice_items')
                  .select('product_id, quantity')
                  .eq('invoice_id', invoiceId)
                  .not('product_id', 'is', null);
              
              if (invItems && invItems.length > 0) {
                  // Group invoice requirements
                  const requirements: Record<string, number> = {};
                  invItems.forEach(i => {
                      if (i.product_id) {
                          // Fix TS error: ensure quantity is treated as number (default 0 if null)
                          const qty = i.quantity || 0;
                          requirements[i.product_id] = (requirements[i.product_id] || 0) + qty;
                      }
                  });

                  // B. Get Stock
                  const productIds = Object.keys(requirements);
                  const { data: stockItems } = await supabase
                      .from('inventory_items')
                      .select('id, product_id, quantity, purchase_price, serial_number, assigned_to_id')
                      .in('product_id', productIds)
                      .eq('status', 'in_stock')
                      .gt('quantity', 0)
                      .order('created_at', { ascending: true }); // FIFOish

                  // C. Process Reservation
                  const supplyItems: { product_id: string, quantity_needed: number }[] = [];
                  let availableStock = stockItems ? [...stockItems] : [];

                  for (const prodId of productIds) {
                      let needed = requirements[prodId];
                      
                      // Find matching stock for this product
                      const matchingStock = availableStock.filter(s => s.product_id === prodId);
                      
                      for (const item of matchingStock) {
                          if (needed <= 0.0001) break;
                          
                          // Fix TS error: explicitly handle potential null quantity
                          const currentQty = item.quantity || 0;
                          const take = Math.min(currentQty, needed);
                          
                          // DB Update: Reserve
                          if (Math.abs(take - currentQty) < 0.0001) {
                              // Take whole item
                              await supabase.from('inventory_items').update({
                                  status: 'reserved',
                                  reserved_for_invoice_id: invoiceId
                              }).eq('id', item.id);
                              item.quantity = 0; // Mark consumed locally
                          } else {
                              // Split item
                              // 1. Update current to remaining
                              const remaining = currentQty - take;
                              await supabase.from('inventory_items').update({
                                  quantity: remaining
                              }).eq('id', item.id);
                              
                              // 2. Create new reserved item
                              await supabase.from('inventory_items').insert({
                                  product_id: prodId,
                                  quantity: take,
                                  status: 'reserved',
                                  reserved_for_invoice_id: invoiceId,
                                  purchase_price: item.purchase_price,
                                  assigned_to_id: item.assigned_to_id,
                                  serial_number: null // Reset serial on split as we don't know which one
                              });
                              item.quantity = remaining;
                          }
                          needed -= take;
                      }

                      if (needed > 0.0001) {
                          supplyItems.push({ product_id: prodId, quantity_needed: needed });
                      }
                  }

                  // D. Create Supply Order if deficit
                  if (supplyItems.length > 0) {
                      const { data: so } = await supabase.from('supply_orders').insert({
                          invoice_id: invoiceId,
                          status: 'pending',
                          created_by: invoice.created_by
                      }).select('id').single();

                      if (so) {
                          const soItems = supplyItems.map(si => ({
                              supply_order_id: so.id,
                              product_id: si.product_id,
                              quantity_needed: si.quantity_needed,
                              status: 'pending'
                          }));
                          await supabase.from('supply_order_items').insert(soItems);

                          // Notify storekeeper/manager about deficit
                          await notifyRole(['storekeeper', 'manager'], `Создан заказ на снабжение (дефицит) по счету №${invoice.number}`, '#inventory/orders');
                      }
                  }
              }
              toast.success('Счет проведен. Товар зарезервирован, дефицит добавлен в заказ.');
          } else {
              toast.success('Статус счета обновлен');
          }
          fetchData();
      } catch (e: any) {
          console.error(e);
          toast.error('Ошибка: ' + e.message);
      } finally {
          setStatusLoading(false);
      }
  };

  const handleSaveText = async () => {
    try {
        const { error } = await supabase.from('invoices').update({ preamble, footer } as any).eq('id', invoiceId);
        if (error) throw error;
        toast.success('Оформление сохранено');
        setEditMode(false);
        fetchData();
    } catch (e: any) {
        toast.error('Ошибка: ' + e.message);
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

  const handleDeleteContract = async (contractId: string) => {
      if (!confirm('Вы уверены, что хотите удалить этот договор? Он будет перемещен в корзину.')) return;
      
      try {
          const { data: userData } = await supabase.auth.getUser();
          const { error } = await (supabase as any).from('contracts').update({
              deleted_at: new Date().toISOString(),
              deleted_by: userData.user?.id
          }).eq('id', contractId);
          
          if (error) throw error;
          
          toast.success('Договор удален');
          fetchData();
      } catch (e: any) {
          toast.error('Ошибка удаления: ' + e.message);
      }
  };

  const handleDownloadContractPDF = async (contract: any) => {
    const element = document.createElement('div');
    element.className = 'document-preview';
    element.style.width = '210mm';
    element.style.minHeight = '297mm';
    element.style.padding = '20mm 15mm';
    element.style.background = 'white';
    element.style.fontFamily = '"Times New Roman", Times, serif';
    element.style.fontSize = '12pt';
    element.style.lineHeight = '1.5';
    element.innerHTML = contract.content;
    document.body.appendChild(element);

    try {
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Договор_${contract.contract_number}.pdf`);
        toast.success('PDF успешно сформирован');
    } catch (error) {
        console.error('PDF generation error:', error);
        toast.error('Ошибка при создании PDF');
    } finally {
        document.body.removeChild(element);
    }
  };

  const handleDownloadContractDoc = (contract: any) => {
    const mt = contract.margin_top || 20;
    const mb = contract.margin_bottom || 20;
    const ml = contract.margin_left || 15;
    const mr = contract.margin_right || 15;

    const header = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' 
              xmlns:w='urn:schemas-microsoft-com:office:word' 
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <style>
                @page Section1 {
                    size: 595.3pt 841.9pt;
                    margin: ${mt}mm ${mr}mm ${mb}mm ${ml}mm;
                    mso-header-margin: 35.4pt;
                    mso-footer-margin: 35.4pt;
                    mso-paper-source: 0;
                }
                div.Section1 {
                    page: Section1;
                }
                body { 
                    font-family: "Times New Roman", serif; 
                    font-size: 12pt; 
                    line-height: 1.5; 
                    white-space: pre-wrap;
                }
                p { margin: 0; padding: 0; }
                table { border-collapse: collapse; width: 100%; }
                td, th { border: 1px solid black; padding: 5pt; }
            </style>
        </head>
        <body>
            <div class="Section1">
                ${contract.content}
            </div>
        </body>
        </html>`;
    
    const blob = new Blob(['\ufeff', header], {
        type: 'application/msword'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Договор_${contract.contract_number}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

  const renderedPreamble = replaceDocumentTags(preamble, invoice?.client);
  const renderedFooter = replaceDocumentTags(footer, invoice?.client);

  return (
    <div className="h-full flex flex-col bg-slate-50">
        
        <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm sticky top-0 z-50">
            <div className="flex items-center gap-4">
                <Button variant="secondary" icon="arrow_back" onClick={onClose}>Назад</Button>
                {invoice.status === 'draft' && (
                    <Button onClick={() => handleStatusChange('sent')} loading={statusLoading} className="bg-blue-600 hover:bg-blue-700 text-white" icon="send">Отправить и Зарезервировать</Button>
                )}
                {invoice.status === 'sent' && (
                    <Button onClick={() => handleStatusChange('paid')} loading={statusLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white" icon="check_circle">Отметить оплату</Button>
                )}
                {invoice.status === 'draft' && (
                    <Button variant="secondary" icon="edit_note" onClick={() => setEditMode(true)}>Оформление</Button>
                )}
                <Button variant="secondary" icon="description" onClick={() => setShowContractGenerator(true)}>Подготовить договор</Button>
            </div>
            <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={showBundleDetails} onChange={e => setShowBundleDetails(e.target.checked)} className="rounded text-blue-600" />
                    Раскрыть комплекты
                </label>
                <Button icon="print" onClick={handlePrint}>Печать</Button>
            </div>
        </div>

        {showContractGenerator && (
            <ContractGenerator 
                invoiceId={invoiceId} 
                onClose={() => {
                    setShowContractGenerator(false);
                    fetchData();
                }} 
            />
        )}

        {editMode && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-[24px] p-6 w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
                    <h3 className="text-lg font-bold mb-4">Редактирование оформления</h3>
                    <div className="flex-grow overflow-y-auto space-y-6 pr-2">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Вступительный текст</label>
                            <textarea 
                                value={preamble}
                                onChange={(e) => setPreamble(e.target.value)}
                                className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-sm"
                                placeholder="Текст перед таблицей..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Условия / Подвал</label>
                            <textarea 
                                value={footer}
                                onChange={(e) => setFooter(e.target.value)}
                                className="w-full h-48 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-sm font-mono"
                                placeholder="Условия поставки и оплаты..."
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-6 shrink-0">
                        <Button className="flex-1" onClick={handleSaveText}>Сохранить</Button>
                        <Button variant="ghost" className="flex-1" onClick={() => setEditMode(false)}>Отмена</Button>
                    </div>
                </div>
            </div>
        )}

        {viewingContract && (
            <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-[24px] w-full max-w-5xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
                    <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-4">
                            <Button variant="secondary" icon="close" onClick={() => setViewingContract(null)}>Закрыть</Button>
                            <h2 className="text-xl font-bold text-slate-800">Просмотр договора №{viewingContract.contract_number}</h2>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" icon="picture_as_pdf" onClick={() => handleDownloadContractPDF(viewingContract)}>PDF</Button>
                            <Button variant="secondary" icon="description" onClick={() => handleDownloadContractDoc(viewingContract)}>.DOC</Button>
                        </div>
                    </div>
                    <div className="flex-grow p-8 overflow-y-auto bg-slate-100 flex flex-col items-center">
                        <div className="w-[210mm] min-h-[297mm] bg-white shadow-lg p-[20mm] font-serif text-[12pt] leading-[1.5] text-black whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: viewingContract.content }} />
                    </div>
                </div>
            </div>
        )}

        <div className="flex-grow overflow-y-auto p-4 md:p-8 flex flex-col items-center">
            {/* Attached Contracts Section */}
            {contracts.length > 0 && (
                <div className="w-full max-w-[210mm] mb-6 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <span className="material-icons text-blue-600 text-[18px]">description</span>
                        Привязанные договоры
                    </h3>
                    <div className="space-y-2">
                        {contracts.map(c => (
                            <div key={c.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-blue-100 text-blue-600 flex items-center justify-center">
                                        <span className="material-icons text-[16px]">article</span>
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-slate-800">Договор №{c.contract_number}</div>
                                        <div className="text-xs text-slate-500">Создан: {formatDate(c.created_at)}</div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="secondary" icon="visibility" onClick={() => setViewingContract(c)}>Просмотр</Button>
                                    <Button variant="secondary" icon="picture_as_pdf" onClick={() => handleDownloadContractPDF(c)}>PDF</Button>
                                    <Button variant="secondary" icon="description" onClick={() => handleDownloadContractDoc(c)}>.DOC</Button>
                                    <Button variant="danger" icon="delete" onClick={() => handleDeleteContract(c.id)} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                    {invoice.due_date && (
                        <p className="text-xs text-red-600 font-bold mt-1">Действителен до: {formatDate(invoice.due_date)}</p>
                    )}
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

                {/* PREAMBLE */}
                {renderedPreamble && (
                    <div className="mb-6 text-[11px] whitespace-pre-wrap leading-relaxed">
                        {renderedPreamble}
                    </div>
                )}

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

                {/* TERMS / FOOTER */}
                <div className="border border-black p-2 text-[9px] mb-6 whitespace-pre-wrap leading-relaxed">
                    {renderedFooter}
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
