
import React, { useState } from 'react';
import { TableSchema } from '../types';
import { MIGRATION_SQL_V10, MIGRATION_SQL_V11 } from '../constants';

interface SqlGeneratorProps { 
  schemas: TableSchema[]; 
}

const SqlGenerator: React.FC<SqlGeneratorProps> = ({ schemas }) => {
  const [copiedV11, setCopiedV11] = useState(false);
  const [copiedV10, setCopiedV10] = useState(false);

  const handleCopyV11 = () => {
    navigator.clipboard.writeText(MIGRATION_SQL_V11);
    setCopiedV11(true);
    setTimeout(() => setCopiedV11(false), 2000);
  };

  const handleCopyV10 = () => {
    navigator.clipboard.writeText(MIGRATION_SQL_V10);
    setCopiedV10(true);
    setTimeout(() => setCopiedV10(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* V11 Security Update */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-[24px] border border-amber-200 shadow-sm">
        <h3 className="text-lg font-bold text-amber-900 mb-2 flex items-center gap-2">
          <span className="material-icons-round text-amber-600">security</span>
          Обновление безопасности (v11.0)
        </h3>
        <div className="text-sm text-amber-800 mb-4 leading-relaxed bg-white/50 p-4 rounded-xl border border-amber-100">
          <p className="font-bold mb-2">Этот скрипт добавляет систему подтверждения пользователей:</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Добавляет поле <b>is_approved</b> в профили.</li>
            <li>Блокирует доступ неподтвержденным пользователям.</li>
            <li>Добавляет функции для смены пароля/email администратором.</li>
          </ul>
        </div>
        
        <div className="relative group">
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={handleCopyV11}
              className="px-4 py-2 bg-amber-600 text-white rounded-full text-xs font-bold transition-all shadow-lg flex items-center gap-2 hover:bg-amber-700 hover:scale-105 active:scale-95"
            >
              <span className="material-icons-round text-sm">{copiedV11 ? 'check' : 'content_copy'}</span>
              {copiedV11 ? 'СКОПИРОВАНО' : 'КОПИРОВАТЬ SQL'}
            </button>
          </div>
          <div className="bg-[#1e1e1e] p-6 rounded-[20px] border border-slate-800 overflow-hidden shadow-inner">
            <pre className="overflow-x-auto text-[#ffdca5] font-mono text-xs leading-relaxed scrollbar-hide whitespace-pre-wrap max-h-[400px]">
              {MIGRATION_SQL_V11}
            </pre>
          </div>
        </div>
      </div>

      {/* V10 Document Customization */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-[24px] border border-purple-200 shadow-sm opacity-75 hover:opacity-100 transition-opacity">
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
              onClick={handleCopyV10}
              className="px-4 py-2 bg-purple-600 text-white rounded-full text-xs font-bold transition-all shadow-lg flex items-center gap-2 hover:bg-purple-700 hover:scale-105 active:scale-95"
            >
              <span className="material-icons-round text-sm">{copiedV10 ? 'check' : 'content_copy'}</span>
              {copiedV10 ? 'СКОПИРОВАНО' : 'КОПИРОВАТЬ SQL'}
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
