
import React, { useState } from 'react';
import { TableSchema } from '../types';
import { MIGRATION_SQL_V2 } from '../constants';

interface SqlGeneratorProps { 
  schemas: TableSchema[]; 
}

const SqlGenerator: React.FC<SqlGeneratorProps> = ({ schemas }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(MIGRATION_SQL_V2);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 p-6 rounded-[24px] border border-amber-200">
        <h3 className="text-lg font-bold text-amber-900 mb-2 flex items-center gap-2">
          <span className="material-icons-round">warning</span>
          Миграция на ERP 2.0 (Единый Каталог)
        </h3>
        <p className="text-sm text-amber-800 mb-4">
          Для объединения склада и прайс-листа в единую систему, а также добавления настроек компании, 
          необходимо выполнить этот скрипт. 
          <br/><strong>ВНИМАНИЕ:</strong> Скрипт очистит текущие тестовые данные в каталогах!
        </p>
        
        <div className="relative">
          <div className="absolute top-4 right-4">
            <button 
              onClick={handleCopy}
              className="px-4 py-2 bg-amber-600 text-white rounded-full text-xs font-bold transition-all shadow-lg flex items-center gap-2 hover:bg-amber-700"
            >
              <span className="material-icons-round text-sm">content_copy</span>
              {copied ? 'СКОПИРОВАНО' : 'КОПИРОВАТЬ SQL'}
            </button>
          </div>
          <div className="bg-[#1c1b1f] p-6 rounded-[20px] border border-amber-900/20 overflow-hidden">
            <pre className="overflow-x-auto text-[#d3e4ff] font-mono text-xs leading-relaxed scrollbar-hide whitespace-pre-wrap max-h-[400px]">
              {MIGRATION_SQL_V2}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SqlGenerator;
