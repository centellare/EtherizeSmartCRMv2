import React, { useState, useEffect, useRef } from 'react';
import { TiptapEditor } from '../../ui';
import { supabase } from '../../../lib/supabase';
import { Button, Input, useToast } from '../../ui';
import { replaceDocumentTags, sumInWords } from '../../../lib/formatUtils';
import { formatDateLong } from '../../../lib/dateUtils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ContractGeneratorProps {
    invoiceId: string;
    onClose: () => void;
}

export const ContractGenerator: React.FC<ContractGeneratorProps> = ({ invoiceId, onClose }) => {
    const [invoice, setInvoice] = useState<any>(null);
    const [client, setClient] = useState<any>(null);
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [content, setContent] = useState('');
    const [contentJson, setContentJson] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // Dynamic fields
    const [contractNumber, setContractNumber] = useState('');
    const [purchaseSubject, setPurchaseSubject] = useState('');
    const [prepaymentPercent, setPrepaymentPercent] = useState('100');
    const [deliveryDays, setDeliveryDays] = useState('14');
    const [purchasePurpose, setPurchasePurpose] = useState('Для собственного потребления');
    const [fundingSource, setFundingSource] = useState('Собственные средства');
    const [paymentDeadlineDays, setPaymentDeadlineDays] = useState('');

    // Margin settings
    const [marginTop, setMarginTop] = useState('20');
    const [marginBottom, setMarginBottom] = useState('20');
    const [marginLeft, setMarginLeft] = useState('15');
    const [marginRight, setMarginRight] = useState('15');

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

                // Fetch templates
                const { data: tmpls, error: tmplError } = await (supabase as any)
                    .from('contract_templates')
                    .select('*')
                    .order('name');
                
                if (tmplError) throw tmplError;
                setTemplates(tmpls || []);

                // Try to auto-detect template type
                if (tmpls && tmpls.length > 0) {
                    let defaultTemplate;
                    if (inv.client?.type === 'person') {
                        defaultTemplate = tmpls.find((t: any) => t.type === 'individual_100') || tmpls[0];
                    } else {
                        defaultTemplate = tmpls.find((t: any) => t.type === 'legal_100') || tmpls[0];
                    }
                    setSelectedTemplateId(defaultTemplate.id);
                }

                // Default contract number based on invoice number
                setContractNumber(`Д-${inv.number}`);

            } catch (error: any) {
                console.error('Error fetching data:', error);
                toast.error('Ошибка при загрузке данных');
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, [invoiceId]);

    const loadTemplate = async () => {
        if (!selectedTemplateId) {
            toast.error('Выберите шаблон');
            return;
        }

        setIsLoading(true);
        try {
            const template = templates.find(t => t.id === selectedTemplateId);
            
            if (template) {
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
                    contract_date: formatDateLong(new Date()),
                    invoice_number: invoice.number,
                    invoice_date: formatDateLong(invoice.created_at || new Date()),
                    contract_amount: amountStr,
                    amount_words: amountWords,
                    vat_amount: vatAmountStr,
                    vat_amount_words: vatAmountWords,
                    purchase_subject: purchaseSubject,
                    prepayment_percent: prepaymentPercent,
                    delivery_days: deliveryDays,
                    purchase_purpose: purchasePurpose,
                    funding_source: fundingSource,
                    payment_deadline_days: paymentDeadlineDays,
                    // Raw values for calculations
                    total_amount_value: totalSum,
                    total_vat_value: vatAmount,
                };

                // Replace tags
                const replacedContent = replaceDocumentTags(template.content, client, documentData);
                setContent(replacedContent);
            } else {
                setContent('');
                toast.error('Шаблон не найден');
            }
        } catch (error: any) {
            console.error('Error processing template:', error);
            toast.error('Ошибка при обработке шаблона');
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
                    content_json: contentJson,
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

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = async () => {
        const element = document.getElementById('contract-document');
        if (!element) return;

        setIsSaving(true);
        try {
            const canvas = await html2canvas(element, {
                scale: 2, // Higher quality
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
            pdf.save(`${contractNumber || 'contract'}.pdf`);
            toast.success('PDF успешно сформирован');
        } catch (error) {
            console.error('PDF generation error:', error);
            toast.error('Ошибка при создании PDF');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadDoc = () => {
        const header = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' 
                  xmlns:w='urn:schemas-microsoft-com:office:word' 
                  xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset='utf-8'>
                <style>
                    body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.5; }
                    p { margin: 0 0 10pt 0; }
                    table { border-collapse: collapse; width: 100%; }
                    td, th { border: 1px solid black; padding: 5pt; }
                </style>
            </head>
            <body>
                ${content}
            </body>
            </html>`;
        
        const blob = new Blob(['\ufeff', header], {
            type: 'application/msword'
        });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${contractNumber || 'contract'}.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <style>{`
                @media print {
                    @page {
                        size: A4;
                        margin: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    .print-container, .print-container * {
                        visibility: visible !important;
                    }
                    .print-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        padding: 0 !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        font-size: 12pt !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
                .document-editor .ProseMirror {
                    font-family: "Times New Roman", Times, serif !important;
                    font-size: 12pt !important;
                    line-height: 1.5 !important;
                    padding: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm !important;
                    min-height: 297mm !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    background: white !important;
                    color: black !important;
                    -webkit-hyphens: none !important;
                    -ms-hyphens: none !important;
                    hyphens: none !important;
                    word-break: normal !important;
                    overflow-wrap: break-word !important;
                    text-align: justify;
                    text-justify: inter-word;
                    white-space: pre-wrap !important;
                    box-sizing: border-box !important;
                    outline: none !important;
                }
                .document-editor .ProseMirror p {
                    margin-bottom: 0 !important;
                }
                .document-editor .ProseMirror:focus {
                    outline: none !important;
                }
                /* Скрываем любые внутренние скроллы редактора */
                .document-editor {
                    overflow: hidden !important;
                }
                .document-editor .ProseMirror:focus {
                    outline: none !important;
                }
            `}</style>
            <div className="bg-white rounded-[24px] w-full max-w-6xl h-[90vh] shadow-xl flex flex-col overflow-hidden no-print">
                {/* Header */}
                <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <Button variant="secondary" icon="close" onClick={onClose}>Отмена</Button>
                        <h2 className="text-xl font-bold text-slate-800">Подготовка договора</h2>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            onClick={handleDownloadPDF} 
                            variant="secondary"
                            icon="picture_as_pdf"
                            disabled={!content || isSaving}
                            loading={isSaving}
                        >
                            PDF
                        </Button>
                        <Button 
                            onClick={handleDownloadDoc} 
                            variant="secondary"
                            icon="description"
                            disabled={!content}
                        >
                            .DOC
                        </Button>
                        <Button 
                            onClick={handleSave} 
                            loading={isSaving}
                            icon="save"
                        >
                            Сохранить в CRM
                        </Button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-grow flex overflow-hidden">
                    {/* Settings Sidebar */}
                    <div className="w-80 bg-slate-50 border-r border-slate-200 p-6 overflow-y-auto flex-shrink-0 flex flex-col gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Шаблон</label>
                            <select
                                value={selectedTemplateId}
                                onChange={(e) => setSelectedTemplateId(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                disabled={isLoading}
                            >
                                <option value="" disabled>-- Выберите шаблон --</option>
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.name || t.type}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="pt-4 border-t border-slate-200">
                            <h3 className="text-sm font-bold text-slate-800 mb-4">Поля страницы (мм)</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <Input 
                                    label="Сверху" 
                                    value={marginTop} 
                                    onChange={(e) => setMarginTop(e.target.value)} 
                                    type="number"
                                />
                                <Input 
                                    label="Снизу" 
                                    value={marginBottom} 
                                    onChange={(e) => setMarginBottom(e.target.value)} 
                                    type="number"
                                />
                                <Input 
                                    label="Слева" 
                                    value={marginLeft} 
                                    onChange={(e) => setMarginLeft(e.target.value)} 
                                    type="number"
                                />
                                <Input 
                                    label="Справа" 
                                    value={marginRight} 
                                    onChange={(e) => setMarginRight(e.target.value)} 
                                    type="number"
                                />
                            </div>
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
                                    label="Срок оплаты остатка, дней" 
                                    value={paymentDeadlineDays} 
                                    onChange={(e) => setPaymentDeadlineDays(e.target.value)} 
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
                    <div className="flex-grow p-6 overflow-y-auto relative bg-slate-100 flex flex-col items-center">
                        {isLoading ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        ) : null}
                        <div id="contract-document" className="w-[210mm] min-h-[297mm] bg-white shadow-lg flex flex-col document-editor print-container">
                            <TiptapEditor 
                                content={content} 
                                onChange={(html, json) => {
                                    setContent(html);
                                    setContentJson(json);
                                }}
                                className="flex-grow flex flex-col h-full border-none"
                                placeholder="Сгенерируйте текст договора или вставьте свой..."
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
