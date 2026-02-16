
import React, { useState } from 'react';
import { TableSchema } from '../types';
import { MIGRATION_SQL_V5 } from '../constants';

interface SqlGeneratorProps { 
  schemas: TableSchema[]; 
}

const SqlGenerator: React.FC<SqlGeneratorProps> = ({ schemas }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(MIGRATION_SQL_V5);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-[24px] border border-indigo-200 shadow-sm">
        <h3 className="text-lg font-bold text-indigo-900 mb-2 flex items-center gap-2">
          <span className="material-icons-round text-indigo-600">build_circle</span>
          Обновление базы (v5.0): Исправление Хронологии
        </h3>
        <p className="text-sm text-indigo-800 mb-4 leading-relaxed">
          Этот скрипт восстанавливает связи таблиц и права доступа.
          <br/>
          <strong>Обязательно выполните его, если заметки добавляются, но не отображаются в списке.</strong>
        </p>
        
        <div className="relative group">
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={handleCopy}
              className="px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-bold transition-all shadow-lg flex items-center gap-2 hover:bg-indigo-700 hover:scale-105 active:scale-95"
            >
              <span className="material-icons-round text-sm">{copied ? 'check' : 'content_copy'}</span>
              {copied ? 'СКОПИРОВАНО' : 'КОПИРОВАТЬ SQL'}
            </button>
          </div>
          <div className="bg-[#1e1e1e] p-6 rounded-[20px] border border-slate-800 overflow-hidden shadow-inner">
            <pre className="overflow-x-auto text-[#a5d6ff] font-mono text-xs leading-relaxed scrollbar-hide whitespace-pre-wrap max-h-[400px]">
              {MIGRATION_SQL_V5}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SqlGenerator;
