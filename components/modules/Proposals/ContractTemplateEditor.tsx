import React, { useState, useEffect, useRef } from 'react';
import { TiptapEditor, TiptapEditorRef } from '../../ui';
import { supabase } from '../../../lib/supabase';
import { Button, useToast } from '../../ui';
import { replaceDocumentTags } from '../../../lib/formatUtils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const TAG_GROUPS = [
  {
    title: 'Данные клиента',
    items: [
      { tag: '{{client_name}}', description: 'Название клиента (ФИО)' },
      { tag: '{{legal_name}}', description: 'Юридическое название' },
      { tag: '{{unp}}', description: 'УНП' },
      { tag: '{{bank_details}}', description: 'Банковские реквизиты' },
      { tag: '{{contact_person}}', description: 'Контактное лицо' },
      { tag: '{{phone}}', description: 'Телефон' },
      { tag: '{{email}}', description: 'Email' },
    ]
  },
  {
    title: 'Представитель',
    items: [
      { tag: '{{rep_position_nom}}', description: 'Должность (Им. падеж)' },
      { tag: '{{rep_position_gen}}', description: 'Должность (Род. падеж)' },
      { tag: '{{rep_name_nom}}', description: 'ФИО (Им. падеж)' },
      { tag: '{{rep_name_gen}}', description: 'ФИО (Род. падеж)' },
      { tag: '{{rep_name_short}}', description: 'ФИО кратко (Иванов И.И.)' },
      { tag: '{{basis_of_authority}}', description: 'Основание (Устав...)' },
    ]
  },
  {
    title: 'Договор и Счет',
    items: [
      { tag: '{{contract_number}}', description: 'Номер договора' },
      { tag: '{{contract_date}}', description: 'Дата договора' },
      { tag: '{{invoice_number}}', description: 'Номер счета' },
      { tag: '{{invoice_date}}', description: 'Дата счета' },
      { tag: '{{purchase_subject}}', description: 'Предмет приобретения' },
      { tag: '{{purchase_purpose}}', description: 'Цель приобретения' },
      { tag: '{{funding_source}}', description: 'Источник финансирования' },
    ]
  },
  {
    title: 'Суммы и НДС',
    items: [
      { tag: '{{contract_amount}}', description: 'Сумма договора' },
      { tag: '{{amount_words}}', description: 'Сумма прописью' },
      { tag: '{{vat_amount}}', description: 'Сумма НДС' },
      { tag: '{{vat_amount_words}}', description: 'Сумма НДС прописью' },
    ]
  },
  {
    title: 'Оплата и Доставка',
    items: [
      { tag: '{{delivery_days}}', description: 'Срок поставки (дней)' },
      { tag: '{{prepayment_percent}}', description: '% предоплаты' },
      { tag: '{{prepayment_amount}}', description: 'Сумма предоплаты' },
      { tag: '{{prepayment_amount_words}}', description: 'Сумма предоплаты прописью' },
      { tag: '{{prepayment_vat_amount}}', description: 'НДС с предоплаты' },
      { tag: '{{prepayment_vat_amount_words}}', description: 'НДС с предоплаты прописью' },
      { tag: '{{remaining_percent}}', description: '% остатка' },
      { tag: '{{remaining_amount}}', description: 'Сумма остатка' },
      { tag: '{{remaining_amount_words}}', description: 'Сумма остатка прописью' },
      { tag: '{{remaining_vat_amount}}', description: 'НДС с остатка' },
      { tag: '{{remaining_vat_amount_words}}', description: 'НДС с остатка прописью' },
      { tag: '{{payment_deadline_days}}', description: 'Срок оплаты остатка (дней)' },
    ]
  }
];

export const ContractTemplateEditor: React.FC = () => {
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [templateName, setTemplateName] = useState('');
    const [content, setContent] = useState('');
    const [contentJson, setContentJson] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    
    // Margin settings
    const [marginTop, setMarginTop] = useState('20');
    const [marginBottom, setMarginBottom] = useState('20');
    const [marginLeft, setMarginLeft] = useState('30');
    const [marginRight, setMarginRight] = useState('15');

    const tiptapRef = useRef<TiptapEditorRef>(null);
    const toast = useToast();

    // Fetch templates on mount
    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await (supabase as any)
                .from('contract_templates')
                .select('*')
                .order('name');
            
            if (error) throw error;
            
            if (data && data.length > 0) {
                setTemplates(data);
                // Select first template if none selected
                if (!selectedTemplateId) {
                    handleSelectTemplate(data[0]);
                }
            }
        } catch (error: any) {
            console.error('Error fetching templates:', error);
            toast.error('Ошибка при загрузке списка шаблонов');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectTemplate = (template: any) => {
        setSelectedTemplateId(template.id);
        setTemplateName(template.name || 'Без названия');
        setContent(template.content || '');
    };

    const handleCreateNew = () => {
        setSelectedTemplateId('new');
        setTemplateName('Новый шаблон');
        setContent('');
        toast.info('Создание нового шаблона');
    };

    const handleDelete = async () => {
        if (!selectedTemplateId || selectedTemplateId === 'new') return;
        
        const template = templates.find(t => t.id === selectedTemplateId);
        if (template?.is_system) {
            toast.error('Нельзя удалить системный шаблон');
            return;
        }

        if (!confirm('Вы уверены, что хотите удалить этот шаблон?')) return;

        setIsSaving(true);
        try {
            const { error } = await (supabase as any)
                .from('contract_templates')
                .delete()
                .eq('id', selectedTemplateId);
            
            if (error) throw error;
            
            toast.success('Шаблон удален');
            await fetchTemplates();
            setSelectedTemplateId(''); // Reset selection to trigger auto-select
        } catch (error: any) {
            console.error('Error deleting template:', error);
            toast.error('Ошибка при удалении шаблона');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async () => {
        if (!templateName.trim()) {
            toast.error('Введите название шаблона');
            return;
        }

        setIsSaving(true);
        try {
            if (selectedTemplateId && selectedTemplateId !== 'new') {
                // Update existing
                const { error } = await (supabase as any)
                    .from('contract_templates')
                    .update({ 
                        name: templateName,
                        content: content,
                        content_json: contentJson,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', selectedTemplateId);
                if (error) throw error;
            } else {
                // Create new
                // Generate a unique type string for backward compatibility if needed, 
                // or just rely on ID. Let's use a random string for type to satisfy unique constraint if it exists.
                const randomType = `custom_${Date.now()}`;
                
                const { data, error } = await (supabase as any)
                    .from('contract_templates')
                    .insert([{ 
                        name: templateName,
                        content: content,
                        content_json: contentJson,
                        type: randomType, // Fallback for legacy constraint
                        is_system: false
                    }])
                    .select()
                    .single();
                
                if (error) throw error;
                if (data) {
                    await fetchTemplates(); // Refresh list
                    setSelectedTemplateId(data.id); // Select the new template
                }
            }
            toast.success('Шаблон успешно сохранен');
            // Refresh list to update names if changed
            fetchTemplates();
        } catch (error: any) {
            console.error('Error saving template:', error);
            toast.error('Ошибка при сохранении шаблона');
        } finally {
            setIsSaving(false);
        }
    };

    const handleInsertTag = (tag: string) => {
        const editor = tiptapRef.current?.getEditor();
        if (!editor) {
            navigator.clipboard.writeText(tag);
            toast.success(`Тэг ${tag} скопирован в буфер обмена`);
            return;
        }

        editor.chain().focus().insertContent(tag).run();
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
                ${replaceDocumentTags(content, previewClientData, previewDocumentData)}
            </body>
            </html>`;
        
        const blob = new Blob(['\ufeff', header], {
            type: 'application/msword'
        });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${templateName || 'template'}.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDownloadPDF = async () => {
        const element = document.getElementById('template-preview-container');
        if (!element) return;

        setIsSaving(true);
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
            pdf.save(`${templateName || 'template'}.pdf`);
            toast.success('PDF успешно сформирован');
        } catch (error) {
            console.error('PDF generation error:', error);
            toast.error('Ошибка при создании PDF');
        } finally {
            setIsSaving(false);
        }
    };

    const previewClientData = {
        name: 'Иванов Иван Иванович',
        legal_name: 'ИП Иванов И.И.',
        rep_position_nom: 'Индивидуальный предприниматель',
        rep_position_gen: 'Индивидуального предпринимателя',
        rep_name_nom: 'Иванов Иван Иванович',
        rep_name_gen: 'Иванова Ивана Ивановича',
        rep_name_short: 'Иванов И.И.',
        basis_of_authority: 'Свидетельства о гос. регистрации №123456789 от 01.01.2020',
        unp: '123456789',
        bank_details: 'р/с BY12ALFA30121234567890000000 в ЗАО "Альфа-Банк", БИК ALFABY2X',
        contact_person: 'Иванов И.И.',
        phone: '+375 (29) 123-45-67',
        email: 'ivanov@example.com'
    };

    const previewDocumentData = {
        contract_number: 'Д-2023-10-01',
        contract_date: '«01» октября 2023 г.',
        invoice_number: '20231001-ИИ-1',
        invoice_date: '«01» октября 2023 г.',
        contract_amount: '10 500,00 руб. (Десять тысяч пятьсот рублей 00 копеек)',
        amount_words: 'Десять тысяч пятьсот рублей 00 копеек',
        vat_amount: '1 750,00 руб.',
        vat_amount_words: 'Одна тысяча семьсот пятьдесят рублей 00 копеек',
        purchase_subject: 'Оборудование для умного дома',
        prepayment_percent: 50,
        delivery_days: '14',
        purchase_purpose: 'Для собственного потребления',
        funding_source: 'Собственные средства',
        payment_deadline_days: '5',
        // Raw values for calculations
        total_amount_value: 10500,
        total_vat_value: 1750
    };

    return (
        <div className="flex flex-col bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 shadow-sm" style={{ height: 'calc(100vh - 140px)' }}>
            <style>{`
                .prose { 
                    max-width: none !important; 
                    width: 100% !important;
                    word-break: normal !important;
                    overflow-wrap: normal !important;
                    -webkit-hyphens: none !important;
                    -ms-hyphens: none !important;
                    hyphens: none !important;
                    text-align: justify;
                    text-justify: inter-word;
                    white-space: pre-wrap !important;
                }
                .document-preview {
                    font-family: "Times New Roman", Times, serif !important;
                    font-size: 12pt !important;
                    line-height: 1.5 !important;
                    color: black !important;
                    -webkit-hyphens: none !important;
                    -ms-hyphens: none !important;
                    hyphens: none !important;
                    white-space: pre-wrap !important;
                    padding: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm !important;
                    width: 210mm !important;
                    min-height: 297mm !important;
                    background: white !important;
                    box-sizing: border-box !important;
                }
                .document-preview p {
                    margin-bottom: 0.5em;
                }
                .document-preview h1, .document-preview h2, .document-preview h3 {
                    margin-top: 1em;
                    margin-bottom: 0.5em;
                    font-weight: bold;
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
                .document-editor {
                    overflow: hidden !important;
                }
                .document-editor .ProseMirror:focus {
                    outline: none !important;
                }
            `}</style>
            {/* Header */}
            <div className="p-4 bg-white border-b border-slate-200 flex flex-col gap-4 shadow-sm sticky top-0 z-20">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <span className="material-icons-round text-blue-600">description</span>
                        Шаблоны договоров
                    </h2>
                    <div className="flex gap-2">
                        {selectedTemplateId && selectedTemplateId !== 'new' && !templates.find(t => t.id === selectedTemplateId)?.is_system && (
                            <Button 
                                onClick={handleDelete} 
                                variant="danger"
                                disabled={isSaving}
                                icon="delete"
                            >
                                Удалить
                            </Button>
                        )}
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
                            onClick={() => setShowPreview(!showPreview)} 
                            variant="secondary"
                            icon={showPreview ? "edit" : "visibility"}
                        >
                            {showPreview ? "Редактор" : "Предпросмотр"}
                        </Button>
                        <Button 
                            onClick={handleSave} 
                            loading={isSaving}
                            disabled={isLoading}
                            icon="save"
                            variant="primary"
                        >
                            Сохранить
                        </Button>
                    </div>
                </div>

                <div className="flex gap-4 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="w-1/3">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Выберите шаблон</label>
                        <select
                            value={selectedTemplateId}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'new') {
                                    handleCreateNew();
                                } else {
                                    const template = templates.find(t => t.id === val);
                                    if (template) handleSelectTemplate(template);
                                }
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            disabled={isLoading}
                        >
                            <option value="" disabled>-- Выберите шаблон --</option>
                            <optgroup label="Действия">
                                <option value="new">+ Создать новый шаблон</option>
                            </optgroup>
                            <optgroup label="Существующие шаблоны">
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.name || t.type} {t.is_system ? '(Системный)' : ''}
                                    </option>
                                ))}
                            </optgroup>
                        </select>
                    </div>
                    <div className="flex-grow">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Название шаблона</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                placeholder="Введите название шаблона..."
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:bg-slate-100 disabled:text-slate-400"
                                disabled={isLoading || (selectedTemplateId && templates.find(t => t.id === selectedTemplateId)?.is_system)}
                            />
                            {selectedTemplateId && templates.find(t => t.id === selectedTemplateId)?.is_system && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <span className="material-icons-round text-[12px]">lock</span>
                                    Системный
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-grow flex overflow-hidden">
                {/* Text Editor Area */}
                <div className="flex-grow p-6 overflow-y-auto relative bg-slate-100 flex flex-col items-center">
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : null}
                    
                    {showPreview ? (
                        <div 
                            id="template-preview-container"
                            className="w-[210mm] min-h-[297mm] bg-white shadow-lg prose max-w-none document-preview"
                            dangerouslySetInnerHTML={{ __html: replaceDocumentTags(content, previewClientData, previewDocumentData) }}
                        />
                    ) : (
                        <div className="w-[210mm] min-h-[297mm] bg-white shadow-lg flex flex-col document-editor">
                            <TiptapEditor 
                                ref={tiptapRef}
                                content={content} 
                                onChange={(html, json) => {
                                    setContent(html);
                                    setContentJson(json);
                                }}
                                className="flex-grow flex flex-col h-full border-none"
                                placeholder="Вставьте текст шаблона договора сюда..."
                            />
                        </div>
                    )}
                </div>

                {/* Tags Sidebar */}
                <div className="w-80 bg-white border-l border-slate-200 flex-shrink-0 flex flex-col h-full">
                    <div className="p-4 border-b border-slate-100 bg-white sticky top-0 z-10">
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Доступные тэги</h3>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Кликните на тэг, чтобы вставить его в позицию курсора.
                        </p>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto p-4 space-y-6">
                        <div className="pb-6 border-b border-slate-100">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 px-1">Поля страницы (мм)</h4>
                            <div className="grid grid-cols-2 gap-2 px-1">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold">Верх</label>
                                    <input 
                                        type="number" 
                                        value={marginTop} 
                                        onChange={(e) => setMarginTop(e.target.value)}
                                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold">Низ</label>
                                    <input 
                                        type="number" 
                                        value={marginBottom} 
                                        onChange={(e) => setMarginBottom(e.target.value)}
                                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold">Лево</label>
                                    <input 
                                        type="number" 
                                        value={marginLeft} 
                                        onChange={(e) => setMarginLeft(e.target.value)}
                                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold">Право</label>
                                    <input 
                                        type="number" 
                                        value={marginRight} 
                                        onChange={(e) => setMarginRight(e.target.value)}
                                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {TAG_GROUPS.map((group, gIdx) => (
                            <div key={gIdx}>
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 px-1">{group.title}</h4>
                                <div className="space-y-2">
                                    {group.items.map((t, idx) => (
                                        <div 
                                            key={idx} 
                                            className="group p-2.5 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all"
                                            onClick={() => handleInsertTag(t.tag)}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                                                    {t.tag}
                                                </span>
                                                <span className="material-icons text-slate-300 group-hover:text-blue-500 text-[14px]">
                                                    content_copy
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 group-hover:text-slate-700 leading-tight">
                                                {t.description}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
