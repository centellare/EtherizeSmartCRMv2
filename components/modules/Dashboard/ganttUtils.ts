import { Task } from '../../../types';

export interface StyledTask {
  task: Task;
  style: {
    left: string;
    width: string;
    className: string;
    tStart: number;
    tEnd: number;
  };
}

export interface StackedTask extends StyledTask {
  laneIndex: number;
}

export const getTaskStyleInfo = (
  task: Task, 
  viewStart: number, 
  viewEnd: number
): StyledTask['style'] | null => {
  const taskStart = task.start_date ? new Date(task.start_date) : new Date();
  const taskEnd = task.deadline ? new Date(task.deadline) : new Date(taskStart);
  
  // If no deadline, default to 1 day duration
  if (!task.deadline) taskEnd.setDate(taskEnd.getDate() + 1);

  const tStart = taskStart.getTime();
  const tEnd = taskEnd.getTime();

  // If task is completely outside the viewport
  if (tEnd < viewStart || tStart > viewEnd) return null;

  const effectiveStart = Math.max(tStart, viewStart);
  const effectiveEnd = Math.min(tEnd, viewEnd);
  
  const totalDuration = viewEnd - viewStart;
  const taskDuration = effectiveEnd - effectiveStart;
  
  // Calculate percentages for CSS
  const left = ((effectiveStart - viewStart) / totalDuration) * 100;
  const width = Math.max(((taskDuration) / totalDuration) * 100, 2); // Min width 2%

  let colorClass = 'bg-blue-500';
  const now = new Date().getTime();
  
  if (taskEnd.getTime() < now) colorClass = 'bg-red-500'; // Overdue
  else if (taskStart.getTime() > now) colorClass = 'bg-slate-300'; // Future
  
  return {
    left: `${left}%`,
    width: `${width}%`,
    className: colorClass,
    tStart,
    tEnd
  };
};

export const getStackedTasks = (
  memberTasks: Task[], 
  viewStart: number, 
  viewEnd: number
): { stacked: StackedTask[], totalLanes: number } => {
  const styledTasks = memberTasks
    .map(task => ({ task, style: getTaskStyleInfo(task, viewStart, viewEnd) }))
    .filter((item): item is StyledTask => item.style !== null); // Only those in viewport

  // Sort by start date
  styledTasks.sort((a, b) => a.style.tStart - b.style.tStart);

  const lanes: number[] = [];
  const stacked = styledTasks.map(item => {
    // Find first free lane (where previous task end < current task start)
    let laneIndex = lanes.findIndex(laneEnd => laneEnd < item.style.tStart);
    if (laneIndex === -1) {
      laneIndex = lanes.length;
      lanes.push(item.style.tEnd);
    } else {
      lanes[laneIndex] = item.style.tEnd;
    }
    return { ...item, laneIndex };
  });

  return { stacked, totalLanes: Math.max(1, lanes.length) };
};
