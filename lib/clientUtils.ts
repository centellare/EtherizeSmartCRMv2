export const filterClients = (clients: any[], searchQuery: string, typeFilter: string) => {
  return clients.filter((c: any) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         c.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         c.phone?.includes(searchQuery) || 
                         c.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    return matchesSearch && matchesType;
  });
};
