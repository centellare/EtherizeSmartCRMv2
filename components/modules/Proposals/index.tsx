
import React, { useState } from 'react';
import { Button } from '../../ui';
import PriceManager from './PriceManager';
import CPGenerator from './CPGenerator';
import CPView from './CPView';
import ProposalList from './ProposalList';

const Proposals: React.FC<{ profile: any }> = ({ profile }) => {
  const [mode, setMode] = useState<'list' | 'catalog' | 'create' | 'edit' | 'view'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleView = (id: string) => {
    setSelectedId(id);
    setMode('view');
  };

  const handleEdit = (id: string) => {
    setSelectedId(id);
    setMode('edit');
  };

  if (mode === 'view' && selectedId) {
    return <CPView proposalId={selectedId} onClose={() => { setSelectedId(null); setMode('list'); }} />;
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-medium text-[#1c1b1f]">КП и Цены</h2>
          <p className="text-sm text-slate-500 mt-1">Коммерческие предложения и прайс-лист</p>
        </div>
        <div className="flex gap-2">
          {mode === 'list' && (
            <Button icon="add_card" onClick={() => setMode('create')}>Новое КП</Button>
          )}
        </div>
      </div>

      {(mode !== 'create' && mode !== 'edit') && (
        <div className="flex gap-2 mb-6 bg-slate-100 p-1.5 rounded-full w-fit">
          <button onClick={() => setMode('list')} className={`px-5 py-2 rounded-full text-xs font-bold uppercase transition-all ${mode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Все КП</button>
          <button onClick={() => setMode('catalog')} className={`px-5 py-2 rounded-full text-xs font-bold uppercase transition-all ${mode === 'catalog' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Прайс-лист</button>
        </div>
      )}

      {mode === 'list' && <ProposalList onView={handleView} onEdit={handleEdit} />}
      {mode === 'catalog' && <PriceManager profile={profile} />}
      
      {(mode === 'create' || mode === 'edit') && (
        <div className="bg-slate-50 rounded-[32px] p-2">
          <div className="flex justify-between items-center px-4 py-2">
            <h3 className="font-bold text-slate-700">{mode === 'edit' ? 'Редактирование КП' : 'Конструктор КП'}</h3>
          </div>
          <CPGenerator 
            profile={profile} 
            proposalId={mode === 'edit' ? selectedId : null}
            onSuccess={() => { setSelectedId(null); setMode('list'); }} 
            onCancel={() => { setSelectedId(null); setMode('list'); }} 
          />
        </div>
      )}
    </div>
  );
};

export default Proposals;
