
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

export interface TaskChecklistItem {
  id: string;
  task_id: string;
  content: string;
  is_completed: boolean;
  created_at: string;
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
  checklist?: TaskChecklistItem[];
}

export interface TransactionPayment {
  id: string;
  transaction_id: string;
  amount: number;
  comment?: string;
  payment_date: string;
  created_by: string;
  created_by_name?: string;
  requires_doc?: boolean;
  doc_type?: 'ТН' | 'ТТН' | 'Акт';
  doc_number?: string;
  doc_date?: string;
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

export interface InventoryCatalogItem {
  id: string;
  name: string;
  item_type: 'product' | 'material'; // Тип ТМЦ
  sku?: string; 
  unit?: string; 
  last_purchase_price?: number; 
  description?: string;
  has_serial: boolean;
  warranty_period_months: number;
  created_at: string;
}

export type InventoryItemStatus = 'in_stock' | 'deployed' | 'maintenance' | 'scrapped';

export interface InventoryItem {
  id: string;
  catalog_id: string;
  serial_number?: string;
  quantity: number; 
  purchase_price?: number; 
  status: InventoryItemStatus;
  current_object_id?: string;
  assigned_to_id?: string;
  warranty_start?: string;
  warranty_end?: string;
  created_at: string;
  
  // Joins
  catalog?: InventoryCatalogItem;
  object?: { id: string; name: string };
}

export interface TableSchema {
  name: string;
  description: string;
  columns: any[];
}

export interface CartItem {
  id: string;
  catalog_name: string;
  quantity: number;
  max_quantity: number;
  serial_number?: string;
  unit: string;
}

// --- Commercial Proposals Types ---

export interface PriceCatalogItem {
  id: string;
  global_category: string;
  item_type: string;
  name: string;
  description?: string;
  price_eur: number;
  markup_percent: number;
  is_active: boolean;
  created_at: string;
  unit: string; // Ensure unit is in interface
}

export interface CommercialProposal {
  id: string;
  number: number;
  title?: string; // Название проекта/КП
  client_id: string;
  status: 'draft' | 'sent' | 'accepted';
  exchange_rate: number;
  global_markup: number;
  has_vat: boolean;
  total_amount_byn?: number;
  header_data?: any;
  created_by: string;
  created_at: string;
  
  // Joins
  client?: { name: string };
  creator?: { full_name: string };
  items?: CPItem[];
}

export interface CPItem {
  id: string;
  cp_id: string;
  catalog_id: string | null; // Nullable if catalog item deleted, but we rely on snapshots now
  quantity: number;
  final_price_byn: number;
  
  // Snapshot Data (Historical integrity)
  snapshot_name?: string;
  snapshot_description?: string;
  snapshot_unit?: string;
  snapshot_base_price_eur?: number;
  snapshot_global_category?: string;
  
  // Legacy Join (Optional)
  catalog?: PriceCatalogItem;
}
