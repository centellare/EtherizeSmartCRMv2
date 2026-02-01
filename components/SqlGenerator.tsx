
import React, { useState } from 'react';
import { TableSchema } from '../types';

interface SqlGeneratorProps { 
  schemas: TableSchema[]; 
}

/**
 * Чистый компонент для генерации базовой структуры БД.
 * Все старые патчи удалены по запросу.
 */
const SqlGenerator: React.FC<SqlGeneratorProps> = ({ schemas }) => {
  const [copied, setCopied] = useState(false);

  const generateBaseSql = () => {
    return `-- SmartHome CRM: Base Schema
-- Сгенерировано для инициализации чистой базы данных

${schemas.map(table => `
-- Таблица: ${table.name} (${table.description})
CREATE TABLE IF NOT EXISTS public.${table.name} (
    ${table.columns.map(col => {
      let def = `${col.name} ${col.type === 'uuid' ? 'UUID' : 'TEXT'}`;
      if (col.isPrimary) def += ' PRIMARY KEY';
      if (col.isForeign) def += ` REFERENCES public.${col.references}`;
      if (!col.isNullable && !col.isPrimary) def += ' NOT NULL';
      if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
      return def;
    }).join(',\n    ')}
);`).join('\n')}

-- Принудительное обновление кеша PostgREST
NOTIFY pgrst, 'reload schema';
`;
  };

  return (
    <div className="relative">
      <div className="absolute top-4 right-4 flex gap-2">
        <button 
          onClick={() => {
            navigator.clipboard.writeText(generateBaseSql());
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="px-4 py-2 bg-[#005ac1] text-white rounded-full text-xs font-bold transition-all shadow-lg flex items-center gap-2"
        >
          <span className="material-icons-round text-sm">content_copy</span>
          {copied ? 'СКОПИРОВАНО' : 'СКОПИРОВАТЬ ЧИСТЫЙ SQL'}
        </button>
      </div>
      <div className="bg-[#1c1b1f] p-8 rounded-[28px] border border-white/10 overflow-hidden flex flex-col max-h-[70vh]">
        <div className="flex items-center gap-2 mb-4 text-[#d3e4ff]">
          <span className="material-icons-round text-sm text-blue-400">storage</span>
          <span className="text-xs font-mono uppercase tracking-widest">Base Database Schema</span>
        </div>
        <pre className="overflow-x-auto text-[#d3e4ff] font-mono text-xs leading-relaxed scrollbar-hide opacity-80">
          {generateBaseSql()}
        </pre>
      </div>
    </div>
  );
};

export default SqlGenerator;
