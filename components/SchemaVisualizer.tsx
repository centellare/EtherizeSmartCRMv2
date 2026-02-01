
import React from 'react';
import { TableSchema } from '../types';

interface SchemaVisualizerProps {
  schemas: TableSchema[];
}

const SchemaVisualizer: React.FC<SchemaVisualizerProps> = ({ schemas }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
      {schemas.map((table) => (
        <div key={table.name} className="glass rounded-xl overflow-hidden flex flex-col">
          <div className="bg-blue-600/30 px-4 py-2 border-b border-blue-500/30 flex justify-between items-center">
            <h3 className="font-bold text-blue-300">TABLE {table.name}</h3>
            <span className="text-[10px] bg-blue-900/50 px-2 py-1 rounded text-blue-200 uppercase tracking-widest">
              Supabase
            </span>
          </div>
          <div className="p-4 flex-grow">
            <p className="text-sm text-slate-400 mb-4 italic">{table.description}</p>
            <div className="space-y-2">
              {table.columns.map((col) => (
                <div key={col.name} className="flex justify-between items-start border-b border-slate-700/50 pb-1">
                  <div>
                    <span className={`text-sm ${col.isPrimary ? 'text-amber-400' : 'text-slate-200'}`}>
                      {col.isPrimary && '🔑 '}{col.name}
                    </span>
                    {col.isForeign && (
                      <div className="text-[10px] text-emerald-400 font-mono">
                        FK {'->'} {col.references}
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-mono text-slate-500">{col.type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SchemaVisualizer;
