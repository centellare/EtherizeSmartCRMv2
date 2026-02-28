import { useObject, useObjectStages } from './useObjects';
import { useTasks } from './useTasks';
import { useTransactions } from './useTransactions';
import { useStaff } from './useStaff';

export const useObjectWorkflow = (objectId: string, profileId?: string, role?: string) => {
  const canSeeFinances = role === 'admin' || role === 'director' || role === 'manager' || role === 'specialist';

  const { data: object, isLoading: isLoadingObject, refetch: refetchObject } = useObject(objectId);
  const { data: stages = [], isLoading: isLoadingStages } = useObjectStages(objectId);
  
  const { data: tasks = [], isLoading: isLoadingTasks } = useTasks({ objectId });
  
  const { data: transactions = [], isLoading: isLoadingTransactions } = useTransactions({ 
    objectId, 
    userId: profileId,
    isSpecialist: role === 'specialist'
  });

  const { data: staff = [] } = useStaff();

  return {
    object,
    stages,
    tasks,
    transactions: canSeeFinances ? transactions : [],
    staff,
    isLoading: isLoadingObject || isLoadingStages || isLoadingTasks,
    refetchObject
  };
};
