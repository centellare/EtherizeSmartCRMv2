
import React, { useState } from 'react';
import { TableSchema } from '../types';
import { MIGRATION_SQL_V9 } from '../constants';

interface SqlGeneratorProps { 
  schemas: TableSchema[]; 
}

const SqlGenerator: React.FC<SqlGeneratorProps> = ({ schemas }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(MIGRATION_SQL_V9);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-[24px] border border-blue-200 shadow-sm">
        <h3 className="text-lg font-bold text-blue-900 mb-2 flex items-center gap-2">
          <span className="material-icons-round text-blue-600">send</span>
          Обновление базы данных (v9.0)
        </h3>
        <div className="text-sm text-blue-800 mb-4 leading-relaxed bg-white/50 p-4 rounded-xl border border-blue-100">
          <p className="font-bold mb-2">Этот скрипт добавляет поддержку Telegram уведомлений:</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Добавляет поле <b>telegram_chat_id</b> в таблицу профилей.</li>
            <li>Позволяет отправлять уведомления в Telegram.</li>
          </ul>
        </div>
        
        <div className="relative group">
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={handleCopy}
              className="px-4 py-2 bg-blue-600 text-white rounded-full text-xs font-bold transition-all shadow-lg flex items-center gap-2 hover:bg-blue-700 hover:scale-105 active:scale-95"
            >
              <span className="material-icons-round text-sm">{copied ? 'check' : 'content_copy'}</span>
              {copied ? 'СКОПИРОВАНО' : 'КОПИРОВАТЬ SQL'}
            </button>
          </div>
          <div className="bg-[#1e1e1e] p-6 rounded-[20px] border border-slate-800 overflow-hidden shadow-inner">
            <pre className="overflow-x-auto text-[#a5d6ff] font-mono text-xs leading-relaxed scrollbar-hide whitespace-pre-wrap max-h-[400px]">
              {MIGRATION_SQL_V9}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SqlGenerator;
