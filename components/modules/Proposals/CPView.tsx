
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Toast, ConfirmModal, Select } from '../../ui';
import { formatDate } from '../../../lib/dateUtils';

interface CPViewProps {
  proposalId: string;
  onClose: () => void;
  onInvoiceCreated?: (invoiceId: string) => void;
}

const CPView: React.FC<CPViewProps> = ({ proposalId, onClose, onInvoiceCreated }) => {
  const [data, setData] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Selection for Invoice Creation
  const [selectObjectModalOpen, setSelectObjectModalOpen] = useState(false);
  const [availableObjects, setAvailableObjects] = useState<any[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string>('');

  useEffect(() => {
    const fetchCP = async () => {
      setLoading(true);
      
      const { data: cp } = await supabase
        .from('commercial_proposals')
        .select('*, client:clients(name, requisites, address:comment), creator:profiles(full_name)')
        .eq('id', proposalId)
        .single();
      
      const { data: cpItems } = await supabase
        .from('cp_items')
        .select('*, product:products(has_serial)')
        .eq('cp_id', proposalId);

      const { data: settings } = await supabase.from('company_settings').select('*').limit(1).maybeSingle();
      const { data: tpl } = await supabase.from('document_templates').select('*').eq('type', 'cp').limit(1).maybeSingle();

      setData(cp);
      setItems(cpItems || []);
      setCompanySettings(settings || { company_name: 'Моя Компания', requisites: '', bank_details: '' });
      setTemplate(tpl || { header_text: '', footer_text: '', signatory_1: 'Директор', signatory_2: 'Менеджер' });
      setLoading(false);
    };
    fetchCP();
  }, [proposalId]);

  const initiateCreateInvoice = async () => {
      if (!data?.client_id) return;
      setLoading(true);
      // Fetch objects for this client
      const { data: objects } = await supabase
          .from('objects')
          .select('id, name')
          .eq('client_id', data.client_id)
          .is('is_deleted', false)
          .order('updated_at', { ascending: false });
      
      setAvailableObjects(objects || []);
      if (objects && objects.length === 1) {
          // Auto select if only one
          setSelectedObjectId(objects[0].id);
      }
      setLoading(false);
      setSelectObjectModalOpen(true);
  };

  const handleCreateInvoice = async () => {
    if (!selectedObjectId && availableObjects.length > 0) {
        // Optional: force selection or allow 'No Object' (which is bad practice based on request)
        if (!window.confirm("Вы не выбрали объект. Создать счет без привязки к объекту? Это усложнит аналитику.")) return;
    }

    setSelectObjectModalOpen(false);
    setCreatingInvoice(true);
    try {
        // 1. Check stock (Omitted for brevity, logic remains same as before)
        const productIds = items.map(i => i.product_id).filter(Boolean);
        const { data: stockItems } = await supabase
            .from('inventory_items')
            .select('product_id, quantity')
            .in('product_id', productIds)
            .eq('status', 'in_stock')
            .is('deleted_at', null);
        
        const stockMap: Record<string, number> = {};
        stockItems?.forEach((si: any) => {
            stockMap[si.product_id] = (stockMap[si.product_id] || 0) + si.quantity;
        });

        const missing: any[] = [];
        items.forEach(item => {
            if (item.product_id) {
                const available = stockMap[item.product_id] || 0;
                if (available < item.quantity) {
                    missing.push({
                        ...item,
                        needed: item.quantity - available
                    });
                }
            }
        });

        // 2. Create Invoice Record with Object Link
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

        // 3. Create Invoice Items
        const invItemsPayload = items.map(item => ({
            invoice_id: inv.id,
            product_id: item.product_id,
            name: item.snapshot_name || 'Товар',
            quantity: item.quantity,
            unit: item.snapshot_unit || 'шт',
            price: item.final_price_byn,
            total: item.final_price_byn * item.quantity
        }));
        await supabase.from('invoice_items').insert(invItemsPayload);

        // 4. Create Supply Order if missing
        let supplyMsg = '';
        if (missing.length > 0) {
            const { data: so, error: soError } = await supabase.from('supply_orders').insert([{
                invoice_id: inv.id,
                status: 'pending',
                created_by: data.created_by
            }]).select('id').single();

            if (soError) throw soError;

            const soItemsPayload = missing.map(m => ({
                supply_order_id: so.id,
                product_id: m.product_id,
                quantity_needed: m.needed,
                status: 'pending'
            }));
            await supabase.from('supply_order_items').insert(soItemsPayload);
            supplyMsg = ` + Заказ поставщику (${missing.length} поз.)`;
        }

        // 5. Create Finance Plan (Income Transaction) Linked to Invoice
        if (selectedObjectId) {
            const plannedDate = new Date();
            plannedDate.setDate(plannedDate.getDate() + 3); // Default: Expect payment within 3 days

            await supabase.from('transactions').insert([{
                object_id: selectedObjectId,
                invoice_id: inv.id, // Hard Link
                type: 'income',
                amount: data.total_amount_byn,
                planned_amount: data.total_amount_byn,
                planned_date: plannedDate.toISOString(),
                category: 'Оплата по счету',
                description: `Счет №${inv.number}. Ожидаемое поступление.`,
                status: 'pending',
                created_by: data.created_by
            }]);
            
            setToast({ message: `Счет №${inv.number} создан${supplyMsg}. Добавлен план прихода в Финансы.`, type: 'success' });
        } else {
            setToast({ message: `Счет №${inv.number} создан${supplyMsg}. (Без фин. плана, т.к. нет объекта)`, type: 'success' });
        }

        // Redirect to Invoice View
        if (onInvoiceCreated) onInvoiceCreated(inv.id);

    } catch (e: any) {
        console.error(e);
        setToast({ message: 'Ошибка создания счета: ' + e.message, type: 'error' });
    }
    setCreatingInvoice(false);
  };

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

  const handlePrintCP = () => {
      const content = document.getElementById('cp-printable-area');
      if (content) {
          const printWindow = window.open('', '_blank');
          if (printWindow) {
              printWindow.document.write(`<html><head><title>КП №${data?.number}</title><script src="https://cdn.tailwindcss.com"></script></head><body>${content.outerHTML}<script>setTimeout(()=>window.print(), 800)</script></body></html>`);
              printWindow.document.close();
          }
      }
  };

  if (loading) return <div className="p-10 text-center">Загрузка...</div>;
  if (!data) return <div className="p-10 text-center">КП не найдено</div>;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Toolbar */}
      <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Button variant="secondary" icon="arrow_back" onClick={onClose}>Назад</Button>
        </div>
        <div className="flex gap-2">
          <Button icon="receipt" variant="secondary" onClick={initiateCreateInvoice} loading={creatingInvoice}>Выставить счет</Button>
          <Button icon="print" onClick={handlePrintCP}>Печать КП</Button>
        </div>
      </div>

      {/* Select Object Modal */}
      {selectObjectModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-[24px] p-6 w-full max-w-md shadow-xl">
                  <h3 className="text-lg font-bold mb-4">Выберите объект для счета</h3>
                  <p className="text-sm text-slate-500 mb-4">
                      Счет будет привязан к выбранному объекту для корректного учета снабжения и финансов.
                  </p>
                  <div className="space-y-4">
                      <Select 
                          label="Объект" 
                          value={selectedObjectId} 
                          onChange={(e:any) => setSelectedObjectId(e.target.value)}
                          options={[
                              {value:'', label: availableObjects.length === 0 ? 'Нет объектов' : 'Выберите объект...'}, 
                              ...availableObjects.map(o => ({value:o.id, label:o.name}))
                          ]}
                      />
                      <div className="flex gap-2 mt-4">
                          <Button className="flex-1" onClick={handleCreateInvoice}>Создать счет</Button>
                          <Button variant="ghost" className="flex-1" onClick={() => setSelectObjectModalOpen(false)}>Отмена</Button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Printable Area Wrapper */}
      <div className="flex-grow overflow-y-auto p-8">
        <div id="cp-printable-area" className="bg-white max-w-[210mm] mx-auto min-h-[297mm] p-[15mm] shadow-lg flex flex-col">
          
          {/* Header */}
          <div className="flex justify-between items-start mb-8 border-b-2 border-slate-800 pb-6">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 uppercase tracking-tight mt-2">Коммерческое<br/>предложение</h1>
              <div className="flex items-center gap-3 mt-4">
                <span className="text-3xl font-bold text-slate-700">№ {data.number}</span>
                <span className="text-3xl font-light text-slate-300">|</span>
                <span className="text-3xl font-bold text-slate-700">{formatDate(data.created_at)}</span>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-blue-700">{companySettings.company_name}</h2>
              <div className="text-xs text-slate-400 mt-2 max-w-[250px] ml-auto break-words">
                <p>{companySettings.requisites}</p>
              </div>
            </div>
          </div>

          <div className="mb-8">
             <p className="text-sm italic text-slate-600 whitespace-pre-wrap">{template.header_text}</p>
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
                <th className="py-2 w-8 text-center">№</th>
                <th className="py-2 w-[40%]">Наименование</th>
                <th className="py-2 w-12 text-center">Ед.</th>
                <th className="py-2 w-16 text-center">Кол-во</th>
                <th className="py-2 w-24 text-right">Цена</th>
                <th className="py-2 w-24 text-right">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 border-b border-slate-200">
              {Object.entries(groupedItems).map(([category, catItems]: [string, any[]]) => (
                <React.Fragment key={category}>
                  <tr className="bg-slate-100"><td colSpan={6} className="py-1 px-2 font-bold text-xs uppercase">{category}</td></tr>
                  {catItems.map((item: any, idx: number) => (
                    <tr key={item.id}>
                      <td className="py-2 text-center text-slate-400">{idx + 1}</td>
                      <td className="py-2 pr-2">{item.snapshot_name}</td>
                      <td className="py-2 text-center">{item.snapshot_unit}</td>
                      <td className="py-2 text-center">{item.quantity}</td>
                      <td className="py-2 text-right">{item.final_price_byn.toFixed(2)}</td>
                      <td className="py-2 text-right font-bold">{(item.final_price_byn * item.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-12">
            <div className="w-64 text-right space-y-2">
                <div className="flex justify-between font-bold text-lg">
                    <span>ИТОГО:</span>
                    <span>{data.total_amount_byn?.toFixed(2)} BYN</span>
                </div>
                {data.has_vat && <p className="text-xs text-slate-500">В том числе НДС 20%</p>}
            </div>
          </div>

          <div className="flex-grow"></div>

          <div className="mb-8 text-sm italic text-slate-500">
             {template.footer_text}
          </div>

          {/* Signatures */}
          <div className="flex justify-between mt-12 pt-8 border-t-2 border-slate-800 break-inside-avoid">
             <div className="w-1/3">
                <p className="font-bold mb-8 uppercase text-xs">{template.signatory_1}</p>
                <div className="border-b border-black"></div>
                <p className="mt-2 text-sm">{data.creator?.full_name}</p>
             </div>
             <div className="w-1/3">
                <p className="font-bold mb-8 uppercase text-xs">{template.signatory_2}</p>
                <div className="border-b border-black"></div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CPView;
