
import React, { useState } from 'react';
import { TableSchema } from '../types';
import { MIGRATION_SQL_V10 } from '../constants';

interface SqlGeneratorProps { 
  schemas: TableSchema[]; 
}

const SqlGenerator: React.FC<SqlGeneratorProps> = ({ schemas }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(MIGRATION_SQL_V10);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-[24px] border border-purple-200 shadow-sm">
        <h3 className="text-lg font-bold text-purple-900 mb-2 flex items-center gap-2">
          <span className="material-icons-round text-purple-600">edit_document</span>
          Обновление базы данных (v10.0)
        </h3>
        <div className="text-sm text-purple-800 mb-4 leading-relaxed bg-white/50 p-4 rounded-xl border border-purple-100">
          <p className="font-bold mb-2">Этот скрипт добавляет возможность кастомизации документов:</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Добавляет поля <b>preamble</b> и <b>footer</b> в таблицы КП и Счетов.</li>
            <li>Позволяет добавлять произвольный текст в начало и конец документов.</li>
          </ul>
        </div>
        
        <div className="relative group">
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={handleCopy}
              className="px-4 py-2 bg-purple-600 text-white rounded-full text-xs font-bold transition-all shadow-lg flex items-center gap-2 hover:bg-purple-700 hover:scale-105 active:scale-95"
            >
              <span className="material-icons-round text-sm">{copied ? 'check' : 'content_copy'}</span>
              {copied ? 'СКОПИРОВАНО' : 'КОПИРОВАТЬ SQL'}
            </button>
          </div>
          <div className="bg-[#1e1e1e] p-6 rounded-[20px] border border-slate-800 overflow-hidden shadow-inner">
            <pre className="overflow-x-auto text-[#a5d6ff] font-mono text-xs leading-relaxed scrollbar-hide whitespace-pre-wrap max-h-[400px]">
              {MIGRATION_SQL_V10}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SqlGenerator;
