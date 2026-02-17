
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Toast, Select } from '../../ui';
import { formatDate } from '../../../lib/dateUtils';
import { sumInWords } from '../../../lib/formatUtils';

interface CPViewProps {
  proposalId: string;
  onClose: () => void;
  onInvoiceCreated?: (invoiceId: string) => void;
}

const CPView: React.FC<CPViewProps> = ({ proposalId, onClose, onInvoiceCreated }) => {
  const [data, setData] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // View Options
  const [showBundleDetails, setShowBundleDetails] = useState(false);

  const [selectObjectModalOpen, setSelectObjectModalOpen] = useState(false);
  const [availableObjects, setAvailableObjects] = useState<any[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string>('');

  // Default hardcoded settings
  const defaultSettings = {
      company_name: 'ООО "РАЦИО ДОМУС"',
      requisites: 'Адрес: БЕЛАРУСЬ, Г. МИНСК, УЛ. Ф.СКОРИНЫ, ДОМ 14, ОФ. 117, 220076\nУНП: 193736741',
      bank_details: "Карт-счет: BY82ALFA30122E47040010270000 в BYN в ЗАО 'Альфа-Банк', БИК: ALFABY2X",
      logo_url: ''
  };

  useEffect(() => {
    const fetchCP = async () => {
      setLoading(true);
      const { data: cp } = await supabase.from('commercial_proposals').select('*, client:clients(name, requisites), object:objects(name, address), creator:profiles(full_name)').eq('id', proposalId).single();
      const { data: cpItems } = await supabase.from('cp_items').select('*').eq('cp_id', proposalId).order('id'); // Ensure consistent order
      const { data: settings } = await supabase.from('company_settings').select('*').limit(1).maybeSingle();

      setData(cp);
      setItems(cpItems || []);
      
      if (settings) {
          setCompanySettings({
              company_name: settings.company_name || defaultSettings.company_name,
              requisites: settings.requisites || defaultSettings.requisites,
              bank_details: settings.bank_details || defaultSettings.bank_details,
              logo_url: (settings as any).logo_url || ''
          });
      } else {
          setCompanySettings(defaultSettings);
      }
      
      setLoading(false);
    };
    fetchCP();
  }, [proposalId]);

  const initiateCreateInvoice = async () => {
      if (!data?.client_id) return;
      setLoading(true);
      const { data: objects } = await supabase.from('objects').select('id, name').eq('client_id', data.client_id).is('is_deleted', false).order('updated_at', { ascending: false });
      setAvailableObjects(objects || []);
      if (data.object_id) {
          setSelectedObjectId(data.object_id);
      } else if (objects && objects.length === 1) {
          setSelectedObjectId(objects[0].id);
      }
      setLoading(false);
      setSelectObjectModalOpen(true);
  };

  const handleCreateInvoice = async () => {
    setSelectObjectModalOpen(false);
    setCreatingInvoice(true);
    try {
        // 1. Create Invoice Header
        const { data: inv, error: invError } = await supabase.from('invoices').insert([{
            cp_id: proposalId,
            client_id: data.client_id,
            object_id: selectedObjectId || null,
            total_amount: data.total_amount_byn,
            has_vat: data.has_vat,
            created_by: data.created_by,
            status: 'draft'
        }]).select('id, number').single();

        if (invError) throw invError;

        // 2. Prepare Items with Hierarchy
        const roots = items.filter(i => !i.parent_id);
        const children = items.filter(i => i.parent_id);
        const cpIdToInvId: Record<string, string> = {};

        // Insert Roots First
        for (const root of roots) {
            const { data: insertedRoot, error: rootError } = await supabase.from('invoice_items').insert({
                invoice_id: inv.id,
                product_id: root.product_id,
                name: root.snapshot_name || 'Товар',
                quantity: root.quantity,
                unit: root.snapshot_unit || 'шт',
                price: root.final_price_byn,
                total: root.final_price_byn * root.quantity,
                parent_id: null
            }).select('id').single();

            if (rootError) throw rootError;
            cpIdToInvId[root.id] = insertedRoot.id;
        }

        // Insert Children
        if (children.length > 0) {
            const childPayloads = children.map(child => ({
                invoice_id: inv.id,
                product_id: child.product_id,
                name: child.snapshot_name || 'Товар',
                quantity: child.quantity,
                unit: child.snapshot_unit || 'шт',
                price: child.final_price_byn,
                total: child.final_price_byn * child.quantity,
                // Map the parent ID to the newly created invoice item ID
                parent_id: child.parent_id ? cpIdToInvId[child.parent_id] : null
            }));
            
            const { error: childError } = await supabase.from('invoice_items').insert(childPayloads);
            if (childError) throw childError;
        }

        // 3. Create Expected Transaction
        if (selectedObjectId) {
            const plannedDate = new Date();
            plannedDate.setDate(plannedDate.getDate() + 3);
            await supabase.from('transactions').insert([{
                object_id: selectedObjectId,
                invoice_id: inv.id,
                type: 'income',
                amount: data.total_amount_byn,
                planned_amount: data.total_amount_byn,
                planned_date: plannedDate.toISOString(),
                category: 'Оплата по счету',
                description: `Счет №${inv.number} (из КП).`,
                status: 'pending',
                created_by: data.created_by
            }]);
        }
        setToast({ message: `Счет №${inv.number} создан.`, type: 'success' });
        if (onInvoiceCreated) onInvoiceCreated(inv.id);
    } catch (e: any) {
        setToast({ message: 'Ошибка: ' + e.message, type: 'error' });
    }
    setCreatingInvoice(false);
  };

  const handlePrintCP = () => {
      const content = document.getElementById('cp-printable-area');
      if (content) {
          const printWindow = window.open('', '_blank');
          if (printWindow) {
              printWindow.document.write(`
                <html>
                    <head>
                        <title>КП №${data?.number}</title>
                        <script src="https://cdn.tailwindcss.com"></script>
                        <style>
                            @media print { 
                                @page { margin: 0; size: A4; } /* Hide headers */
                                body { margin: 0; -webkit-print-color-adjust: exact; }
                                #cp-printable-area {
                                    margin: 0;
                                    width: 100%;
                                    padding: 15mm 20mm !important; /* Simulate margins */
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
              printWindow.document.close();
          }
      }
  };

  if (loading) return <div className="p-10 text-center">Загрузка...</div>;
  if (!data) return <div className="p-10 text-center">КП не найдено</div>;

  const vatRate = data.has_vat ? 20 : 0;

  // 1. Calculate VAT from ROOT items only (to match the Total Amount correctly without double counting children)
  const rootItemsForCalc = items.filter(i => !i.parent_id);
  const totalVatSum = rootItemsForCalc.reduce((acc, i) => {
      const totalWithVat = i.final_price_byn * i.quantity;
      const totalNoVat = data.has_vat ? totalWithVat / 1.2 : totalWithVat;
      return acc + (totalWithVat - totalNoVat);
  }, 0);

  // 2. Logic to group children under parents and number them (e.g., 2.1, 2.2)
  const tableItems = useMemo(() => {
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
          const priceWithVat = root.final_price_byn;
          const totalWithVat = root.final_price_byn * root.quantity;
          
          result.push({
              ...root,
              displayNumber: rootNum,
              totalWithVat,
              isChild: false
          });

          if (showBundleDetails && childrenMap[root.id]) {
              childrenMap[root.id].forEach((child, cIdx) => {
                  const childNum = `${rootNum}.${cIdx + 1}`;
                  const childTotalWithVat = child.final_price_byn * child.quantity;
                  result.push({
                      ...child,
                      displayNumber: childNum,
                      totalWithVat: childTotalWithVat,
                      isChild: true
                  });
              });
          }
      });

      return result;
  }, [items, showBundleDetails]);

  const totalSum = data.total_amount_byn || 0;
  const displayAddress = data.object?.address || data.client?.requisites || '—';

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Button variant="secondary" icon="arrow_back" onClick={onClose}>Назад</Button>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={showBundleDetails} onChange={e => setShowBundleDetails(e.target.checked)} className="rounded text-blue-600" />
              Раскрыть комплекты
          </label>
          <Button icon="receipt" variant="secondary" onClick={initiateCreateInvoice} loading={creatingInvoice}>Выставить счет</Button>
          <Button icon="print" onClick={handlePrintCP}>Печать КП</Button>
        </div>
      </div>

      {selectObjectModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-[24px] p-6 w-full max-w-md shadow-xl">
                  <h3 className="text-lg font-bold mb-4">Привязать к объекту</h3>
                  <Select label="Объект" value={selectedObjectId} onChange={(e:any) => setSelectedObjectId(e.target.value)} options={[{value:'', label: availableObjects.length === 0 ? 'Нет объектов' : 'Выберите объект...'}, ...availableObjects.map(o => ({value:o.id, label:o.name}))]} />
                  <div className="flex gap-2 mt-4">
                      <Button className="flex-1" onClick={handleCreateInvoice}>Создать счет</Button>
                      <Button variant="ghost" className="flex-1" onClick={() => setSelectObjectModalOpen(false)}>Отмена</Button>
                  </div>
              </div>
          </div>
      )}

      <div className="flex-grow overflow-y-auto p-8 flex justify-center">
        <div id="cp-printable-area" className="bg-white w-[210mm] min-h-[297mm] p-[10mm] shadow-lg text-black font-serif relative">
          
          {/* HEADER */}
          <div className="flex justify-between items-start mb-8">
              {/* LOGO */}
              <div className="w-[40%]">
                  {companySettings.logo_url ? (
                      <img src={companySettings.logo_url} alt="Logo" className="max-h-[80px] max-w-full object-contain" />
                  ) : (
                      <div className="border-2 border-blue-800 text-blue-800 font-bold text-2xl p-2 inline-block">
                          RATIO DOMUS
                          <span className="block text-[8px] font-normal tracking-widest uppercase">smart group</span>
                      </div>
                  )}
              </div>
              {/* REQUISITES - RIGHT ALIGNED */}
              <div className="w-[55%] text-right text-[10px] leading-relaxed">
                  <h2 className="font-bold text-sm uppercase mb-2">{companySettings.company_name}</h2>
                  <p className="whitespace-pre-wrap">{companySettings.requisites}</p>
                  <p className="mt-1">{companySettings.bank_details}</p>
              </div>
          </div>

          <div className="border-b-2 border-black mb-6"></div>

          {/* TITLE */}
          <div className="text-center mb-8">
              <h1 className="text-xl font-bold uppercase">Коммерческое предложение</h1>
              <p className="text-sm font-bold">№ {data.number} от {formatDate(data.created_at)}</p>
              {data.title && <p className="text-xs italic mt-2">"{data.title}"</p>}
          </div>

          {/* CUSTOMER */}
          <div className="mb-6 text-[12px]">
              <div className="grid grid-cols-[120px_1fr] gap-2">
                  <div className="font-bold">Заказчик:</div>
                  <div className="font-bold">{data.client?.name}</div>
                  
                  <div className="font-bold">Адрес:</div>
                  <div className="whitespace-pre-wrap">{displayAddress}</div>
              </div>
          </div>

          {/* TABLE */}
          <table className="w-full border-collapse border border-black text-[10px] mb-2">
              <thead>
                  <tr className="text-center font-bold">
                      <th className="border border-black p-1">№</th>
                      <th className="border border-black p-1 w-[40%]">Наименование</th>
                      <th className="border border-black p-1">Ед.</th>
                      <th className="border border-black p-1">Кол-во</th>
                      <th className="border border-black p-1">Цена (с НДС)</th>
                      <th className="border border-black p-1">Сумма (с НДС)</th>
                  </tr>
              </thead>
              <tbody>
                  {tableItems.map((item, idx) => (
                      <tr key={idx} className="align-top">
                          <td className="border border-black p-1 text-center">
                              {item.displayNumber}
                          </td>
                          <td className="border border-black p-1">
                              <div className={item.isChild ? 'pl-4' : ''}>
                                  {item.snapshot_name}
                                  {!item.product_id && !showBundleDetails && (
                                      <span className="block text-[8px] italic mt-0.5">(Комплект оборудования)</span>
                                  )}
                              </div>
                          </td>
                          <td className="border border-black p-1 text-center">{item.snapshot_unit}</td>
                          <td className="border border-black p-1 text-center">{item.quantity}</td>
                          <td className="border border-black p-1 text-right">{item.final_price_byn.toFixed(2)}</td>
                          <td className="border border-black p-1 text-right">{item.totalWithVat.toFixed(2)}</td>
                      </tr>
                  ))}
              </tbody>
          </table>

          {/* TOTALS */}
          <div className="flex justify-end mb-6">
              <div className="text-[11px] font-bold text-right">
                  <div className="border border-black p-1 px-2 inline-block min-w-[100px]">{totalSum.toFixed(2)} BYN</div>
              </div>
          </div>

          <div className="text-[11px] mb-8">
              <p className="font-bold">Всего к оплате: {totalSum.toFixed(2)} ({sumInWords(totalSum)})</p>
              {data.has_vat && <p className="font-bold mt-1">В том числе НДС (20%): {totalVatSum.toFixed(2)}</p>}
          </div>

          {/* SIGNATURES */}
          <div className="flex justify-between items-start text-[11px] mt-12">
              <div className="w-[45%]">
                  <div className="mb-8">Менеджер проекта:</div>
                  <div className="border-b border-black mb-2"></div>
                  <div className="text-[10px]">{data.creator?.full_name}</div>
              </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CPView;
