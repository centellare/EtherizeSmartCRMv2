import React from 'react';

interface FinanceWidgetProps {
  label: string;
  value: string;
  subValue?: string;
  color: string;
  icon: string;
  onClick?: () => void;
  isActive?: boolean;
  count?: number;
}

export const FinanceWidget: React.FC<FinanceWidgetProps> = ({ 
  label, 
  value, 
  subValue, 
  color, 
  icon, 
  onClick, 
  isActive, 
  count 
}) => (
  <div 
    onClick={onClick}
    className={`p-4 rounded-2xl border shadow-sm flex flex-col justify-between h-24 relative overflow-hidden group cursor-pointer transition-all ${
        isActive 
        ? 'bg-slate-800 border-slate-900 ring-2 ring-slate-200' 
        : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'
    }`}
  >
    <div className={`absolute top-0 right-0 p-3 transition-opacity ${isActive ? 'opacity-20 text-white' : `opacity-10 group-hover:opacity-20 ${color}`}`}>
        <span className="material-icons-round text-4xl">{icon}</span>
    </div>
    <p className={`text-[10px] font-bold uppercase tracking-widest z-10 ${isActive ? 'text-slate-400' : 'text-slate-400'}`}>{label}</p>
    <div className="z-10">
        <div className="flex items-baseline gap-2">
            <p className={`text-xl font-bold ${isActive ? 'text-white' : color.replace('bg-', 'text-').replace('/20', '')}`}>{value}</p>
            {count !== undefined && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isActive ? 'bg-slate-600 text-slate-200' : 'bg-slate-100 text-slate-500'}`}>
                    {count} шт
                </span>
            )}
        </div>
        {subValue && <p className={`text-[10px] mt-0.5 ${isActive ? 'text-slate-400' : 'text-slate-400'}`}>{subValue}</p>}
    </div>
  </div>
);
