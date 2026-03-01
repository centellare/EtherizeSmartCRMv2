import React, { useState, useEffect, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { supabase } from '../../../lib/supabase';
import { Button, Input, Select, useToast } from '../../ui';
import { replaceDocumentTags, sumInWords } from '../../../lib/formatUtils';

interface ContractGeneratorProps {
    invoiceId: string;
    onClose: () => void;
}

const TEMPLATE_TYPES = [
  { value: 'individual_100', label: 'Физлицо 100%' },
  { value: 'individual_partial', label: 'Физлицо Частичная' },
  { value: 'legal_100', label: 'Юрлицо 100%' },
  { value: 'legal_partial', label: 'Юрлицо Частичная' }
];

export const ContractGenerator: React.FC<ContractGeneratorProps> = ({ invoiceId, onClose }) => {
    const [invoice, setInvoice] = useState<any>(null);
    const [client, setClient] = useState<any>(null);
    const [selectedType, setSelectedType] = useState(TEMPLATE_TYPES[0].value);
    const [content, setContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // Dynamic fields
    const [contractNumber, setContractNumber] = useState('');
    const [purchaseSubject, setPurchaseSubject] = useState('');
    const [prepaymentPercent, setPrepaymentPercent] = useState('');
    const [deliveryDays, setDeliveryDays] = useState('');
    const [purchasePurpose, setPurchasePurpose] = useState('');
    const [fundingSource, setFundingSource] = useState('');

    const quillRef = useRef<ReactQuill>(null);
    const toast = useToast();

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                // Fetch invoice and client
                const { data: inv, error: invError } = await supabase
                    .from('invoices')
                    .select('*, client:clients(*)')
                    .eq('id', invoiceId)
                    .single();
                
                if (invError) throw invError;
                setInvoice(inv);
                setClient(inv.client);

                // Try to auto-detect template type
                if (inv.client?.type === 'person') {
                    setSelectedType('individual_100');
                } else {
                    setSelectedType('legal_100');
                }

                // Default contract number based on invoice number
                setContractNumber(`Д-${inv.number}`);

            } catch (error: any) {
                console.error('Error fetching data:', error);
                toast.error('Ошибка при загрузке данных счета');
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, [invoiceId]);

    const loadTemplate = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await (supabase as any)
                .from('contract_templates')
                .select('*')
                .eq('type', selectedType)
                .maybeSingle();
            
            if (error && error.code !== 'PGRST116') throw error;
            
            if (data) {
                // Prepare document data
                const totalSum = Number(invoice?.total_amount || 0);
                const amountWords = sumInWords(totalSum);
                const amountStr = `${totalSum.toFixed(2)} руб. (${amountWords})`;

                // Calculate VAT
                let vatAmount = 0;
                let vatAmountStr = 'Без НДС';
                let vatAmountWords = 'Без НДС';

                if (invoice?.has_vat) {
                    // If invoice has VAT, total_amount includes VAT (20%)
                    // VAT = Total * 20 / 120
                    vatAmount = totalSum * 20 / 120;
                    const vatRub = Math.floor(vatAmount);
                    const vatKop = Math.round((vatAmount - vatRub) * 100);
                    vatAmountStr = `${vatAmount.toFixed(2)} руб.`;
                    vatAmountWords = sumInWords(vatAmount);
                }

                const documentData = {
                    contract_number: contractNumber,
                    contract_date: new Date().toLocaleDateString('ru-RU'),
                    contract_amount: amountStr,
                    amount_words: amountWords,
                    vat_amount: vatAmountStr,
                    vat_amount_words: vatAmountWords,
                    purchase_subject: purchaseSubject,
                    prepayment_percent: prepaymentPercent,
                    delivery_days: deliveryDays,
                    purchase_purpose: purchasePurpose,
                    funding_source: fundingSource
                };

                // Replace tags
                const replacedContent = replaceDocumentTags(data.content, client, documentData);
                setContent(replacedContent);
            } else {
                setContent('');
                toast.error('Шаблон не найден');
            }
        } catch (error: any) {
            console.error('Error fetching template:', error);
            toast.error('Ошибка при загрузке шаблона');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!contractNumber) {
            toast.error('Укажите номер договора');
            return;
        }

        setIsSaving(true);
        try {
            const { data: userData } = await supabase.auth.getUser();
            const { error } = await (supabase as any)
                .from('contracts')
                .insert([{ 
                    invoice_id: invoiceId,
                    client_id: client?.id,
                    contract_number: contractNumber,
                    content: content,
                    amount: invoice?.total_amount,
                    created_by: userData.user?.id
                }]);
            
            if (error) throw error;
            
            toast.success('Договор успешно сохранен');
            onClose();
        } catch (error: any) {
            console.error('Error saving contract:', error);
            toast.error('Ошибка при сохранении договора');
        } finally {
            setIsSaving(false);
        }
    };

    const modules = {
        toolbar: [
            [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'align': [] }],
            ['link', 'clean']
        ],
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-[24px] w-full max-w-6xl h-[90vh] shadow-xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <Button variant="secondary" icon="close" onClick={onClose}>Отмена</Button>
                        <h2 className="text-xl font-bold text-slate-800">Подготовка договора</h2>
                    </div>
                    <Button 
                        onClick={handleSave} 
                        loading={isSaving}
                        icon="save"
                    >
                        Сохранить договор
                    </Button>
                </div>

                {/* Main Content */}
                <div className="flex-grow flex overflow-hidden">
                    {/* Settings Sidebar */}
                    <div className="w-80 bg-slate-50 border-r border-slate-200 p-6 overflow-y-auto flex-shrink-0 flex flex-col gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Шаблон</label>
                            <Select
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value)}
                                options={TEMPLATE_TYPES}
                            />
                        </div>

                        <div className="pt-4 border-t border-slate-200">
                            <h3 className="text-sm font-bold text-slate-800 mb-4">Данные для заполнения</h3>
                            
                            <div className="space-y-4">
                                <Input 
                                    label="Номер договора поставки" 
                                    value={contractNumber} 
                                    onChange={(e) => setContractNumber(e.target.value)} 
                                />
                                <Input 
                                    label="Предмет приобретения" 
                                    value={purchaseSubject} 
                                    onChange={(e) => setPurchaseSubject(e.target.value)} 
                                    placeholder="Например: Оборудование"
                                />
                                <Input 
                                    label="Размер предоплаты, %" 
                                    value={prepaymentPercent} 
                                    onChange={(e) => setPrepaymentPercent(e.target.value)} 
                                    type="number"
                                />
                                <Input 
                                    label="Срок поставки товара, дней" 
                                    value={deliveryDays} 
                                    onChange={(e) => setDeliveryDays(e.target.value)} 
                                    type="number"
                                />
                                <Input 
                                    label="Цель приобретения Товара" 
                                    value={purchasePurpose} 
                                    onChange={(e) => setPurchasePurpose(e.target.value)} 
                                    placeholder="Для собственного потребления"
                                />
                                <Input 
                                    label="Источник финансирования" 
                                    value={fundingSource} 
                                    onChange={(e) => setFundingSource(e.target.value)} 
                                    placeholder="Собственные средства"
                                />
                            </div>
                        </div>

                        <Button 
                            onClick={loadTemplate} 
                            className="w-full mt-4"
                            icon="autorenew"
                        >
                            Сгенерировать текст
                        </Button>
                        <p className="text-[10px] text-slate-500 text-center">
                            Нажмите, чтобы загрузить шаблон и подставить данные
                        </p>
                    </div>

                    {/* Text Editor Area */}
                    <div className="flex-grow p-6 overflow-y-auto relative bg-white flex flex-col">
                        {isLoading ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        ) : null}
                        <div className="flex-grow flex flex-col h-full border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <ReactQuill 
                                ref={quillRef}
                                theme="snow" 
                                value={content} 
                                onChange={setContent}
                                modules={modules}
                                className="flex-grow flex flex-col h-full bg-white font-serif"
                                placeholder="Сгенерируйте текст договора или вставьте свой..."
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
