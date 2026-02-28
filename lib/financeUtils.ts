import { Transaction } from '../types';
import { getMinskISODate } from './dateUtils';

// Helper to calculate "Real" Fact Amount (handles legacy/simple approved items without explicit payments)
export const getFactAmount = (t: Transaction) => {
    if (t.fact_amount && t.fact_amount > 0) return t.fact_amount;
    if (t.status === 'approved') return t.amount;
    return 0;
};

export interface GlobalMetrics {
    balance: number;
    debtorsSum: number;
    debtorsCount: number;
}

export const calculateGlobalMetrics = (transactions: Transaction[], selectedObjectId?: string): GlobalMetrics => {
    const todayStr = getMinskISODate();
    
    let relevantTransactions = transactions;
    if (selectedObjectId) {
        relevantTransactions = transactions.filter(t => t.object_id === selectedObjectId);
    }

    const allIncome = relevantTransactions.filter(t => t.type === 'income').reduce((s, t) => s + getFactAmount(t), 0);
    const allExpense = relevantTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + getFactAmount(t), 0);
    const balance = allIncome - allExpense;

    const debtorsList = relevantTransactions.filter(t => 
        t.type === 'income' && 
        (t.amount - getFactAmount(t)) > 0.01 && 
        t.planned_date && 
        t.planned_date < todayStr
    );
    const debtorsSum = debtorsList.reduce((s, t) => s + (t.amount - getFactAmount(t)), 0);

    return {
        balance,
        debtorsSum,
        debtorsCount: debtorsList.length
    };
};

export interface PeriodMetrics {
    incomeFactSum: number;
    incomeFactCount: number;
    incomePlanSum: number;
    incomePlanCount: number;
    expenseFactSum: number;
    expenseFactCount: number;
    expensePlanSum: number;
    expensePlanCount: number;
}

export const calculatePeriodMetrics = (
    transactions: Transaction[], 
    startDate: string, 
    endDate: string, 
    selectedObjectId?: string
): PeriodMetrics => {
    let relevantTransactions = transactions;
    if (selectedObjectId) {
        relevantTransactions = transactions.filter(t => t.object_id === selectedObjectId);
    }

    // 2. Plan Metrics: Based on Transaction Date (planned_date)
    const planTransactions = relevantTransactions.filter(t => {
        const targetDate = t.planned_date || getMinskISODate(new Date(t.created_at));
        const matchesStart = !startDate || targetDate >= startDate;
        const matchesEnd = !endDate || targetDate <= endDate;
        return matchesStart && matchesEnd;
    });

    const incomePlanList = planTransactions.filter(t => 
        t.type === 'income' && 
        (t.amount - getFactAmount(t)) > 0.01
    );
    const incomePlanSum = incomePlanList.reduce((s, t) => s + (t.amount - getFactAmount(t)), 0);

    const expensePlanList = planTransactions.filter(t => 
        t.type === 'expense' && 
        t.status !== 'rejected'
    );
    const expensePlanSum = expensePlanList.reduce((s, t) => {
        const targetAmount = t.status === 'approved' ? t.amount : (t.requested_amount || t.amount);
        const done = getFactAmount(t);
        return s + Math.max(0, targetAmount - done);
    }, 0);

    // 3. Fact Metrics: Based on Actual Payment Dates
    let incomeFactSum = 0;
    let incomeFactCount = 0;
    let expenseFactSum = 0;
    let expenseFactCount = 0;

    relevantTransactions.forEach(t => {
        let factInPeriod = 0;
        let hasFact = false;

        if (t.payments && t.payments.length > 0) {
            t.payments.forEach((p: any) => {
                const pDate = p.payment_date ? p.payment_date.split('T')[0] : '';
                const matchesStart = !startDate || pDate >= startDate;
                const matchesEnd = !endDate || pDate <= endDate;
                if (matchesStart && matchesEnd) {
                    factInPeriod += (p.amount || 0);
                    hasFact = true;
                }
            });
        } else {
            const rawDate = t.planned_date || t.created_at;
            const tDate = rawDate ? (rawDate.includes('T') ? rawDate.split('T')[0] : rawDate) : '';
            
            const matchesStart = !startDate || tDate >= startDate;
            const matchesEnd = !endDate || tDate <= endDate;
            
            if (matchesStart && matchesEnd) {
                const amt = getFactAmount(t);
                if (amt > 0) {
                    factInPeriod += amt;
                    hasFact = true;
                }
            }
        }

        if (hasFact) {
            if (t.type === 'income') {
                incomeFactSum += factInPeriod;
                incomeFactCount++;
            } else {
                expenseFactSum += factInPeriod;
                expenseFactCount++;
            }
        }
    });

    return {
        incomeFactSum, incomeFactCount,
        incomePlanSum, incomePlanCount: incomePlanList.length,
        expenseFactSum, expenseFactCount,
        expensePlanSum, expensePlanCount: expensePlanList.length
    };
};

export const filterTransactions = (
    transactions: Transaction[],
    filters: {
        startDate: string;
        endDate: string;
        activeWidget: string | null;
        unclosedDocsOnly: boolean;
        docSearchQuery?: string;
        selectedObjectId?: string;
    }
): Transaction[] => {
    const todayStr = getMinskISODate();
    const { startDate, endDate, activeWidget, unclosedDocsOnly, docSearchQuery, selectedObjectId } = filters;

    return transactions.filter(t => {
        if (selectedObjectId && t.object_id !== selectedObjectId) return false;

        if (docSearchQuery) {
            const searchLower = docSearchQuery.toLowerCase();
            const matchesDocSearch = t.payments?.some((p: any) => 
                (p.doc_number?.toLowerCase().includes(searchLower)) ||
                (p.doc_type?.toLowerCase().includes(searchLower)) ||
                (p.doc_date && p.doc_date.includes(docSearchQuery))
            );
            if (!matchesDocSearch) return false;
        }

        if (unclosedDocsOnly) {
            const hasUnclosedDoc = t.payments?.some((p: any) => p.requires_doc && !p.doc_number);
            if (!hasUnclosedDoc) return false;
        }

        if (activeWidget === 'debtors') {
            return t.type === 'income' && 
                   (t.status === 'pending' || t.status === 'partial') &&
                   t.planned_date && 
                   t.planned_date < todayStr;
        }

        const targetDate = t.planned_date || getMinskISODate(new Date(t.created_at));
        const matchesDate = (!startDate || targetDate >= startDate) && (!endDate || targetDate <= endDate);
        if (!matchesDate) return false;

        if (activeWidget === 'income_fact') return t.type === 'income';
        
        if (activeWidget === 'income_plan') {
            const remaining = t.amount - getFactAmount(t);
            return t.type === 'income' && t.status !== 'approved' && remaining > 0.01;
        }
        
        if (activeWidget === 'expense_fact') return t.type === 'expense' && t.status === 'approved';
        
        if (activeWidget === 'expense_plan') {
             const target = t.requested_amount || t.amount;
             const done = getFactAmount(t);
             return t.type === 'expense' && t.status !== 'approved' && (target - done) > 0.01;
        }

        return true;
    });
};
