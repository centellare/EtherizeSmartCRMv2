
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Badge, ConfirmModal } from '../ui';

const Trash: React.FC<{ profile: any }> = ({ profile }) => {
  const [deletedItems, setDeletedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDeleted = async () => {
    setLoading(true);
    const [{ data: objects }, { data: clients }, { data: tasks }, { data: transactions }] = await Promise.all([
      supabase.from('objects').select('id, name, deleted_at').is('is_deleted', true),
      supabase.from('clients').select('id, name, deleted_at').not('deleted_at', 'is', null),
      supabase.from('tasks').select('id, title, deleted_at').is('is_deleted', true),
      supabase.from('transactions').select('id, category, amount, type, deleted_at').not('deleted_at', 'is', null)
    ]);
    
    const combined = [
      ...(objects || []).map(i => ({ ...i, type: 'Объект', table: 'objects' })),
      ...(clients || []).map(i => ({ ...i, type: 'Клиент', table: 'clients' })),
      ...(tasks || []).map(i => ({ ...i, name: i.title, type: 'Задача', table: 'tasks' })),
      ...(transactions || []).map(i => ({ 
        ...i, 
        name: `${i.type === 'income' ? 'Приход' : 'Расход'}: ${i.category} (${i.amount} BYN)`, 
        type: 'Финансы', 
        table: 'transactions' 
      })),
    ];
    setDeletedItems(combined.sort((a,b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime()));
    setLoading(false);
  };

  useEffect(() => { fetchDeleted(); }, []);

  const handleRestore = async (id: string, table: string) => {
    setLoading(true);
    const field = (table === 'clients' || table === 'transactions') ? 'deleted_at' : 'is_deleted';
    const value = (table === 'clients' || table === 'transactions') ? null : false;
    await supabase.from(table).update({ [field]: value }).eq('id', id);
    await fetchDeleted();
    setLoading(false);
  };

  return (
    <div className="animate-in fade-in duration-500">
      <h2 className="text-2xl font-bold mb-10">Корзина</h2>
      <div className="bg-white rounded-[32px] border border-[#e1e2e1] overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-6 text-[10px] font-bold text-slate-400 uppercase">Элемент</th>
              <th className="p-6 text-[10px] font-bold text-slate-400 uppercase">Тип</th>
              <th className="p-6 text-[10px] font-bold text-slate-400 uppercase">Удален</th>
              <th className="p-6 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {deletedItems.map(item => (
              <tr key={`${item.table}-${item.id}`} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-6 font-bold text-slate-900">{item.name}</td>
                <td className="p-6"><Badge color={item.table === 'transactions' ? 'emerald' : 'slate'}>{item.type}</Badge></td>
                <td className="p-6 text-xs text-slate-500">{new Date(item.deleted_at).toLocaleString()}</td>
                <td className="p-6 text-right">
                  <Button variant="tonal" className="h-8 text-xs" onClick={() => handleRestore(item.id, item.table)} icon="history" loading={loading}>Вернуть</Button>
                </td>
              </tr>
            ))}
            {deletedItems.length === 0 && !loading && (
              <tr><td colSpan={4} className="p-20 text-center text-slate-300 italic">Корзина пуста</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Trash;
