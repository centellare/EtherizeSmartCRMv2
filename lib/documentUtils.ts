import { SupabaseClient } from '@supabase/supabase-js';

export const generateDocumentNumber = async (
  supabase: SupabaseClient,
  table: 'commercial_proposals' | 'invoices',
  profile: { id: string, full_name: string }
): Promise<string> => {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;

  // Initials
  // Handle cases where full_name might be null or empty
  const name = profile.full_name || 'User';
  const parts = name.split(' ').filter(Boolean);
  
  let initials = 'XX';
  if (parts.length >= 2) {
    // First letter of first name + First letter of last name (or vice versa depending on format)
    // Assuming "Surname Name" or "Name Surname", taking first chars is standard.
    initials = (parts[0][0] + parts[1][0]).toUpperCase();
  } else if (parts.length === 1) {
    initials = parts[0].substring(0, 2).toUpperCase();
  }

  // Sequence
  // We need to count documents created by this user today.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('created_by', profile.id)
    .gte('created_at', todayStart.toISOString())
    .lte('created_at', todayEnd.toISOString());

  if (error) {
    console.error('Error counting documents:', error);
    // Fallback to timestamp if error
    return `${dateStr}-${initials}-${Date.now().toString().slice(-4)}`;
  }

  const sequence = (count || 0) + 1;

  return `${dateStr}-${initials}-${sequence}`;
};
