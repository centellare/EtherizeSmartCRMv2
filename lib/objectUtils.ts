export const filterObjects = (
  objects: any[], 
  searchQuery: string, 
  statusFilter: string, 
  responsibleFilter: string, 
  taskFilter: string
) => {
  const now = new Date();

  const filtered = objects.filter((o: any) => {
    const matchesSearch = o.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (o.address && o.address.toLowerCase().includes(searchQuery.toLowerCase())) || 
                         (o.client && o.client.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || o.current_status === statusFilter;
    const matchesResponsible = responsibleFilter === 'all' || o.responsible_id === responsibleFilter;
    
    const activeTasks = o.tasks?.filter((t: any) => !t.is_deleted && t.status !== 'completed') || [];
    const activeTasksCount = activeTasks.length;
    const matchesTaskFilter = taskFilter === 'all' || 
                             (taskFilter === 'no_tasks' && activeTasksCount === 0) ||
                             (taskFilter === 'has_tasks' && activeTasksCount > 0);
    
    return matchesSearch && matchesStatus && matchesResponsible && matchesTaskFilter;
  });

  // Sorting logic
  return filtered.sort((a: any, b: any) => {
    // 1. Frozen objects to the bottom
    if (a.current_status === 'frozen' && b.current_status !== 'frozen') return 1;
    if (a.current_status !== 'frozen' && b.current_status === 'frozen') return -1;

    const aTasks = a.tasks?.filter((t: any) => !t.is_deleted && t.status !== 'completed') || [];
    const bTasks = b.tasks?.filter((t: any) => !t.is_deleted && t.status !== 'completed') || [];

    const aOverdue = aTasks.some((t: any) => t.deadline && new Date(t.deadline) < now);
    const bOverdue = bTasks.some((t: any) => t.deadline && new Date(t.deadline) < now);

    // 2. Overdue tasks to the top
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    // 3. Sort by earliest deadline
    const aMinDeadline = aTasks.reduce((min: any, t: any) => {
      if (!t.deadline) return min;
      const d = new Date(t.deadline).getTime();
      return min === null || d < min ? d : min;
    }, null);

    const bMinDeadline = bTasks.reduce((min: any, t: any) => {
      if (!t.deadline) return min;
      const d = new Date(t.deadline).getTime();
      return min === null || d < min ? d : min;
    }, null);

    if (aMinDeadline !== null && bMinDeadline !== null) {
      return aMinDeadline - bMinDeadline;
    }
    if (aMinDeadline !== null && bMinDeadline === null) return -1;
    if (aMinDeadline === null && bMinDeadline !== null) return 1;

    // 4. Objects with tasks before objects without tasks
    if (aTasks.length > 0 && bTasks.length === 0) return -1;
    if (aTasks.length === 0 && bTasks.length > 0) return 1;

    // Default: created_at desc
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};
