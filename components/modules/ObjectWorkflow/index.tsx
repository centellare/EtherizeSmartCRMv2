
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Badge, Modal, Input, Select, ConfirmModal, Toast } from '../../ui';
import { WorkflowHeader } from './WorkflowHeader';
import { StageTimeline } from './StageTimeline';
import { TasksTab } from './TasksTab';
import { FinancesTab } from './FinancesTab';
import { ArchiveTab } from './ArchiveTab';

const STAGES = [
  { id: 'negotiation', label: 'Переговоры' },
  { id: 'design', label: 'Проектирование' },
  { id: 'logistics', label: 'Логистика' },
  { id: 'assembly', label: 'Сборка' },
  { id: 'mounting', label: 'Монтаж' },
  { id: 'commissioning', label: 'Пусконаладка' },
  { id: 'programming', label: 'Программирование' },
  { id: 'support', label: 'Поддержка' }
];

interface ObjectWorkflowProps {
  object: any;
  profile: any;
  initialStageId?: string | null;
  onBack: () => void;
}

const ObjectWorkflow: React.FC<ObjectWorkflowProps> = ({ object: initialObject, profile, initialStageId, onBack }) => {
  const [activeTab, setActiveTab] = useState('stage');
  const [object, setObject] = useState(initialObject);
  const [allStagesData, setAllStagesData] = useState<any[]>([]);
  const [viewedStageId, setViewedStageId] = useState<string>(initialStageId || initialObject.current_stage);
  const [tasks, setTasks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<any[]>([]);
  
  // Feedback
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Modals state
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [isRollbackModalOpen, setIsRollbackModalOpen] = useState(false);
  const [isJumpModalOpen, setIsJumpModalOpen] = useState(false);
  const [isPendingTasksWarningOpen, setIsPendingTasksWarningOpen] = useState(false);
  const [autoOpenTaskModal, setAutoOpenTaskModal] = useState(false);
  const [directorConfirmed, setDirectorConfirmed] = useState(false);

  const [stageForm, setStageForm] = useState({ next_stage: '', responsible_id: '', deadline: '' });
  const [rollbackForm, setRollbackForm] = useState({ reason: '' });
  const [jumpForm, setJumpForm] = useState({ deadline: '' });

  const role = profile?.role || 'specialist';
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isDirector = role === 'director';
  const isSpecialist = role === 'specialist';
  
  const canManage = isAdmin || isDirector || isManager;
  const canSeeFinances = isAdmin || isDirector || (isManager && object.responsible_id === profile?.id) || isSpecialist;

  const currentStageIndex = STAGES.findIndex(s => s.id === object.current_stage);
  const nextStage = STAGES[currentStageIndex + 1] || null;
  const isLastStage = currentStageIndex === STAGES.length - 1;

  const fetchData = async () => {
    if (!object?.id) return;
    setLoading(true);
    try {
      const { data: currentObj } = await supabase.from('objects').select('*, client:clients(name), responsible:profiles!responsible_id(id, full_name)').eq('id', object.id).single();
      if (currentObj) setObject(currentObj);

      const { data: stagesData } = await supabase
        .from('object_stages')
        .select('*')
        .eq('object_id', object.id)
        .order('created_at', { ascending: true });
      
      setAllStagesData(stagesData || []);

      const { data: tasksData } = await supabase
        .from('tasks')
        .select(`*, executor:profiles!assigned_to(id, full_name), creator:profiles!created_by(id, full_name)`)
        .eq('object_id', object.id)
        .is('is_deleted', false)
        .order('created_at', { ascending: false });
      
      setTasks(tasksData || []);

      if (canSeeFinances) {
        let query = supabase
          .from('transactions')
          .select(`
            *, 
            creator:profiles!transactions_created_by_fkey(full_name),
            payments:transaction_payments(
              *, 
              creator:profiles!transaction_payments_created_by_fkey(full_name)
            )
          `)
          .eq('object_id', object.id)
          .is('deleted_at', null);

        if (isSpecialist) {
          query = query.eq('created_by', profile.id).eq('type', 'expense');
        }

        const { data: transData } = await query.order('created_at', { ascending: false }).limit(100);
        
        const mappedTrans = (transData || []).map(t => {
          const payments = (t.payments || []).map((p: any) => ({
            ...p,
            created_by_name: p.creator?.full_name || 'Неизвестно'
          })).sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

          return {
            ...t,
            payments,
            created_by_name: t.creator?.full_name || 'Система',
            last_payment_date: payments.length > 0 ? payments[0].payment_date : null
          };
        });

        setTransactions(mappedTrans);
      }
      const { data: staffData } = await supabase.from('profiles').select('id, full_name, role').is('deleted_at', null);
      setStaff(staffData || []);
    } catch (e) { 
      console.error('Fetch error:', e); 
      setToast({ message: 'Ошибка загрузки данных', type: 'error' });
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [object.id, profile?.id]);

  const updateObjectStatus = async (newStatus: string) => {
    if (!profile?.id) return;
    setLoading(true);
    const { error } = await supabase.from('objects').update({ current_status: newStatus, updated_by: profile.id, updated_at: new Date().toISOString() }).eq('id', object.id);
    if (!error) {
      setToast({ message: 'Статус объекта обновлен', type: 'success' });
      await fetchData();
    } else {
      setToast({ message: 'Ошибка обновления статуса', type: 'error' });
    }
  };

  const handleNextStageInit = (force = false) => {
    const pending = tasks.filter(t => t.stage_id === object.current_stage && t.status === 'pending');
    if (!force && pending.length > 0) {
      setIsPendingTasksWarningOpen(true);
      return;
    }

    if (isLastStage) {
      handleFinalizeProject();
    } else {
      setStageForm({ 
        next_stage: nextStage?.id || '', 
        responsible_id: '', 
        deadline: '' 
      });
      setDirectorConfirmed(false);
      setIsStageModalOpen(true);
    }
  };

  const handleFinalizeProject = async () => {
    setLoading(true);
    try {
      // Атомарное закрытие проекта через RPC (новая рекомендация)
      const { error } = await supabase.rpc('finalize_project', {
        p_object_id: object.id,
        p_user_id: profile.id
      });
      
      if (error) throw error;
      
      setToast({ message: 'Проект успешно завершен!', type: 'success' });
      onBack();
    } catch (err: any) {
      console.error(err);
      setToast({ message: 'Ошибка при завершении проекта', type: 'error' });
    }
    setLoading(false);
  };

  const handleNextStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('transition_object_stage', {
        p_object_id: object.id,
        p_next_stage: stageForm.next_stage,
        p_responsible_id: stageForm.responsible_id,
        p_deadline: stageForm.deadline || null,
        p_user_id: profile.id
      });
      
      if (error) throw error;
      setIsStageModalOpen(false);
      setToast({ message: 'Переход на новый этап выполнен', type: 'success' });
      await fetchData();
    } catch (err: any) { 
      setToast({ message: err.message || 'Ошибка перехода', type: 'error' });
    }
    setLoading(false);
  };

  const handleRollback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('rollback_object_stage', {
        p_object_id: object.id,
        p_target_stage: viewedStageId,
        p_reason: rollbackForm.reason,
        p_user_id: profile.id
      });

      if (error) throw error;

      setIsRollbackModalOpen(false);
      setRollbackForm({ reason: '' });
      setAutoOpenTaskModal(true);
      setToast({ message: 'Объект возвращен на этап', type: 'success' });
      await fetchData();
    } catch (err: any) { 
       setToast({ message: 'Ошибка возврата', type: 'error' });
    }
    setLoading(false);
  };

  const isDirectorSelected = staff.find(s => s.id === stageForm.responsible_id)?.role === 'director';

  return (
    <div className="animate-in fade-in duration-300">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="bg-white rounded-[32px] p-8 border border-[#e1e2e1] mb-8 shadow-sm">
        <WorkflowHeader 
          object={object} 
          allStagesData={allStagesData}
          profile={profile} 
          onBack={onBack} 
          onUpdateStatus={updateObjectStatus}
          canManage={canManage}
        />
        <StageTimeline 
          object={object}
          allStagesData={allStagesData}
          viewedStageId={viewedStageId}
          setViewedStageId={setViewedStageId}
        />
      </div>

      <div className="flex gap-2 mb-6 bg-slate-100 p-1.5 rounded-full w-fit">
        <button onClick={() => setActiveTab('stage')} className={`px-5 py-1.5 rounded-full text-xs font-bold uppercase ${activeTab === 'stage' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>Этап</button>
        {canSeeFinances && <button onClick={() => setActiveTab('finance')} className={`px-5 py-1.5 rounded-full text-xs font-bold uppercase ${activeTab === 'finance' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>Финансы</button>}
        <button onClick={() => setActiveTab('docs')} className={`px-5 py-1.5 rounded-full text-xs font-bold uppercase ${activeTab === 'docs' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>Архив</button>
      </div>

      {activeTab === 'stage' && (
        <TasksTab 
          object={object}
          profile={profile}
          viewedStageId={viewedStageId}
          tasks={tasks}
          staff={staff}
          canManage={canManage}
          refreshData={fetchData}
          onStartNextStage={handleNextStageInit}
          onJumpForward={() => setIsJumpModalOpen(true)}
          onRollback={() => setIsRollbackModalOpen(true)}
          updateStatus={updateObjectStatus}
          forceOpenTaskModal={autoOpenTaskModal}
          onTaskModalOpened={() => setAutoOpenTaskModal(false)}
        />
      )}

      {activeTab === 'finance' && canSeeFinances && (
        <FinancesTab 
          object={object}
          profile={profile}
          transactions={transactions}
          isAdmin={isAdmin}
          refreshData={fetchData}
        />
      )}

      {activeTab === 'docs' && (
        <ArchiveTab tasks={tasks} profile={profile} />
      )}

      {/* Modals remained identical, but benefit from Toast feedback */}
      <Modal isOpen={isStageModalOpen} onClose={() => setIsStageModalOpen(false)} title={`Переход к этапу: ${nextStage?.label}`}>
        <form onSubmit={handleNextStage} className="space-y-5">
           <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl mb-4">
             <p className="text-sm text-blue-800 flex items-center gap-2 font-medium">
               <span className="material-icons-round text-lg">info</span>
               Текущий этап будет завершен автоматически.
             </p>
           </div>
           
           <Select 
            label="Ответственный за новый этап" 
            required 
            value={stageForm.responsible_id} 
            onChange={(e:any) => setStageForm({...stageForm, responsible_id: e.target.value})} 
            options={[
              {value:'', label:'Выберите сотрудника'}, 
              ...staff.map(s => ({value: s.id, label: `${s.full_name} (${s.role === 'director' ? 'Директор' : s.role === 'manager' ? 'Менеджер' : 'Специалист'})`}))
            ]} 
            icon="person" 
           />

           <Input 
            label="Дедлайн этапа" 
            type="date" 
            required 
            value={stageForm.deadline} 
            onChange={(e:any) => setStageForm({...stageForm, deadline: e.target.value})} 
            icon="event_available" 
           />

           {isDirectorSelected && (
             <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
               <label className="flex items-center gap-3 cursor-pointer">
                 <input type="checkbox" checked={directorConfirmed} onChange={(e) => setDirectorConfirmed(e.target.checked)} />
                 <span className="text-xs font-bold text-amber-800 uppercase tracking-tight">Я подтверждаю назначение Директора</span>
               </label>
             </div>
           )}

           <Button type="submit" className="w-full h-14" icon="rocket_launch" disabled={isDirectorSelected && !directorConfirmed} loading={loading}>Начать новый этап</Button>
        </form>
      </Modal>

      <Modal isOpen={isRollbackModalOpen} onClose={() => setIsRollbackModalOpen(false)} title="Возврат на этап">
        <form onSubmit={handleRollback} className="space-y-4">
           <p className="text-sm text-slate-500 mb-2">Вы собираетесь вернуть объект на этап <b>{STAGES.find(s => s.id === viewedStageId)?.label}</b>.</p>
           <div className="w-full">
            <label className="block text-xs font-medium text-[#444746] mb-1.5 ml-1">Причина возврата (обязательно)</label>
            <textarea required className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm outline-none focus:border-blue-500 shadow-inner" rows={3} value={rollbackForm.reason} onChange={(e) => setRollbackForm({...rollbackForm, reason: e.target.value})} placeholder="Укажите замечания..." />
           </div>
           <Button type="submit" variant="danger" className="w-full h-12" icon="settings_backup_restore" loading={loading}>Подтвердить откат</Button>
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={isPendingTasksWarningOpen}
        onClose={() => setIsPendingTasksWarningOpen(false)}
        onConfirm={() => {
          setIsPendingTasksWarningOpen(false);
          handleNextStageInit(true);
        }}
        title="Незавершенные задачи"
        message="На текущем этапе остались незавершенные задачи. Продолжить переход?"
        confirmLabel="Да, продолжить"
        cancelLabel="Отмена"
        confirmVariant="primary"
      />
    </div>
  );
};

export default ObjectWorkflow;
