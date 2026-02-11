
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Input, Toast } from '../../ui';
import { DocumentTemplate } from '../../../types';

const FormSettings: React.FC<{ profile: any }> = ({ profile }) => {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  const [cpTemplate, setCpTemplate] = useState<DocumentTemplate>({
      id: '', type: 'cp', header_text: '', footer_text: '', signatory_1: '', signatory_2: '', is_default: true
  });
  const [invoiceTemplate, setInvoiceTemplate] = useState<DocumentTemplate>({
      id: '', type: 'invoice', header_text: '', footer_text: '', signatory_1: '', signatory_2: '', is_default: true
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data } = await supabase.from('document_templates').select('*');
    if (data) {
        // Explicit casting to match local types
        const typedData = data as unknown as DocumentTemplate[];
        const cp = typedData.find(t => t.type === 'cp');
        const inv = typedData.find(t => t.type === 'invoice');
        if (cp) setCpTemplate(cp);
        if (inv) setInvoiceTemplate(inv);
        setTemplates(typedData);
    }
    setLoading(false);
  };

  const handleSave = async (type: 'cp' | 'invoice') => {
      setLoading(true);
      const template = type === 'cp' ? cpTemplate : invoiceTemplate;
      
      try {
          if (template.id) {
              const { error } = await supabase.from('document_templates').update({
                  header_text: template.header_text,
                  footer_text: template.footer_text,
                  signatory_1: template.signatory_1,
                  signatory_2: template.signatory_2
              }).eq('id', template.id);
              if (error) throw error;
          } else {
              const { error } = await supabase.from('document_templates').insert([{
                  type,
                  header_text: template.header_text,
                  footer_text: template.footer_text,
                  signatory_1: template.signatory_1,
                  signatory_2: template.signatory_2
              }]);
              if (error) throw error;
          }
          setToast({ message: 'Настройки шаблона сохранены', type: 'success' });
          fetchTemplates();
      } catch (e: any) {
          setToast({ message: 'Ошибка сохранения: ' + e.message, type: 'error' });
      }
      setLoading(false);
  };

  return (
    <div className="h-full overflow-y-auto pb-20 scrollbar-hide animate-in fade-in duration-500">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* CP SETTINGS */}
          <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-900">Форма КП</h3>
                  <Button onClick={() => handleSave('cp')} loading={loading} icon="save" className="h-9 px-4 text-xs">Сохранить</Button>
              </div>
              
              <div className="space-y-4">
                  <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Текст в шапке (вступление)</label>
                      <textarea 
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:border-blue-500 outline-none min-h-[100px]"
                          value={cpTemplate.header_text}
                          onChange={(e) => setCpTemplate({...cpTemplate, header_text: e.target.value})}
                      />
                  </div>
                  <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Текст в подвале (примечания)</label>
                      <textarea 
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:border-blue-500 outline-none min-h-[100px]"
                          value={cpTemplate.footer_text}
                          onChange={(e) => setCpTemplate({...cpTemplate, footer_text: e.target.value})}
                      />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <Input label="Подпись 1 (Слева)" value={cpTemplate.signatory_1} onChange={(e: any) => setCpTemplate({...cpTemplate, signatory_1: e.target.value})} placeholder="Напр: Менеджер" />
                      <Input label="Подпись 2 (Справа)" value={cpTemplate.signatory_2} onChange={(e: any) => setCpTemplate({...cpTemplate, signatory_2: e.target.value})} placeholder="Напр: Директор" />
                  </div>
              </div>
          </div>

          {/* INVOICE SETTINGS */}
          <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-900">Форма Счета</h3>
                  <Button onClick={() => handleSave('invoice')} loading={loading} icon="save" className="h-9 px-4 text-xs">Сохранить</Button>
              </div>
              
              <div className="space-y-4">
                  <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Текст в шапке (условия)</label>
                      <textarea 
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:border-blue-500 outline-none min-h-[100px]"
                          value={invoiceTemplate.header_text}
                          onChange={(e) => setInvoiceTemplate({...invoiceTemplate, header_text: e.target.value})}
                      />
                  </div>
                  <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Текст в подвале (дополнительно)</label>
                      <textarea 
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:border-blue-500 outline-none min-h-[100px]"
                          value={invoiceTemplate.footer_text}
                          onChange={(e) => setInvoiceTemplate({...invoiceTemplate, footer_text: e.target.value})}
                      />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <Input label="Подпись 1 (Руководитель)" value={invoiceTemplate.signatory_1} onChange={(e: any) => setInvoiceTemplate({...invoiceTemplate, signatory_1: e.target.value})} />
                      <Input label="Подпись 2 (Бухгалтер)" value={invoiceTemplate.signatory_2} onChange={(e: any) => setInvoiceTemplate({...invoiceTemplate, signatory_2: e.target.value})} />
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default FormSettings;
