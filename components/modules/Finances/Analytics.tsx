
import React, { useState, useMemo } from 'react';
import { Transaction } from '../../../types';
import { Button } from '../../ui';

interface AnalyticsProps {
  transactions: Transaction[];
  formatCurrency: (val: number) => string;
}

export const Analytics: React.FC<AnalyticsProps> = ({ transactions, formatCurrency }) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // 0-11 or null

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  // 1. Calculate Opening Balance dynamically based on current View
  // If Year View: Balance before Jan 1st of selectedYear
  // If Month View: Balance before 1st of selectedMonth
  const openingBalance = useMemo(() => {
    const cutoffDate = selectedMonth === null 
        ? new Date(selectedYear, 0, 1) // Jan 1st
        : new Date(selectedYear, selectedMonth, 1); // 1st of selected month

    return transactions.reduce((sum, t) => {
        const tDate = new Date(t.created_at);
        if (tDate < cutoffDate) {
            const income = t.type === 'income' ? (t.fact_amount || 0) : 0;
            const expense = t.type === 'expense' && t.status === 'approved' ? t.amount : 0;
            return sum + (income - expense);
        }
        return sum;
    }, 0);
  }, [transactions, selectedYear, selectedMonth]);

  // 2. Prepare Chart Data (Either 12 months OR Weeks of specific month)
  const chartData = useMemo(() => {
    if (selectedMonth === null) {
        // --- YEAR VIEW (12 Months) ---
        const months = Array.from({ length: 12 }, (_, i) => ({ 
            index: i, 
            label: monthNames[i].slice(0, 3), // Short name
            fullName: monthNames[i],
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
    } else {
        // --- MONTH VIEW (Weeks Breakdown) ---
        // Buckets: 1-7, 8-14, 15-21, 22-28, 29-End
        const weeks = [
            { index: 0, label: '1-7', income: 0, expense: 0 },
            { index: 1, label: '8-14', income: 0, expense: 0 },
            { index: 2, label: '15-21', income: 0, expense: 0 },
            { index: 3, label: '22-28', income: 0, expense: 0 },
            { index: 4, label: '29+', income: 0, expense: 0 },
        ];

        transactions.forEach(t => {
            const date = new Date(t.created_at);
            if (date.getFullYear() === selectedYear && date.getMonth() === selectedMonth) {
                const day = date.getDate();
                let wIndex = 0;
                if (day <= 7) wIndex = 0;
                else if (day <= 14) wIndex = 1;
                else if (day <= 21) wIndex = 2;
                else if (day <= 28) wIndex = 3;
                else wIndex = 4;

                if (t.type === 'income') {
                    weeks[wIndex].income += (t.fact_amount || 0);
                } else if (t.type === 'expense' && t.status === 'approved') {
                    weeks[wIndex].expense += t.amount;
                }
            }
        });
        return weeks;
    }
  }, [transactions, selectedYear, selectedMonth]);

  // 3. Totals for Current View
  const totals = useMemo(() => {
      const inc = chartData.reduce((s, d) => s + d.income, 0);
      const exp = chartData.reduce((s, d) => s + d.expense, 0);
      return { income: inc, expense: exp, profit: inc - exp };
  }, [chartData]);

  const closingBalance = openingBalance + totals.profit;
  const maxVal = Math.max(...chartData.map(d => Math.max(d.income, d.expense)), 100); // Avoid divide by zero

  const handleBarClick = (index: number) => {
      if (selectedMonth === null) {
          // Drill down to month
          setSelectedMonth(index);
      }
      // If already in month view, do nothing (or maybe filter list below later)
  };

  const handleBack = () => setSelectedMonth(null);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        {/* Header & Navigation */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="bg-slate-100 p-1 rounded-2xl flex gap-1">
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(year => (
                    <button 
                        key={year}
                        onClick={() => { setSelectedYear(year); setSelectedMonth(null); }}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedYear === year ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        {year}
                    </button>
                ))}
            </div>

            {selectedMonth !== null && (
                <div className="flex items-center gap-4 animate-in slide-in-from-right-4">
                    <h3 className="text-xl font-bold text-slate-800">{monthNames[selectedMonth]} {selectedYear}</h3>
                    <Button variant="ghost" onClick={handleBack} icon="arrow_back" className="h-10 px-4">Назад к году</Button>
                </div>
            )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-[24px] border border-slate-200 transition-all hover:shadow-md">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    {selectedMonth === null ? 'Входящий (1 янв)' : `Входящий (1 ${monthNames[selectedMonth]?.toLowerCase().slice(0,3)})`}
                </p>
                <p className="text-xl font-bold text-slate-800">{formatCurrency(openingBalance)}</p>
                <div className="h-1 w-full bg-slate-100 mt-3 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-400 w-full opacity-30"></div>
                </div>
            </div>

            <div className="bg-white p-5 rounded-[24px] border border-slate-200 transition-all hover:shadow-md">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    {selectedMonth === null ? 'Приход за год' : 'Приход за месяц'}
                </p>
                <p className="text-xl font-bold text-emerald-600">+{formatCurrency(totals.income)}</p>
                <div className="h-1 w-full bg-slate-100 mt-3 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: '100%' }}></div>
                </div>
            </div>

            <div className="bg-white p-5 rounded-[24px] border border-slate-200 transition-all hover:shadow-md">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    {selectedMonth === null ? 'Расход за год' : 'Расход за месяц'}
                </p>
                <p className="text-xl font-bold text-red-500">-{formatCurrency(totals.expense)}</p>
                <div className="h-1 w-full bg-slate-100 mt-3 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500" style={{ width: `${totals.income > 0 ? Math.min(100, (totals.expense / totals.income) * 100) : 0}%` }}></div>
                </div>
            </div>

            <div className="bg-slate-800 p-5 rounded-[24px] border border-slate-900 text-white relative overflow-hidden group">
                <div className="relative z-10">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Исходящий остаток</p>
                    <p className="text-2xl font-bold">{formatCurrency(closingBalance)}</p>
                    <p className="text-[10px] mt-2 opacity-60 font-mono">
                        Результат: {totals.profit > 0 ? '+' : ''}{formatCurrency(totals.profit)}
                    </p>
                </div>
                <span className="material-icons-round absolute -right-2 -bottom-4 text-8xl text-white opacity-5 group-hover:scale-110 transition-transform">account_balance_wallet</span>
            </div>
        </div>

        {/* Dynamic Chart */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm h-[400px] flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-center mb-6 z-10">
                <div>
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                        {selectedMonth === null ? 'Динамика по месяцам' : 'Разбивка по неделям (дни)'}
                        {selectedMonth === null && <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded-lg uppercase tracking-wide">Кликабельно</span>}
                    </h4>
                </div>
                <div className="flex gap-4 text-[10px] font-bold uppercase">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-400"></div>Приход</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-400"></div>Расход</div>
                </div>
            </div>
            
            <div className="flex-grow flex items-end justify-between gap-2 md:gap-4 pb-2 z-10">
                {chartData.map((d) => {
                    const isZero = d.income === 0 && d.expense === 0;
                    return (
                        <div 
                            key={d.index} 
                            onClick={() => handleBarClick(d.index)}
                            className={`flex-1 flex flex-col justify-end items-center h-full group relative ${selectedMonth === null ? 'cursor-pointer hover:bg-slate-50 rounded-xl transition-colors' : ''}`}
                        >
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 bg-slate-800 text-white text-[10px] p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                                <p className="font-bold mb-1 border-b border-slate-600 pb-1">{selectedMonth === null ? (d as any).fullName : `Дни: ${d.label}`}</p>
                                <div className="text-emerald-300">+{formatCurrency(d.income)}</div>
                                <div className="text-red-300">-{formatCurrency(d.expense)}</div>
                                <div className="mt-1 pt-1 border-t border-slate-600 text-slate-400">Сальдо: {formatCurrency(d.income - d.expense)}</div>
                            </div>

                            <div className="w-full flex gap-1 items-end justify-center h-full pb-1 px-1">
                                {/* Income Bar */}
                                <div className="w-1/2 flex flex-col justify-end h-full">
                                    <div 
                                        className="w-full bg-emerald-400 rounded-t-sm transition-all duration-500 hover:bg-emerald-500 relative group/bar"
                                        style={{ height: `${(d.income / maxVal) * 85}%`, minHeight: d.income > 0 ? '4px' : '0' }}
                                    >
                                        {d.income > 0 && (
                                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-bold text-slate-500 opacity-0 group-hover/bar:opacity-100 transition-opacity">
                                                {formatCurrency(d.income)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {/* Expense Bar */}
                                <div className="w-1/2 flex flex-col justify-end h-full">
                                    <div 
                                        className="w-full bg-red-400 rounded-t-sm transition-all duration-500 hover:bg-red-500 relative group/bar"
                                        style={{ height: `${(d.expense / maxVal) * 85}%`, minHeight: d.expense > 0 ? '4px' : '0' }}
                                    >
                                        {d.expense > 0 && (
                                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-bold text-slate-500 opacity-0 group-hover/bar:opacity-100 transition-opacity">
                                                {formatCurrency(d.expense)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="h-[1px] w-full bg-slate-200 mt-1 mb-2"></div>
                            <span className={`text-[10px] font-bold uppercase transition-colors ${isZero ? 'text-slate-300' : 'text-slate-500 group-hover:text-blue-600'}`}>
                                {d.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Background Grid Lines (Optional visual) */}
            <div className="absolute inset-0 top-16 bottom-8 left-0 right-0 pointer-events-none flex flex-col justify-between opacity-10 px-6">
                <div className="border-t border-slate-400 w-full"></div>
                <div className="border-t border-slate-400 w-full"></div>
                <div className="border-t border-slate-400 w-full"></div>
                <div className="border-t border-slate-400 w-full"></div>
            </div>
        </div>
    </div>
  );
};
