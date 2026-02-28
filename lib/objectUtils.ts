export const filterObjects = (
  objects: any[], 
  searchQuery: string, 
  statusFilter: string, 
  responsibleFilter: string, 
  taskFilter: string
) => {
  return objects.filter((o: any) => {
    const matchesSearch = o.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (o.address && o.address.toLowerCase().includes(searchQuery.toLowerCase())) || 
                         (o.client && o.client.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || o.current_status === statusFilter;
    const matchesResponsible = responsibleFilter === 'all' || o.responsible_id === responsibleFilter;
    
    const activeTasksCount = o.tasks?.filter((t: any) => !t.is_deleted && t.status !== 'completed').length || 0;
    const matchesTaskFilter = taskFilter === 'all' || 
                             (taskFilter === 'no_tasks' && activeTasksCount === 0) ||
                             (taskFilter === 'has_tasks' && activeTasksCount > 0);
    
    return matchesSearch && matchesStatus && matchesResponsible && matchesTaskFilter;
  });
};
