import React, { useState, useEffect, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { supabase } from '../../../lib/supabase';
import { Button, Select, useToast } from '../../ui';
import { replaceDocumentTags } from '../../../lib/formatUtils';

const TEMPLATE_TYPES = [
  { value: 'individual_100', label: 'Физлицо 100%' },
  { value: 'individual_partial', label: 'Физлицо Частичная' },
  { value: 'legal_100', label: 'Юрлицо 100%' },
  { value: 'legal_partial', label: 'Юрлицо Частичная' }
];

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
    title: 'Договор',
    items: [
      { tag: '{{contract_number}}', description: 'Номер договора' },
      { tag: '{{contract_date}}', description: 'Дата договора' },
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
    const [selectedType, setSelectedType] = useState(TEMPLATE_TYPES[0].value);
    const [content, setContent] = useState('');
    const [templateId, setTemplateId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    
    const quillRef = useRef<ReactQuill>(null);
    const toast = useToast();

    useEffect(() => {
        const fetchTemplate = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await (supabase as any)
                    .from('contract_templates')
                    .select('*')
                    .eq('type', selectedType)
                    .maybeSingle();
                
                if (error && error.code !== 'PGRST116') throw error;
                
                if (data) {
                    setContent(data.content || '');
                    setTemplateId(data.id);
                } else {
                    setContent('');
                    setTemplateId(null);
                }
            } catch (error: any) {
                console.error('Error fetching template:', error);
                toast.error('Ошибка при загрузке шаблона');
            } finally {
                setIsLoading(false);
            }
        };

        fetchTemplate();
    }, [selectedType]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (templateId) {
                const { error } = await (supabase as any)
                    .from('contract_templates')
                    .update({ content })
                    .eq('id', templateId);
                if (error) throw error;
            } else {
                const { data, error } = await (supabase as any)
                    .from('contract_templates')
                    .insert([{ type: selectedType, content }])
                    .select()
                    .single();
                if (error) throw error;
                if (data) setTemplateId(data.id);
            }
            toast.success('Шаблон успешно сохранен');
        } catch (error: any) {
            console.error('Error saving template:', error);
            toast.error('Ошибка при сохранении шаблона');
        } finally {
            setIsSaving(false);
        }
    };

    const handleInsertTag = (tag: string) => {
        const editor = quillRef.current?.getEditor();
        if (!editor) {
            navigator.clipboard.writeText(tag);
            toast.success(`Тэг ${tag} скопирован в буфер обмена`);
            return;
        }

        const range = editor.getSelection(true);
        if (range) {
            editor.insertText(range.index, tag);
            editor.setSelection(range.index + tag.length, 0);
        } else {
            const length = editor.getLength();
            editor.insertText(length, tag);
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
                    overflow-wrap: break-word !important;
                    hyphens: manual !important;
                }
                .prose p {
                    margin-bottom: 0.5em;
                    line-height: 1.5;
                }
                .prose h1, .prose h2, .prose h3 {
                    margin-top: 1em;
                    margin-bottom: 0.5em;
                    font-weight: bold;
                }
                .ql-align-center { text-align: center; }
                .ql-align-right { text-align: right; }
                .ql-align-justify { text-align: justify; }
            `}</style>
            {/* Header */}
            <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-slate-800">Шаблоны договоров</h2>
                    <div className="w-64">
                        <Select
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            options={TEMPLATE_TYPES}
                        />
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button 
                        onClick={() => setShowPreview(!showPreview)} 
                        variant={showPreview ? "primary" : "secondary"}
                        icon={showPreview ? "edit" : "visibility"}
                    >
                        {showPreview ? "Редактировать" : "Предпросмотр"}
                    </Button>
                    <Button 
                        onClick={handleSave} 
                        loading={isSaving}
                        icon="save"
                    >
                        Сохранить шаблон
                    </Button>
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
                            className="w-[210mm] min-h-[297mm] bg-white shadow-lg p-[20mm_15mm] prose max-w-none font-serif"
                            dangerouslySetInnerHTML={{ __html: replaceDocumentTags(content, previewClientData, previewDocumentData) }}
                        />
                    ) : (
                        <div className="w-[210mm] min-h-[297mm] bg-white shadow-lg flex flex-col">
                            <ReactQuill 
                                ref={quillRef}
                                theme="snow" 
                                value={content} 
                                onChange={setContent}
                                modules={modules}
                                className="flex-grow flex flex-col h-full font-serif"
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
