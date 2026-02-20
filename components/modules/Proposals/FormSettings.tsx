
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Input, useToast } from '../../ui';
import { DocumentTemplate } from '../../../types';

const FormSettings: React.FC<{ profile: any }> = ({ profile }) => {
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  
  // Company Settings
  const [companySettings, setCompanySettings] = useState({
      id: '',
      company_name: 'ООО "РАЦИО ДОМУС"',
      requisites: 'Адрес: БЕЛАРУСЬ, Г. МИНСК, УЛ. Ф.СКОРИНЫ, ДОМ 14, ОФ. 117, 220076\nУНП: 193736741',
      bank_details: "Карт-счет: BY82ALFA30122E47040010270000 в BYN в ЗАО 'Альфа-Банк', БИК: ALFABY2X",
      logo_url: ''
  });

  // Templates
  const [cpTemplate, setCpTemplate] = useState<DocumentTemplate>({
      id: '', type: 'cp', header_text: '', footer_text: '', signatory_1: '', signatory_2: '', is_default: true
  });
  const [invoiceTemplate, setInvoiceTemplate] = useState<DocumentTemplate>({
      id: '', type: 'invoice', header_text: '', footer_text: '', signatory_1: '', signatory_2: '', is_default: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Fetch Company Settings
    const { data: settings } = await supabase.from('company_settings').select('*').limit(1).maybeSingle();
    if (settings) {
        setCompanySettings({
            id: settings.id,
            company_name: settings.company_name || '',
            requisites: settings.requisites || '',
            bank_details: settings.bank_details || '',
            logo_url: (settings as any).logo_url || ''
        });
    }

    // Fetch Templates
    const { data: tmpl } = await supabase.from('document_templates').select('*');
    if (tmpl) {
        const typedData = tmpl as unknown as DocumentTemplate[];
        const cp = typedData.find(t => t.type === 'cp');
        const inv = typedData.find(t => t.type === 'invoice');
        if (cp) setCpTemplate(cp);
        if (inv) setInvoiceTemplate(inv);
    }
    setLoading(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      setLoading(true);
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `company/${fileName}`;

      try {
          const { error: uploadError } = await supabase.storage
              .from('Etherize')
              .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data } = supabase.storage.from('Etherize').getPublicUrl(filePath);
          
          setCompanySettings(prev => ({ ...prev, logo_url: data.publicUrl }));
          toast.success('Логотип загружен');
      } catch (error: any) {
          toast.error('Ошибка загрузки: ' + error.message);
      } finally {
          setLoading(false);
      }
  };

  const handleSaveCompany = async () => {
      setLoading(true);
      try {
          if (companySettings.id) {
              await supabase.from('company_settings').update({
                  company_name: companySettings.company_name,
                  requisites: companySettings.requisites,
                  bank_details: companySettings.bank_details,
                  // @ts-ignore
                  logo_url: companySettings.logo_url
              }).eq('id', companySettings.id);
          } else {
              await supabase.from('company_settings').insert([{
                  company_name: companySettings.company_name,
                  requisites: companySettings.requisites,
                  bank_details: companySettings.bank_details,
                  // @ts-ignore
                  logo_url: companySettings.logo_url,
                  default_vat_percent: 20
              }]);
          }
          toast.success('Реквизиты сохранены');
          fetchData();
      } catch (e: any) {
          toast.error('Ошибка: ' + e.message);
      } finally {
          setLoading(false);
      }
  };

  const handleSaveTemplate = async (type: 'cp' | 'invoice') => {
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
          toast.success('Шаблон сохранен');
          fetchData();
      } catch (e: any) {
          toast.error('Ошибка: ' + e.message);
      }
      setLoading(false);
  };

  return (
    <div className="h-full overflow-y-auto pb-20 scrollbar-hide animate-in fade-in duration-500">
      
      {/* COMPANY DETAILS */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm mb-8">
          <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900">Реквизиты Компании</h3>
              <Button onClick={handleSaveCompany} loading={loading} icon="save">Сохранить реквизиты</Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                  <Input label="Название компании" value={companySettings.company_name} onChange={(e:any) => setCompanySettings({...companySettings, company_name: e.target.value})} />
                  <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Реквизиты (Адрес, УНП)</label>
                      <textarea 
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:border-blue-500 outline-none min-h-[80px]"
                          value={companySettings.requisites}
                          onChange={(e) => setCompanySettings({...companySettings, requisites: e.target.value})}
                      />
                  </div>
                  <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Банковские данные</label>
                      <textarea 
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:border-blue-500 outline-none min-h-[80px]"
                          value={companySettings.bank_details}
                          onChange={(e) => setCompanySettings({...companySettings, bank_details: e.target.value})}
                      />
                  </div>
              </div>

              <div className="space-y-4">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Логотип (в шапку)</p>
                  <div className="flex items-start gap-6">
                      <div className="w-32 h-32 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden relative group">
                          {companySettings.logo_url ? (
                              <img src={companySettings.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
                          ) : (
                              <span className="text-slate-300 text-xs text-center p-2">Нет логотипа</span>
                          )}
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <label className="cursor-pointer text-white text-xs font-bold flex flex-col items-center">
                                  <span className="material-icons-round mb-1">upload</span>
                                  Загрузить
                                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                              </label>
                          </div>
                      </div>
                      <div className="flex-1 text-xs text-slate-500">
                          <p className="mb-2">Загрузите логотип вашей компании. Он будет отображаться в левом верхнем углу всех документов (КП и Счета).</p>
                          <p>Рекомендуемый формат: PNG с прозрачным фоном.</p>
                          <div className="mt-4">
                              <Input label="Или укажите URL вручную" value={companySettings.logo_url} onChange={(e:any) => setCompanySettings({...companySettings, logo_url: e.target.value})} />
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* TEMPLATES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* CP SETTINGS */}
          <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-900">Тексты для КП</h3>
                  <Button onClick={() => handleSaveTemplate('cp')} loading={loading} icon="save" variant="tonal" className="h-9 px-4 text-xs">Сохранить</Button>
              </div>
              
              <div className="space-y-4">
                  <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Текст в шапке</label>
                      <textarea 
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:border-blue-500 outline-none min-h-[100px]"
                          value={cpTemplate.header_text}
                          onChange={(e) => setCpTemplate({...cpTemplate, header_text: e.target.value})}
                          placeholder="Вступление, приветствие..."
                      />
                  </div>
                  <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Текст в подвале</label>
                      <textarea 
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:border-blue-500 outline-none min-h-[100px]"
                          value={cpTemplate.footer_text}
                          onChange={(e) => setCpTemplate({...cpTemplate, footer_text: e.target.value})}
                          placeholder="Сроки действия, условия..."
                      />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <Input label="Подпись 1" value={cpTemplate.signatory_1} onChange={(e: any) => setCpTemplate({...cpTemplate, signatory_1: e.target.value})} />
                      <Input label="Подпись 2" value={cpTemplate.signatory_2} onChange={(e: any) => setCpTemplate({...cpTemplate, signatory_2: e.target.value})} />
                  </div>
              </div>
          </div>

          {/* INVOICE SETTINGS */}
          <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-900">Тексты для Счета</h3>
                  <Button onClick={() => handleSaveTemplate('invoice')} loading={loading} icon="save" variant="tonal" className="h-9 px-4 text-xs">Сохранить</Button>
              </div>
              
              <div className="space-y-4">
                  <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Условия поставки (шапка)</label>
                      <textarea 
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:border-blue-500 outline-none min-h-[100px]"
                          value={invoiceTemplate.header_text}
                          onChange={(e) => setInvoiceTemplate({...invoiceTemplate, header_text: e.target.value})}
                      />
                  </div>
                  <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Дополнительно (подвал)</label>
                      <textarea 
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:border-blue-500 outline-none min-h-[100px]"
                          value={invoiceTemplate.footer_text}
                          onChange={(e) => setInvoiceTemplate({...invoiceTemplate, footer_text: e.target.value})}
                      />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <Input label="Подпись 1" value={invoiceTemplate.signatory_1} onChange={(e: any) => setInvoiceTemplate({...invoiceTemplate, signatory_1: e.target.value})} />
                      <Input label="Подпись 2" value={invoiceTemplate.signatory_2} onChange={(e: any) => setInvoiceTemplate({...invoiceTemplate, signatory_2: e.target.value})} />
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default FormSettings;
