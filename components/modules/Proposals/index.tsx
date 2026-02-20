
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui';
import CPGenerator from './CPGenerator';
import CPView from './CPView';
import ProposalList from './ProposalList';
import PriceManager from './PriceManager';
import FormSettings from './FormSettings';
import InvoiceView from './InvoiceView';
import InvoiceList from './InvoiceList';

const Proposals: React.FC<{ profile: any }> = ({ profile }) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'proposals' | 'invoices' | 'prices' | 'forms'>('proposals');
  const [mode, setMode] = useState<'list' | 'create' | 'edit' | 'view_cp' | 'view_invoice'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleViewCP = (id: string) => {
    setSelectedId(id);
    setMode('view_cp');
  };

  const handleViewInvoice = (id: string) => {
    setSelectedId(id);
    setMode('view_invoice');
  };

  const handleEdit = (id: string) => {
    setSelectedId(id);
    setMode('edit');
  };

  if (mode === 'view_cp' && selectedId) {
    return <CPView 
      proposalId={selectedId} 
      onClose={() => { setSelectedId(null); setMode('list'); }} 
      onInvoiceCreated={(invoiceId) => handleViewInvoice(invoiceId)}
    />;
  }

  if (mode === 'view_invoice' && selectedId) {
      return <InvoiceView invoiceId={selectedId} onClose={() => { setSelectedId(null); setMode('list'); }} />;
  }

  return (
    <div className="animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 shrink-0">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f]">КП и Цены</h2>
          <p className="text-sm text-slate-500 mt-1">Коммерческие предложения, счета и прайс-лист</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'proposals' && mode === 'list' && (
            <Button icon="add_card" onClick={() => setMode('create')}>Новое КП</Button>
          )}
        </div>
      </div>

      {(mode === 'list') && (
        <div className="flex gap-2 mb-6 bg-slate-100 p-1.5 rounded-full w-fit shrink-0 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('proposals')} 
            className={`px-6 py-2 rounded-full text-xs font-bold uppercase transition-all ${activeTab === 'proposals' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Все КП
          </button>
          <button 
            onClick={() => setActiveTab('invoices')} 
            className={`px-6 py-2 rounded-full text-xs font-bold uppercase transition-all ${activeTab === 'invoices' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Счета
          </button>
          <button 
            onClick={() => setActiveTab('prices')} 
            className={`px-6 py-2 rounded-full text-xs font-bold uppercase transition-all ${activeTab === 'prices' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Прайс-лист
          </button>
          <button 
            onClick={() => setActiveTab('forms')} 
            className={`px-6 py-2 rounded-full text-xs font-bold uppercase transition-all ${activeTab === 'forms' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Формы и Шаблоны
          </button>
        </div>
      )}

      <div className="flex-grow overflow-hidden flex flex-col">
        {activeTab === 'prices' && mode === 'list' ? (
          <PriceManager profile={profile} />
        ) : activeTab === 'forms' && mode === 'list' ? (
          <FormSettings profile={profile} />
        ) : activeTab === 'invoices' && mode === 'list' ? (
          <InvoiceList onView={handleViewInvoice} onViewCP={handleViewCP} />
        ) : (
          <>
            {mode === 'list' && <ProposalList onView={handleViewCP} onEdit={handleEdit} onViewInvoice={handleViewInvoice} />}
            
            {(mode === 'create' || mode === 'edit') && (
              <div className="bg-slate-50 rounded-[32px] p-2 h-full min-h-0 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center px-4 py-2 shrink-0">
                  <h3 className="font-bold text-slate-700">{mode === 'edit' ? 'Редактирование КП' : 'Конструктор КП'}</h3>
                </div>
                <div className="flex-grow overflow-hidden">
                  <CPGenerator 
                    profile={profile} 
                    proposalId={mode === 'edit' ? selectedId : null}
                    onSuccess={() => { 
                      setSelectedId(null); 
                      setMode('list'); 
                      queryClient.invalidateQueries({ queryKey: ['proposals'] });
                    }} 
                    onCancel={() => { setSelectedId(null); setMode('list'); }} 
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Proposals;
