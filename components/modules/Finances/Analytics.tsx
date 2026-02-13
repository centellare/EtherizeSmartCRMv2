
import React, { useState, useMemo } from 'react';
import { Transaction } from '../../../types';

interface AnalyticsProps {
  transactions: Transaction[];
  formatCurrency: (val: number) => string;
}

export const Analytics: React.FC<AnalyticsProps> = ({ transactions, formatCurrency }) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // 1. Calculate Opening Balance (Everything before Jan 1 of selected year)
  const openingBalance = useMemo(() => {
    return transactions.reduce((sum, t) => {
        const tYear = new Date(t.created_at).getFullYear();
        if (tYear < selectedYear) {
            const income = t.type === 'income' ? (t.fact_amount || 0) : 0;
            const expense = t.type === 'expense' && t.status === 'approved' ? t.amount : 0;
            return sum + (income - expense);
        }
        return sum;
    }, 0);
  }, [transactions, selectedYear]);

  // 2. Calculate Monthly Data for Selected Year
  const yearData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({ 
        index: i, 
        label: new Date(0, i).toLocaleString('ru', { month: 'short' }),
        income: 0,
        expense: 0
    }));

    transactions.forEach(t => {
        const date = new Date(t.created_at);
        if (date.getFullYear() === selectedYear) {
            const mIndex = date.getMonth();
            if (t.type === 'income') {
                months[mIndex].income += (t.fact_amount || 0);
            } else if (t.type === 'expense' && t.status === 'approved') {
                months[mIndex].expense += t.amount;
            }
        }
    });

    return months;
  }, [transactions, selectedYear]);

  // 3. Yearly Totals
  const totals = useMemo(() => {
      const inc = yearData.reduce((s, m) => s + m.income, 0);
      const exp = yearData.reduce((s, m) => s + m.expense, 0);
      return { income: inc, expense: exp, profit: inc - exp };
  }, [yearData]);

  const closingBalance = openingBalance + totals.profit;
  const maxVal = Math.max(...yearData.map(m => Math.max(m.income, m.expense)), 1000);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        {/* Year Selector */}
        <div className="flex justify-center">
            <div className="bg-slate-100 p-1 rounded-2xl flex gap-1">
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(year => (
                    <button 
                        key={year}
                        onClick={() => setSelectedYear(year)}
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${selectedYear === year ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        {year}
                    </button>
                ))}
            </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-[24px] border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Входящий остаток (1 янв)</p>
                <p className="text-xl font-bold text-slate-800">{formatCurrency(openingBalance)}</p>
                <div className="h-1 w-full bg-slate-100 mt-3 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-400 w-full opacity-30"></div>
                </div>
            </div>

            <div className="bg-white p-5 rounded-[24px] border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Приход за год</p>
                <p className="text-xl font-bold text-emerald-600">+{formatCurrency(totals.income)}</p>
                <div className="h-1 w-full bg-slate-100 mt-3 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: '100%' }}></div>
                </div>
            </div>

            <div className="bg-white p-5 rounded-[24px] border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Расход за год</p>
                <p className="text-xl font-bold text-red-500">-{formatCurrency(totals.expense)}</p>
                <div className="h-1 w-full bg-slate-100 mt-3 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500" style={{ width: `${totals.income > 0 ? Math.min(100, (totals.expense / totals.income) * 100) : 0}%` }}></div>
                </div>
            </div>

            <div className="bg-slate-800 p-5 rounded-[24px] border border-slate-900 text-white relative overflow-hidden">
                <div className="relative z-10">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Исходящий остаток (31 дек)</p>
                    <p className="text-2xl font-bold">{formatCurrency(closingBalance)}</p>
                    <p className="text-[10px] mt-2 opacity-60">Финансовый результат: {totals.profit > 0 ? '+' : ''}{formatCurrency(totals.profit)}</p>
                </div>
                <span className="material-icons-round absolute -right-2 -bottom-4 text-8xl text-white opacity-5">account_balance_wallet</span>
            </div>
        </div>

        {/* Monthly Chart */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm h-[350px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h4 className="font-bold text-slate-800">Динамика по месяцам</h4>
                <div className="flex gap-4 text-[10px] font-bold uppercase">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-400"></div>Приход</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-400"></div>Расход</div>
                </div>
            </div>
            
            <div className="flex-grow flex items-end justify-between gap-2 md:gap-4 pb-2">
                {yearData.map((m) => (
                    <div key={m.index} className="flex-1 flex flex-col justify-end items-center h-full group relative">
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 bg-slate-800 text-white text-[10px] p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                            <div className="text-emerald-300">+{formatCurrency(m.income)}</div>
                            <div className="text-red-300">-{formatCurrency(m.expense)}</div>
                        </div>

                        <div className="w-full flex gap-1 items-end justify-center h-full">
                            <div 
                                className="w-2 md:w-4 bg-emerald-400 rounded-t-sm transition-all hover:bg-emerald-500"
                                style={{ height: `${(m.income / maxVal) * 80}%`, minHeight: m.income > 0 ? '4px' : '0' }}
                            ></div>
                            <div 
                                className="w-2 md:w-4 bg-red-400 rounded-t-sm transition-all hover:bg-red-500"
                                style={{ height: `${(m.expense / maxVal) * 80}%`, minHeight: m.expense > 0 ? '4px' : '0' }}
                            ></div>
                        </div>
                        <div className="h-[1px] w-full bg-slate-100 mt-1 mb-2"></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{m.label}</span>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};
