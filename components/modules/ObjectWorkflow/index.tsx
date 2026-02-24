
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../lib/supabase';
import { Button, Modal, Input, Select, ConfirmModal, Drawer, useToast } from '../../ui';
import { WorkflowHeader } from './WorkflowHeader';
import { StageTimeline } from './StageTimeline';
import { TasksTab } from './TasksTab';
import { FinancesTab } from './FinancesTab';
import { ArchiveTab } from './ArchiveTab';
import { SupplyTab } from './SupplyTab';
import { TimelineTab } from './TimelineTab'; // Import Timeline
import CPGenerator from '../Proposals/CPGenerator';
import { ClientDetails } from '../Clients/modals/ClientDetails';

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
  const [viewedStageId, setViewedStageId] = useState<string>(initialStageId || initialObject.current_stage || 'negotiation');
  const [tasks, setTasks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<any[]>([]);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  
  // Client Viewing State
  const [clientToView, setClientToView] = useState<any>(null);
  
  const toast = useToast();

  // Modals state
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [isRollbackModalOpen, setIsRollbackModalOpen] = useState(false);
  const [isPendingTasksWarningOpen, setIsPendingTasksWarningOpen] = useState(false);
  const [autoOpenTaskModal, setAutoOpenTaskModal] = useState(false);
  const [directorConfirmed, setDirectorConfirmed] = useState(false);
  
  // New CP Modal State
  const [isCPModalOpen, setIsCPModalOpen] = useState(false);

  const [stageForm, setStageForm] = useState({ next_stage: '', responsible_id: '', deadline: '' });
  const [rollbackForm, setRollbackForm] = useState({ reason: '', responsible_id: '' });

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

      const { data: stagesData } = await supabase.from('object_stages').select('*').eq('object_id', object.id).order('created_at', { ascending: true });
      setAllStagesData(stagesData || []);

      const { data: tasksData } = await supabase.from('tasks').select(`*, executor:profiles!assigned_to(id, full_name), creator:profiles!created_by(id, full_name)`).eq('object_id', object.id).is('is_deleted', false).order('created_at', { ascending: false });
      setTasks(tasksData || []);

      if (canSeeFinances) {
        let query = supabase.from('transactions').select(`*, objects(id, name), creator:profiles!transactions_created_by_fkey(full_name), payments:transaction_payments(*, creator:profiles!transaction_payments_created_by_fkey(full_name))`).eq('object_id', object.id).is('deleted_at', null);
        if (isSpecialist) {
          query = query.eq('created_by', profile.id).eq('type', 'expense');
        }
        const { data: transData } = await query.order('created_at', { ascending: false }).limit(100);
        setTransactions(transData || []);
      }
      
      const { data: staffData } = await supabase.from('profiles').select('id, full_name, role').is('deleted_at', null);
      setStaff(staffData || []);
    } catch (e) { 
      console.error('Fetch error:', e); 
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [object.id, profile?.id]);

  const updateObjectStatus = async (newStatus: string) => {
    if (!profile?.id) return;
    setLoading(true);
    const { error } = await supabase.from('objects').update({ current_status: newStatus, updated_by: profile.id, updated_at: new Date().toISOString() }).eq('id', object.id);
    if (!error) {
      toast.success('Статус объекта обновлен');
      await fetchData();
    } else {
      toast.error('Ошибка обновления статуса');
    }
  };

  const handleNextStageInit = (force = false) => {
    const pending = tasks.filter(t => t.stage_id === object.current_stage && t.status !== 'completed');
    if (!force && pending.length > 0) {
      setIsPendingTasksWarningOpen(true);
      return;
    }
    if (isLastStage) {
      handleFinalizeProject();
    } else {
      setStageForm({ next_stage: nextStage?.id || '', responsible_id: '', deadline: '' });
      setDirectorConfirmed(false);
      setIsStageModalOpen(true);
    }
  };

  const handleFinalizeProject = async () => {
    setLoading(true);
    try {
      await supabase.rpc('finalize_project', { p_object_id: object.id, p_user_id: profile.id });
      toast.success('Проект успешно завершен!');
      onBack();
    } catch (err: any) {
      toast.error('Ошибка при завершении проекта');
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
        p_deadline: stageForm.deadline ? new Date(stageForm.deadline).toISOString() : null,
        p_user_id: profile.id
      });
      
      if (error) throw error;

      setIsStageModalOpen(false);
      toast.success('Переход на новый этап выполнен');
      await fetchData();
    } catch (err: any) { 
      console.error(err);
      toast.error(err.message || 'Ошибка перехода');
    }
    setLoading(false);
  };

  const handleRollback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !rollbackForm.responsible_id) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('rollback_object_stage', {
        p_object_id: object.id,
        p_target_stage: viewedStageId,
        p_reason: rollbackForm.reason,
        p_responsible_id: rollbackForm.responsible_id,
        p_user_id: profile.id
      });
      
      if (error) throw error;

      setIsRollbackModalOpen(false);
      setAutoOpenTaskModal(true);
      toast.success('Объект возвращен на доработку');
      await fetchData();
    } catch (err: any) { 
       console.error(err);
       toast.error(err.message || 'Ошибка возврата');
    }
    setLoading(false);
  };

  const handleJumpForward = async () => {
    if (!profile?.id || !object.rolled_back_from) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('restore_object_stage', {
        p_object_id: object.id,
        p_user_id: profile.id
      });
      
      if (error) throw error;

      toast.success('Этап успешно восстановлен');
      await fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Ошибка восстановления этапа');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenClient = async () => {
    if (!object.client_id) return;
    setLoading(true);
    try {
        const { data: client } = await supabase.from('clients').select('*, manager:profiles!fk_clients_manager(full_name), objects!fk_objects_client(id, name, is_deleted)').eq('id', object.client_id).single();
        if (client) {
            setClientToView(client);
        } else {
            toast.error('Клиент не найден');
        }
    } catch (e) {
        console.error(e);
        toast.error('Ошибка загрузки клиента');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-300 h-full flex flex-col">
      
      <div className="bg-white rounded-[32px] p-8 border border-[#e1e2e1] mb-8 shadow-sm flex-shrink-0">
        <WorkflowHeader 
          object={object} 
          allStagesData={allStagesData}
          profile={profile} 
          onBack={onBack} 
          onUpdateStatus={updateObjectStatus}
          onOpenClient={handleOpenClient}
          canManage={canManage}
          isExpanded={isHeaderExpanded}
          onToggle={() => setIsHeaderExpanded(!isHeaderExpanded)}
        />
        {isHeaderExpanded && (
          <StageTimeline object={object} allStagesData={allStagesData} viewedStageId={viewedStageId} setViewedStageId={setViewedStageId} />
        )}
      </div>

      <div className="flex gap-2 mb-6 bg-slate-100 p-1.5 rounded-full w-fit overflow-x-auto flex-shrink-0">
        <button onClick={() => setActiveTab('stage')} className={`px-5 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${activeTab === 'stage' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>Этап</button>
        <button onClick={() => setActiveTab('supply')} className={`px-5 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${activeTab === 'supply' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>Снабжение</button>
        {canSeeFinances && <button onClick={() => setActiveTab('finance')} className={`px-5 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${activeTab === 'finance' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>Финансы</button>}
        <button onClick={() => setActiveTab('timeline')} className={`px-5 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${activeTab === 'timeline' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>Хронология</button>
        <button onClick={() => setActiveTab('docs')} className={`px-5 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${activeTab === 'docs' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>Архив</button>
      </div>

      <div className="flex-grow">
        {activeTab === 'stage' && (
            <TasksTab 
            object={object} profile={profile} viewedStageId={viewedStageId} tasks={tasks} staff={staff} canManage={canManage}
            refreshData={fetchData} 
            onStartNextStage={handleNextStageInit} 
            onJumpForward={handleJumpForward} 
            onRollback={() => { setRollbackForm({ reason: '', responsible_id: '' }); setIsRollbackModalOpen(true); }}
            updateStatus={updateObjectStatus} forceOpenTaskModal={autoOpenTaskModal} onTaskModalOpened={() => setAutoOpenTaskModal(false)}
            />
        )}

        {activeTab === 'supply' && (
            <SupplyTab 
                object={object} 
                profile={profile}
                onCreateCP={() => setIsCPModalOpen(true)}
            />
        )}

        {activeTab === 'finance' && canSeeFinances && (
            <FinancesTab object={object} profile={profile} transactions={transactions} isAdmin={isAdmin} refreshData={fetchData} />
        )}

        {activeTab === 'timeline' && (
            <TimelineTab object={object} profile={profile} />
        )}

        {activeTab === 'docs' && (
            <ArchiveTab tasks={tasks} profile={profile} />
        )}
      </div>

      {/* CP Creation Modal */}
      {isCPModalOpen && createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-100 flex flex-col animate-in fade-in slide-in-from-bottom-4">
              <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center shadow-sm shrink-0">
                  <div>
                      <h3 className="text-xl font-bold text-slate-800">Создание КП</h3>
                      <p className="text-xs text-slate-500">для объекта: {object.name}</p>
                  </div>
                  <button 
                    onClick={() => setIsCPModalOpen(false)} 
                    className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors text-slate-500"
                  >
                      <span className="material-icons-round">close</span>
                  </button>
              </div>
              <div className="flex-grow p-4 md:p-6 overflow-hidden">
                  <div className="bg-white rounded-[32px] h-full shadow-lg border border-slate-200 overflow-hidden p-2">
                      <CPGenerator 
                          profile={profile} 
                          initialObjectId={object.id}
                          onSuccess={() => { setIsCPModalOpen(false); toast.success('КП создано'); }}
                          onCancel={() => setIsCPModalOpen(false)}
                      />
                  </div>
              </div>
          </div>,
          document.body
      )}

      {/* Client Details Drawer */}
      <Drawer isOpen={!!clientToView} onClose={() => setClientToView(null)} title="Информация о клиенте">
        {clientToView && (
            <ClientDetails 
                client={clientToView} 
                onClose={() => setClientToView(null)} 
                onNavigateToObject={(id) => { 
                    setClientToView(null);
                    window.location.hash = `objects/${id}`;
                }}
                onAddObject={() => {}} // Disabled here
            />
        )}
      </Drawer>

      <Modal isOpen={isStageModalOpen} onClose={() => setIsStageModalOpen(false)} title={`Переход к этапу: ${nextStage?.label}`}>
        <form onSubmit={handleNextStage} className="space-y-5">
           <Select label="Ответственный" required value={stageForm.responsible_id} onChange={(e:any) => setStageForm({...stageForm, responsible_id: e.target.value})} options={[{value:'', label:'Выберите сотрудника'}, ...staff.map(s => ({value: s.id, label: s.full_name}))]} icon="person" />
           <Input label="Дедлайн" type="date" required value={stageForm.deadline} onChange={(e:any) => setStageForm({...stageForm, deadline: e.target.value})} icon="event_available" />
           <Button type="submit" className="w-full h-14" icon="rocket_launch" loading={loading}>Начать новый этап</Button>
        </form>
      </Modal>

      <Modal isOpen={isRollbackModalOpen} onClose={() => setIsRollbackModalOpen(false)} title="Возврат на этап">
        <form onSubmit={handleRollback} className="space-y-4">
           <Select label="Кто будет исправлять?" required value={rollbackForm.responsible_id} onChange={(e:any) => setRollbackForm({...rollbackForm, responsible_id: e.target.value})} options={[{value:'', label:'Выберите ответственного'}, ...staff.map(s => ({value: s.id, label: s.full_name}))]} icon="support_agent" />
           <textarea required className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm" rows={3} value={rollbackForm.reason} onChange={(e) => setRollbackForm({...rollbackForm, reason: e.target.value})} placeholder="Причина возврата..." />
           <Button type="submit" variant="danger" className="w-full h-12" icon="settings_backup_restore" loading={loading}>Подтвердить откат</Button>
        </form>
      </Modal>

      <ConfirmModal isOpen={isPendingTasksWarningOpen} onClose={() => setIsPendingTasksWarningOpen(false)} onConfirm={() => { setIsPendingTasksWarningOpen(false); handleNextStageInit(true); }} title="Незавершенные задачи" message="На текущем этапе остались незавершенные задачи. Продолжить?" confirmLabel="Да, продолжить" confirmVariant="primary" />
    </div>
  );
};

export default ObjectWorkflow;
