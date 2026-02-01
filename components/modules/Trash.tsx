import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Badge, ConfirmModal } from '../ui';

const Trash: React.FC<{ profile: any }> = ({ profile }) => {
  const [deletedItems, setDeletedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDeleted = async () => {
    const [{ data: objects }, { data: clients }, { data: tasks }] = await Promise.all([
      supabase.from('objects').select('id, name, deleted_at').is('is_deleted', true),
      supabase.from('clients').select('id, name, deleted_at').not('deleted_at', 'is', null),
      supabase.from('tasks').select('id, title, deleted_at').is('is_deleted', true)
    ]);
    const combined = [
      ...(objects || []).map(i => ({ ...i, type: 'Объект', table: 'objects' })),
      ...(clients || []).map(i => ({ ...i, type: 'Клиент', table: 'clients' })),
      ...(tasks || []).map(i => ({ ...i, name: i.title, type: 'Задача', table: 'tasks' })),
    ];
    setDeletedItems(combined);
  };

  useEffect(() => { fetchDeleted(); }, []);

  const handleRestore = async (id: string, table: string) => {
    const field = table === 'clients' ? 'deleted_at' : 'is_deleted';
    const value = table === 'clients' ? null : false;
    await supabase.from(table).update({ [field]: value }).eq('id', id);
    fetchDeleted();
  };

  return (
    <div className="animate-in fade-in duration-500">
      <h2 className="text-2xl font-bold mb-10">Корзина</h2>
      <div className="bg-white rounded-[32px] border border-[#e1e2e1] overflow-hidden">
        <table className="w-full text-left">
          <tbody>
            {deletedItems.map(item => (
              <tr key={`${item.table}-${item.id}`} className="border-b">
                <td className="p-6 font-bold">{item.name}</td>
                <td className="p-6"><Badge color="slate">{item.type}</Badge></td>
                <td className="p-6 text-right">
                  <Button variant="ghost" className="h-8 text-xs" onClick={() => handleRestore(item.id, item.table)} icon="history">Вернуть</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Trash;