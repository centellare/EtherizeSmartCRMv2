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
import { TimelineTab } from './TimelineTab';
import CPGenerator from '../Proposals/CPGenerator';
import { ClientDetails } from '../Clients/modals/ClientDetails';
import { useObjectWorkflow } from '../../../hooks/useObjectWorkflow';
import { useObjectWorkflowMutations } from '../../../hooks/useObjectWorkflowMutations';
import { useQueryClient } from '@tanstack/react-query';

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
  const [viewedStageId, setViewedStageId] = useState<string>(initialStageId || initialObject.current_stage || 'negotiation');
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [clientToView, setClientToView] = useState<any>(null);
  
  // Modals state
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [isRollbackModalOpen, setIsRollbackModalOpen] = useState(false);
  const [isPendingTasksWarningOpen, setIsPendingTasksWarningOpen] = useState(false);
  const [autoOpenTaskModal, setAutoOpenTaskModal] = useState(false);
  const [isCPModalOpen, setIsCPModalOpen] = useState(false);

  const [stageForm, setStageForm] = useState({ next_stage: '', responsible_id: '', deadline: '' });
  const [rollbackForm, setRollbackForm] = useState({ reason: '', responsible_id: '' });

  const queryClient = useQueryClient();
  const toast = useToast();

  // Hooks
  const { object, stages, tasks, transactions, staff, isLoading, refetchObject } = useObjectWorkflow(initialObject.id, profile?.id, profile?.role);
  const mutations = useObjectWorkflowMutations(initialObject.id);

  // Use fetched object or initial
  const currentObject = object || initialObject;

  const role = profile?.role || 'specialist';
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isDirector = role === 'director';
  const isSpecialist = role === 'specialist';
  
  const canManage = isAdmin || isDirector || isManager;
  const canSeeFinances = isAdmin || isDirector || (isManager && currentObject.responsible_id === profile?.id) || isSpecialist;

  const currentStageIndex = STAGES.findIndex(s => s.id === currentObject.current_stage);
  const nextStage = STAGES[currentStageIndex + 1] || null;
  const isLastStage = currentStageIndex === STAGES.length - 1;

  // Update viewed stage if object updates (and we are viewing current)
  useEffect(() => {
    if (object && object.current_stage !== initialObject.current_stage && viewedStageId === initialObject.current_stage) {
        setViewedStageId(object.current_stage);
    }
  }, [object?.current_stage]);

  const handleNextStageInit = (force = false) => {
    const pending = tasks.filter((t: any) => t.stage_id === currentObject.current_stage && t.status !== 'completed');
    if (!force && pending.length > 0) {
      setIsPendingTasksWarningOpen(true);
      return;
    }
    if (isLastStage) {
      mutations.finalizeProject.mutate(profile.id, { onSuccess: onBack });
    } else {
      setStageForm({ next_stage: nextStage?.id || '', responsible_id: '', deadline: '' });
      setIsStageModalOpen(true);
    }
  };

  const handleNextStage = (e: React.FormEvent) => {
    e.preventDefault();
    mutations.nextStage.mutate({
        nextStage: stageForm.next_stage,
        responsibleId: stageForm.responsible_id,
        deadline: stageForm.deadline || null,
        userId: profile.id
    }, {
        onSuccess: () => setIsStageModalOpen(false)
    });
  };

  const handleRollback = (e: React.FormEvent) => {
    e.preventDefault();
    mutations.rollbackStage.mutate({
        targetStage: viewedStageId,
        reason: rollbackForm.reason,
        responsibleId: rollbackForm.responsible_id,
        userId: profile.id
    }, {
        onSuccess: () => {
            setIsRollbackModalOpen(false);
            setAutoOpenTaskModal(true);
        }
    });
  };

  const handleJumpForward = () => {
      mutations.restoreStage.mutate(profile.id);
  };

  const handleOpenClient = async () => {
    if (!currentObject.client_id) return;
    const { data } = await supabase.from('clients').select('*, manager:profiles!fk_clients_manager(full_name), objects!fk_objects_client(id, name, is_deleted)').eq('id', currentObject.client_id).single();
    if (data) setClientToView(data);
    else toast.error('Клиент не найден');
  };

  const refreshData = async () => {
      await refetchObject();
      queryClient.invalidateQueries({ queryKey: ['tasks'] }); // Invalidate global tasks
      queryClient.invalidateQueries({ queryKey: ['transactions'] }); // Invalidate global transactions
  };

  if (isLoading && !object) return <div className="p-10 text-center">Загрузка...</div>;

  return (
    <div className="animate-in fade-in duration-300 h-full flex flex-col">
      <div className="bg-white rounded-[32px] p-8 border border-[#e1e2e1] mb-8 shadow-sm flex-shrink-0">
        <WorkflowHeader 
          object={currentObject} 
          allStagesData={stages}
          profile={profile} 
          onBack={onBack} 
          onUpdateStatus={(s) => mutations.updateStatus.mutate({ status: s, userId: profile.id })}
          onOpenClient={handleOpenClient}
          canManage={canManage}
          isExpanded={isHeaderExpanded}
          onToggle={() => setIsHeaderExpanded(!isHeaderExpanded)}
        />
        {isHeaderExpanded && (
          <StageTimeline object={currentObject} allStagesData={stages} viewedStageId={viewedStageId} setViewedStageId={setViewedStageId} />
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
            object={currentObject} profile={profile} viewedStageId={viewedStageId} tasks={tasks} staff={staff} canManage={canManage}
            refreshData={refreshData} 
            onStartNextStage={() => handleNextStageInit(false)} 
            onJumpForward={handleJumpForward} 
            onRollback={() => { setRollbackForm({ reason: '', responsible_id: '' }); setIsRollbackModalOpen(true); }}
            updateStatus={(s) => mutations.updateStatus.mutate({ status: s, userId: profile.id })} 
            forceOpenTaskModal={autoOpenTaskModal} onTaskModalOpened={() => setAutoOpenTaskModal(false)}
            />
        )}

        {activeTab === 'supply' && (
            <SupplyTab 
                object={currentObject} 
                profile={profile}
                onCreateCP={() => setIsCPModalOpen(true)}
            />
        )}

        {activeTab === 'finance' && canSeeFinances && (
            <FinancesTab object={currentObject} profile={profile} transactions={transactions} isAdmin={isAdmin} refreshData={refreshData} />
        )}

        {activeTab === 'timeline' && (
            <TimelineTab object={currentObject} profile={profile} />
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
                      <p className="text-xs text-slate-500">для объекта: {currentObject.name}</p>
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
                          initialObjectId={currentObject.id}
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
                onAddObject={() => {}} 
            />
        )}
      </Drawer>

      <Modal isOpen={isStageModalOpen} onClose={() => setIsStageModalOpen(false)} title={`Переход к этапу: ${nextStage?.label}`}>
        <form onSubmit={handleNextStage} className="space-y-5">
           <Select label="Ответственный" required value={stageForm.responsible_id} onChange={(e:any) => setStageForm({...stageForm, responsible_id: e.target.value})} options={[{value:'', label:'Выберите сотрудника'}, ...staff.map(s => ({value: s.id, label: s.full_name}))]} icon="person" />
           <Input label="Дедлайн" type="date" required value={stageForm.deadline} onChange={(e:any) => setStageForm({...stageForm, deadline: e.target.value})} icon="event_available" />
           <Button type="submit" className="w-full h-14" icon="rocket_launch" loading={mutations.nextStage.isPending}>Начать новый этап</Button>
        </form>
      </Modal>

      <Modal isOpen={isRollbackModalOpen} onClose={() => setIsRollbackModalOpen(false)} title="Возврат на этап">
        <form onSubmit={handleRollback} className="space-y-4">
           <Select label="Кто будет исправлять?" required value={rollbackForm.responsible_id} onChange={(e:any) => setRollbackForm({...rollbackForm, responsible_id: e.target.value})} options={[{value:'', label:'Выберите ответственного'}, ...staff.map(s => ({value: s.id, label: s.full_name}))]} icon="support_agent" />
           <textarea required className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm" rows={3} value={rollbackForm.reason} onChange={(e) => setRollbackForm({...rollbackForm, reason: e.target.value})} placeholder="Причина возврата..." />
           <Button type="submit" variant="danger" className="w-full h-12" icon="settings_backup_restore" loading={mutations.rollbackStage.isPending}>Подтвердить откат</Button>
        </form>
      </Modal>

      <ConfirmModal isOpen={isPendingTasksWarningOpen} onClose={() => setIsPendingTasksWarningOpen(false)} onConfirm={() => { setIsPendingTasksWarningOpen(false); handleNextStageInit(true); }} title="Незавершенные задачи" message="На текущем этапе остались незавершенные задачи. Продолжить?" confirmLabel="Да, продолжить" confirmVariant="primary" />
    </div>
  );
};

export default ObjectWorkflow;
