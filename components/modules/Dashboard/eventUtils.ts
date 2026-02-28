import { Task, Transaction, Object as CRMObject } from '../../../types';
import { Profile } from '../../../hooks/useAuth';
import { formatCurrency } from '../../../lib/formatUtils';

export interface DashboardEvent {
  id: string;
  type: 'task' | 'task_completed' | 'transaction' | 'object';
  date: Date;
  title: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  link: string;
}

export const generateRecentEvents = (
  tasks: Task[],
  transactions: Transaction[],
  objects: CRMObject[],
  staff: Profile[]
): DashboardEvent[] => {
  const allEvents: DashboardEvent[] = [];

  // Add Tasks
  tasks.forEach(t => {
    const assignee = staff.find(s => s.id === t.assigned_to)?.full_name || 'Неизвестно';
    const objectName = objects.find(o => o.id === t.object_id)?.name || 'Объект';
    
    allEvents.push({
      id: `task-${t.id}`,
      type: 'task',
      date: new Date(t.created_at),
      title: `Новая задача: ${t.title}`,
      description: `Назначена на ${assignee} (${objectName})`,
      icon: 'assignment',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      link: '#tasks'
    });

    if (t.status === 'completed' && t.completed_at) {
      allEvents.push({
          id: `task-comp-${t.id}`,
          type: 'task_completed',
          date: new Date(t.completed_at),
          title: `Задача выполнена: ${t.title}`,
          description: `Исполнитель: ${assignee}`,
          icon: 'check_circle',
          color: 'text-emerald-600',
          bgColor: 'bg-emerald-50',
          link: '#tasks'
      });
    }
  });

  // Add Transactions
  transactions.forEach(t => {
    const isIncome = t.type === 'income';
    const amount = isIncome ? (t.fact_amount || 0) : t.amount;
    const objectName = objects.find(o => o.id === t.object_id)?.name || 'Объект';
    
    allEvents.push({
      id: `trans-${t.id}`,
      type: 'transaction',
      date: new Date(t.created_at),
      title: isIncome ? 'Новый приход' : 'Новый расход',
      description: `${formatCurrency(amount)} (${objectName}) - ${t.category || 'Без категории'}`,
      icon: isIncome ? 'arrow_downward' : 'arrow_upward',
      color: isIncome ? 'text-emerald-600' : 'text-red-600',
      bgColor: isIncome ? 'bg-emerald-50' : 'bg-red-50',
      link: '#finances'
    });
  });

  // Add Objects
  objects.forEach(o => {
    allEvents.push({
      id: `obj-${o.id}`,
      type: 'object',
      date: new Date(o.created_at),
      title: `Новый объект: ${o.name}`,
      description: `Адрес: ${o.address || 'Не указан'}`,
      icon: 'business',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      link: '#objects'
    });
  });

  // Sort by date descending and take top 10
  return allEvents.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);
};
