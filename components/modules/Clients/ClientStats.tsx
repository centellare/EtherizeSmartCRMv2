import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Client } from '../../../types';

interface ClientStatsProps {
  clients: Client[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

const SOURCES_MAP: Record<string, string> = {
  'instagram': 'Instagram',
  'website': 'Наш сайт',
  'referral': 'Рекомендация',
  'partner': 'Партнер',
  'cold_call': 'Холодный поиск',
  'exhibition': 'Выставка',
  'other': 'Другое'
};

export const ClientStats: React.FC<ClientStatsProps> = ({ clients }) => {
  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    clients.forEach(client => {
      const source = client.lead_source || 'other';
      counts[source] = (counts[source] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([key, value]) => ({
        name: SOURCES_MAP[key] || key,
        value
      }))
      .sort((a, b) => b.value - a.value);
  }, [clients]);

  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    clients.forEach(client => {
      const type = client.type === 'company' ? 'Компания' : 'Физлицо';
      counts[type] = (counts[type] || 0) + 1;
    });

    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [clients]);

  const partnerData = useMemo(() => {
    const counts: Record<string, number> = {};
    clients.forEach(client => {
      if (client.lead_source === 'partner' && client.partner) {
        const partnerName = client.partner.name;
        counts[partnerName] = (counts[partnerName] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [clients]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500">
      {/* Source Distribution */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Источники клиентов</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sourceData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(props: any) => `${props.name} ${(props.percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {sourceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Type Distribution */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Типы клиентов</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={typeData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip cursor={{ fill: 'transparent' }} />
              <Bar dataKey="value" fill="#005ac1" radius={[4, 4, 0, 0]} name="Количество" barSize={60} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Partner Distribution */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Клиенты от партнеров</h3>
        {partnerData.length > 0 ? (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={partnerData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="value" fill="#8884d8" radius={[0, 4, 4, 0]} name="Клиентов" barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[300px] w-full flex items-center justify-center text-slate-400">
            Нет данных о партнерах
          </div>
        )}
      </div>

      {/* Top Referrers (if any) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Топ рекомендаций (Сарафан)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Кто порекомендовал</th>
                <th className="px-4 py-3 rounded-r-lg text-right">Привел клиентов</th>
              </tr>
            </thead>
            <tbody>
              {clients
                .filter(c => c.lead_source === 'referral' && c.referred_by)
                .reduce((acc: any[], curr) => {
                  const referrerId = curr.referred_by;
                  // Find referrer name from clients list (assuming full list is loaded)
                  const referrer = clients.find(c => c.id === referrerId);
                  const name = referrer ? referrer.name : 'Неизвестно';
                  
                  const existing = acc.find(item => item.name === name);
                  if (existing) {
                    existing.count++;
                  } else {
                    acc.push({ name, count: 1 });
                  }
                  return acc;
                }, [])
                .sort((a, b) => b.count - a.count)
                .slice(0, 5)
                .map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-600">{item.count}</td>
                  </tr>
                ))}
                {clients.filter(c => c.lead_source === 'referral' && c.referred_by).length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-slate-400">Нет данных о рекомендациях</td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
