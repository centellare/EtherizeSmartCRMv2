export interface ClientDTO {
  id: string;
  name: string;
  type: 'person' | 'company';
  phone: string | null;
  email: string | null;
  inn: string | null;
  contact_person: string | null;
  manager_id: string | null;
  source: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  is_deleted: boolean;
  
  // Additional fields found in usage
  requisites: string | null;
  lead_source: string | null;
  referred_by: string | null;
  partner_id: string | null;
  address: string | null;
  
  // Joins
  manager?: { full_name: string } | null;
  objects?: any[];
  partner?: any;
}

export interface ObjectDTO {
  id: string;
  name: string;
  address?: string | null;
  comment?: string | null;
  current_stage: 'negotiation' | 'design' | 'logistics' | 'assembly' | 'mounting' | 'commissioning' | 'programming' | 'support';
  current_status: 'in_work' | 'on_pause' | 'review_required' | 'frozen' | 'completed';
  client_id: string | null;
  responsible_id: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  is_deleted: boolean;
  deleted_at?: string | null;
  
  // Joins
  client?: { id: string; name: string } | null;
  responsible?: { id: string; full_name: string } | null;
}

export interface TaskDTO {
  id: string;
  object_id: string | null;
  stage_id?: string | null;
  title: string;
  assigned_to: string;
  start_date: string | null;
  deadline: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  started_at?: string | null;
  comment?: string | null;
  doc_link?: string | null;
  doc_name?: string | null;
  completion_comment?: string | null;
  completion_doc_link?: string | null;
  completion_doc_name?: string | null;
  created_at: string;
  created_by: string | null;
  completed_at?: string | null;
  last_edited_at?: string | null;
  last_edited_by?: string | null;
  
  // Joins
  objects?: { name: string };
  creator?: { full_name: string };
  executor?: { full_name: string };
  checklist?: any[];
  questions?: any[];
}

export interface TransactionDTO {
  id: string;
  object_id: string | null;
  invoice_id?: string | null;
  type: 'income' | 'expense';
  amount: number;
  requested_amount?: number | null;
  planned_amount?: number | null;
  planned_date?: string | null;
  fact_amount?: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'partial';
  category: string | null;
  section?: string | null;
  description: string | null;
  doc_link?: string | null;
  doc_name?: string | null;
  created_at: string;
  created_by: string | null;
  created_by_name?: string;
  processed_by?: string | null;
  processed_at?: string | null;
  updated_at: string;
  deleted_at?: string | null;
  is_deleted: boolean;
  
  // Joins
  objects?: { id: string; name: string; responsible_id: string | null };
  creator?: { full_name: string };
  processor?: { full_name: string };
  payments?: any[];
  processor_name?: string; // Computed
}

export interface PartnerDTO {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  default_commission_percent: number;
  status: 'active' | 'inactive';
  notes: string | null;
  created_at: string;
  updated_at: string;
  
  // Computed / Joins
  total_clients?: number;
  clients?: { count: number }[];
}

export interface ProposalItemDTO {
  id: string;
  cp_id: string | null;
  product_id: string | null;
  quantity: number;
  price_at_moment: number;
  final_price_byn: number;
  snapshot_name: string | null;
  snapshot_description: string | null;
  snapshot_unit: string | null;
  parent_id: string | null;
  
  // Joins
  product?: { name: string; unit: string };
}

export interface ProposalDTO {
  id: string;
  number: number;
  title: string | null;
  client_id: string | null;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  exchange_rate: number;
  discount_percent: number | null;
  has_vat: boolean;
  total_amount_byn: number | null;
  created_by: string | null;
  created_at: string;
  
  // Optional fields
  object_id?: string | null;
  preamble?: string | null;
  footer?: string | null;
  
  // Joins
  client?: { name: string; requisites?: string; address?: string };
  creator?: { full_name: string };
  items?: ProposalItemDTO[];
}

export interface ObjectStageDTO {
  id: string;
  object_id: string;
  stage_name: string; // Changed from stage_id
  status: 'active' | 'completed' | 'pending' | 'rolled_back'; // Added rolled_back
  started_at: string | null;
  completed_at: string | null;
  deadline: string | null;
  responsible_id: string | null;
  created_at: string;
  updated_at?: string; // Made optional
  extension_days?: number | null; // Added based on error message
  
  // Joins
  responsible?: { full_name: string };
}

export interface ProfileDTO {
  id: string;
  full_name: string;
  role: 'admin' | 'director' | 'manager' | 'specialist' | 'storekeeper' | 'client';
  email: string;
  phone?: string | null;
  birth_date?: string | null;
  avatar_url?: string | null;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}
