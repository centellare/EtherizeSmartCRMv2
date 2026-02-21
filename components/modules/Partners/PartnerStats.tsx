import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Partner } from '../../../types';

interface PartnerStatsProps {
  partners: Partner[];
}

export const PartnerStats: React.FC<PartnerStatsProps> = ({ partners }) => {
  const clientData = useMemo(() => {
    return partners
      .map(p => ({
        name: p.name,
        clients: p.total_clients || 0,
        revenue: p.total_revenue || 0 // Assuming this is populated or we calculate it
      }))
      .sort((a, b) => b.clients - a.clients);
  }, [partners]);

  // Mock revenue data for now if not available, or use what we have
  // Since we don't have real revenue calculation in the query yet, we might need to rely on what's passed
  // or just show client counts.

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500">
      {/* Clients per Partner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Клиентов от партнеров</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={clientData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
              <Tooltip cursor={{ fill: 'transparent' }} />
              <Bar dataKey="clients" fill="#005ac1" radius={[0, 4, 4, 0]} name="Клиентов" barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue per Partner (Placeholder/Future) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Выручка по партнерам (Beta)</h3>
        <div className="h-[300px] w-full flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <div className="text-center">
                <span className="material-icons-round text-4xl text-slate-300 mb-2">monetization_on</span>
                <p className="text-slate-500 text-sm">Статистика по выручке будет доступна<br/>после накопления данных по оплатам.</p>
            </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="col-span-1 lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Сводная таблица</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Партнер</th>
                <th className="px-4 py-3 text-right">Клиентов</th>
                <th className="px-4 py-3 text-right">Комиссия (%)</th>
                <th className="px-4 py-3 text-right rounded-r-lg">Статус</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => (
                <tr key={partner.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{partner.name}</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-600">{partner.total_clients}</td>
                  <td className="px-4 py-3 text-right">{partner.default_commission_percent}%</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${partner.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>
                      {partner.status === 'active' ? 'Активен' : 'Неактивен'}
                    </span>
                  </td>
                </tr>
              ))}
              {partners.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">Нет данных</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
