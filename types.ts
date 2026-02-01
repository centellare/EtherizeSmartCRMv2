
export type ObjectStatus = 'in_work' | 'on_pause' | 'review_required' | 'frozen' | 'completed';
export type StageName = 'negotiation' | 'design' | 'logistics' | 'assembly' | 'mounting' | 'commissioning' | 'programming' | 'support';
export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'pending' | 'approved' | 'rejected' | 'partial';

export interface Object {
  id: string;
  name: string;
  address?: string;
  comment?: string;
  current_stage: StageName;
  current_status: ObjectStatus;
  client_id: string;
  responsible_id: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  is_deleted: boolean;
  deleted_at?: string;
}

export interface Task {
  id: string;
  object_id: string;
  stage_id?: string;
  title: string;
  assigned_to: string;
  start_date: string;
  deadline: string;
  status: 'pending' | 'completed';
  comment?: string;
  doc_link?: string;
  doc_name?: string;
  completion_comment?: string;
  completion_doc_link?: string;
  completion_doc_name?: string;
  created_at: string;
  created_by: string;
  completed_at?: string;
  last_edited_at?: string;
  last_edited_by?: string;
}

export interface TransactionPayment {
  id: string;
  transaction_id: string;
  amount: number;
  comment?: string;
  payment_date: string;
  created_by: string;
  created_by_name?: string;
}

export interface Transaction {
  id: string;
  object_id: string;
  type: TransactionType;
  amount: number;
  requested_amount?: number;
  planned_amount?: number;
  planned_date?: string;
  fact_amount?: number;
  status: TransactionStatus;
  category: string;
  description: string;
  doc_link?: string;
  doc_name?: string;
  created_at: string;
  created_by: string;
  created_by_name?: string;
  processed_by?: string;
  processed_at?: string;
  processor_name?: string;
  deleted_at?: string;
  payments?: TransactionPayment[];
  objects?: {
    id: string;
    name: string;
    responsible_id: string;
  };
}

export interface TableSchema {
  name: string;
  description: string;
  columns: any[];
}
