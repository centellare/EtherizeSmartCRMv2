import { Task } from '../types';
import { Profile } from '../hooks/useAuth';
import { getMinskISODate } from './dateUtils';

export type TaskTab = 'active' | 'today' | 'week' | 'overdue' | 'team' | 'archive';
export type FilterMode = 'all' | 'mine' | 'created';

export interface DateRange {
  start: string;
  end: string;
}

export const filterTasks = (
  tasks: Task[],
  tab: TaskTab,
  range: DateRange
): Task[] => {
  const todayStr = getMinskISODate();
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = getMinskISODate(tomorrow);

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = getMinskISODate(nextWeek);

  let list = tasks;
  
  switch (tab) {
    case 'today': 
      list = list.filter(t => {
        if (!t.deadline) return false;
        const taskDate = getMinskISODate(new Date(t.deadline));
        return taskDate === todayStr || taskDate === tomorrowStr;
      });
      break;
    case 'week': 
      list = list.filter(t => t.deadline && getMinskISODate(new Date(t.deadline)) >= todayStr && getMinskISODate(new Date(t.deadline)) <= nextWeekStr);
      break;
    case 'overdue': 
      list = list.filter(t => t.deadline && getMinskISODate(new Date(t.deadline)) < todayStr);
      break;
    case 'active':
      if (range.start) {
        list = list.filter(t => t.deadline && getMinskISODate(new Date(t.deadline)) >= range.start);
      }
      if (range.end) {
        list = list.filter(t => t.deadline && getMinskISODate(new Date(t.deadline)) <= range.end);
      }
      break;
  }
  return list;
};

export const getOverdueCount = (tasks: Task[]): number => {
  const todayStr = getMinskISODate();
  return tasks.filter(t => t.deadline && getMinskISODate(new Date(t.deadline)) < todayStr).length;
};

export interface TeamWorkloadMember extends Profile {
  tasks: Task[];
}

export const calculateTeamWorkload = (staff: Profile[], activeTasks: Task[]): TeamWorkloadMember[] => {
  return staff.map(member => {
    let memberTasks = activeTasks.filter(t => t.assigned_to === member.id);
    return { ...member, tasks: memberTasks };
  }).filter(m => m.tasks.length > 0 || m.role === 'specialist' || m.role === 'manager');
};
