
import React from 'react';
import { FinanceWidget } from '../../ui';

interface StatsOverviewProps {
  globalMetrics: {
    balance: number;
    debtorsSum: number;
    debtorsCount: number;
  };
  periodMetrics: {
    incomeFactSum: number;
    incomeFactCount: number;
    incomePlanSum: number;
    incomePlanCount: number;
    expenseFactSum: number;
    expenseFactCount: number;
    expensePlanSum: number;
    expensePlanCount: number;
  };
  activeWidget: string | null;
  setActiveWidget: (w: string | null) => void;
  isSpecialist: boolean;
  formatCurrency: (val: number) => string;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ 
  globalMetrics, 
  periodMetrics, 
  activeWidget, 
  setActiveWidget, 
  isSpecialist, 
  formatCurrency 
}) => {
  return (
    <div className="space-y-4">
        {!isSpecialist && (
            <div className="bg-slate-50 rounded-[28px] p-5 border border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                    <span className="material-icons-round text-slate-400">analytics</span>
                    <h5 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Текущее состояние компании (Все время)</h5>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FinanceWidget 
                        label="Баланс (Cash)" 
                        value={formatCurrency(globalMetrics.balance)} 
                        color={globalMetrics.balance >= 0 ? 'text-emerald-600' : 'text-red-600'} 
                        icon="account_balance"
                        isActive={activeWidget === null}
                        onClick={() => setActiveWidget(null)}
                    />
                    <FinanceWidget 
                        label="Дебиторка (Просрочено)" 
                        value={formatCurrency(globalMetrics.debtorsSum)} 
                        color="text-red-600" 
                        icon="priority_high"
                        count={globalMetrics.debtorsCount}
                        isActive={activeWidget === 'debtors'}
                        onClick={() => setActiveWidget(activeWidget === 'debtors' ? null : 'debtors')}
                    />
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FinanceWidget 
                label="Приход (Факт)" 
                value={formatCurrency(periodMetrics.incomeFactSum)} 
                count={periodMetrics.incomeFactCount}
                color="text-emerald-600" 
                icon="trending_up"
                isActive={activeWidget === 'income_fact'}
                onClick={() => setActiveWidget(activeWidget === 'income_fact' ? null : 'income_fact')}
            />
            <FinanceWidget 
                label="Ожидаемый приход" 
                value={formatCurrency(periodMetrics.incomePlanSum)} 
                count={periodMetrics.incomePlanCount}
                color="text-blue-400" 
                icon="event_note"
                isActive={activeWidget === 'income_plan'}
                onClick={() => setActiveWidget(activeWidget === 'income_plan' ? null : 'income_plan')}
            />
            <FinanceWidget 
                label="Затраты (Факт)" 
                value={formatCurrency(periodMetrics.expenseFactSum)} 
                count={periodMetrics.expenseFactCount}
                color="text-red-600" 
                icon="money_off"
                isActive={activeWidget === 'expense_fact'}
                onClick={() => setActiveWidget(activeWidget === 'expense_fact' ? null : 'expense_fact')}
            />
            <FinanceWidget 
                label="План затрат (Остаток)" 
                value={formatCurrency(periodMetrics.expensePlanSum)} 
                count={periodMetrics.expensePlanCount}
                color="text-amber-500" 
                icon="request_quote"
                isActive={activeWidget === 'expense_plan'}
                onClick={() => setActiveWidget(activeWidget === 'expense_plan' ? null : 'expense_plan')}
            />
        </div>
    </div>
  );
};
