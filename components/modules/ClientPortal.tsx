import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui';
import { ObjectStatus, StageName } from '../../types';

interface ClientPortalProps {
  profile: any;
  onLogout: () => void;
}

const STAGE_LABELS: Record<StageName, string> = {
  negotiation: 'Переговоры',
  design: 'Проектирование',
  logistics: 'Закупка и логистика',
  assembly: 'Сборка щита',
  mounting: 'Монтаж',
  commissioning: 'Пусконаладка',
  programming: 'Программирование',
  support: 'Обслуживание'
};

const STATUS_LABELS: Record<ObjectStatus, string> = {
  in_work: 'В работе',
  on_pause: 'На паузе',
  review_required: 'Требует проверки',
  frozen: 'Заморожен',
  completed: 'Завершен'
};

const ClientPortal: React.FC<ClientPortalProps> = ({ profile, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'objects' | 'invoices' | 'tasks'>('objects');

  const { data: objects, isLoading: objectsLoading } = useQuery({
    queryKey: ['client_objects', profile.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('objects')
        .select('*')
        .eq('client_id', profile.client_id)
        .is('is_deleted', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile.client_id
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['client_invoices', profile.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, object:objects(name)')
        .eq('client_id', profile.client_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile.client_id
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['client_tasks', profile.id],
    queryFn: async () => {
      // First get user's objects to filter tasks
      const { data: userObjects } = await supabase
        .from('objects')
        .select('id')
        .eq('client_id', profile.client_id);
      
      if (!userObjects || userObjects.length === 0) return [];

      const objectIds = userObjects.map(o => o.id);

      const { data, error } = await supabase
        .from('tasks')
        .select('*, object:objects(name)')
        .in('object_id', objectIds)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile.client_id
  });

  if (!profile.client_id) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] p-6 text-center">
        <div className="w-16 h-16 bg-yellow-50 text-yellow-600 rounded-2xl flex items-center justify-center mb-4">
          <span className="material-icons-round text-3xl">warning</span>
        </div>
        <h2 className="text-xl font-medium text-slate-900 mb-2">Профиль не привязан к клиенту</h2>
        <p className="text-slate-500 max-w-xs mb-8 leading-relaxed">
          Пожалуйста, обратитесь к вашему менеджеру, чтобы он привязал ваш аккаунт к карточке клиента.
        </p>
        <Button onClick={onLogout} icon="logout" variant="ghost">Выйти</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-blue-50 overflow-hidden p-0.5">
              <img src="/logo.svg" alt="SmartHome Client" className="w-full h-full object-contain" />
            </div>
            <span className="font-medium text-slate-900">SmartHome Client</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-700 hidden sm:block">{profile.full_name}</span>
            <Button onClick={onLogout} variant="ghost" icon="logout" className="text-slate-500 hover:text-slate-700 hover:bg-slate-100">
              Выйти
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Tabs */}
        <div className="flex items-center gap-2 mb-8 border-b border-slate-200 pb-px">
          <button
            onClick={() => setActiveTab('objects')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'objects' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Мои объекты
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'invoices' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Счета и оплаты
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'tasks' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Задачи по объектам
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'objects' && (
          <div className="space-y-6">
            {objectsLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
            ) : objects?.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                <span className="material-icons-round text-4xl text-slate-300 mb-3">home_work</span>
                <h3 className="text-lg font-medium text-slate-900">У вас пока нет объектов</h3>
                <p className="text-slate-500 mt-1">Здесь будут отображаться ваши проекты умного дома.</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {objects?.map(obj => (
                  <div key={obj.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{obj.name}</h3>
                        {obj.address && <p className="text-sm text-slate-500 mt-1 flex items-center gap-1"><span className="material-icons-round text-[14px]">location_on</span>{obj.address}</p>}
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        obj.current_status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        obj.current_status === 'on_pause' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {STATUS_LABELS[obj.current_status as ObjectStatus]}
                      </span>
                    </div>
                    
                    <div className="bg-slate-50 rounded-xl p-4 mt-6">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Текущий этап</p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-600">
                          <span className="material-icons-round">
                            {obj.current_stage === 'design' ? 'architecture' : 
                             obj.current_stage === 'mounting' ? 'handyman' : 
                             obj.current_stage === 'programming' ? 'code' : 'check_circle'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{STAGE_LABELS[obj.current_stage as StageName]}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-6">
            {tasksLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
            ) : tasks?.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                <span className="material-icons-round text-4xl text-slate-300 mb-3">task_alt</span>
                <h3 className="text-lg font-medium text-slate-900">Задач пока нет</h3>
                <p className="text-slate-500 mt-1">Здесь будут отображаться задачи по вашим объектам.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Задача</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Объект</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Статус</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tasks?.map(task => (
                        <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-900">{task.title}</div>
                            {task.comment && <div className="text-xs text-slate-500 mt-1 line-clamp-1">{task.comment}</div>}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {task.object?.name || '—'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              task.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {task.status === 'completed' ? 'Завершена' :
                               task.status === 'in_progress' ? 'В работе' : 'Ожидает'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="space-y-6">
            {invoicesLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
            ) : invoices?.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                <span className="material-icons-round text-4xl text-slate-300 mb-3">receipt_long</span>
                <h3 className="text-lg font-medium text-slate-900">Счетов пока нет</h3>
                <p className="text-slate-500 mt-1">Здесь будут отображаться выставленные вам счета.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Счет</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Объект</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Сумма</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Статус</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoices?.map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-900">№ {inv.number}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{inv.created_at ? new Date(inv.created_at).toLocaleDateString('ru-RU') : '—'}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {inv.object?.name || '—'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-900">{(inv.total_amount || 0).toLocaleString('ru-RU')} BYN</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                              inv.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                              inv.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {inv.status === 'paid' ? 'Оплачен' :
                               inv.status === 'sent' ? 'Ожидает оплаты' :
                               inv.status === 'cancelled' ? 'Отменен' : 'Черновик'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
};

export default ClientPortal;
