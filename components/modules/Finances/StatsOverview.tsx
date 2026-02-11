
import React from 'react';

interface StatCardProps {
  label: string;
  val: string;
  subVal?: string;
  color: 'emerald' | 'red' | 'blue' | 'slate';
  active: boolean;
  onClick: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ label, val, subVal, color, active, onClick }) => (
  <div onClick={onClick} className={`p-5 rounded-[24px] border transition-all cursor-pointer hover:shadow-md ${active ? 'bg-[#d3e4ff] border-[#005ac1]' : 'bg-white border-slate-200'}`}>
    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-widest">{label}</p>
    <p className={`text-lg font-bold ${active ? 'text-[#001d3d]' : color === 'emerald' ? 'text-emerald-600' : color === 'red' ? 'text-red-600' : color === 'blue' ? 'text-blue-600' : 'text-slate-900'}`}>{val}</p>
    {subVal && <p className={`text-[9px] font-bold uppercase mt-1 ${active ? 'text-[#005ac1]/70' : 'text-slate-400'}`}>{subVal}</p>}
  </div>
);

interface StatsOverviewProps {
  summary: {
    balance: number;
    incomeTotal: number;
    planned: number;
    debtors: number;
    expensesApproved: number;
    expensesPendingSum: number;
    expensesPendingCount: number;
  };
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
  isSpecialist: boolean;
  formatCurrency: (val: number) => string;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ summary, activeFilter, onFilterChange, isSpecialist, formatCurrency }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {!isSpecialist && (
        <StatCard 
            label="Баланс" 
            val={formatCurrency(summary.balance)} 
            color={summary.balance >= 0 ? 'emerald' : 'red'} 
            active={!activeFilter} 
            onClick={() => onFilterChange(null)} 
        />
        )}
        {!isSpecialist && (
        <>
            <StatCard label="Приходы" val={formatCurrency(summary.incomeTotal)} color="slate" active={activeFilter === 'income'} onClick={() => onFilterChange(activeFilter === 'income' ? null : 'income')} />
            <StatCard label="Планируемые" val={formatCurrency(summary.planned)} color="blue" active={activeFilter === 'planned'} onClick={() => onFilterChange(activeFilter === 'planned' ? null : 'planned')} />
            <StatCard label="Дебиторка" val={formatCurrency(summary.debtors)} color="red" active={activeFilter === 'debtors'} onClick={() => onFilterChange(activeFilter === 'debtors' ? null : 'debtors')} />
        </>
        )}
        <StatCard 
        label="Расходы" 
        val={formatCurrency(summary.expensesApproved)} 
        subVal={`${formatCurrency(summary.expensesPendingSum)} (${summary.expensesPendingCount})`}
        color="red" 
        active={activeFilter === 'expenses'} 
        onClick={() => onFilterChange(activeFilter === 'expenses' ? null : 'expenses')} 
        />
    </div>
  );
};
