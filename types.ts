
export type ObjectStatus = 'in_work' | 'on_pause' | 'review_required' | 'frozen' | 'completed';
export type StageName = 'negotiation' | 'design' | 'logistics' | 'assembly' | 'mounting' | 'commissioning' | 'programming' | 'support';
export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'pending' | 'approved' | 'rejected' | 'partial';

export interface Object {
  id: string;
  name: string;
  address?: string | null;
  comment?: string | null;
  current_stage: StageName;
  current_status: ObjectStatus;
  client_id: string | null;
  responsible_id: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  is_deleted: boolean;
  deleted_at?: string | null;
}

export interface TaskChecklistItem {
  id: string;
  task_id: string;
  content: string;
  is_completed: boolean;
  created_at: string;
}

export interface TaskQuestion {
  id: string;
  task_id: string;
  question: string;
  answer?: string | null;
  answered_at?: string | null;
  answered_by?: string | null;
  created_at: string;
  created_by?: string | null;
}

export interface Task {
  id: string;
  object_id: string | null;
  stage_id?: string | null;
  title: string;
  assigned_to: string;
  start_date: string | null;
  deadline: string | null;
  status: 'pending' | 'completed';
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
  checklist?: TaskChecklistItem[];
  questions?: TaskQuestion[];
  objects?: { name: string };
  creator?: { full_name: string };
  executor?: { full_name: string };
}

export interface TransactionPayment {
  id: string;
  transaction_id: string;
  amount: number;
  comment?: string | null;
  payment_date: string;
  created_by: string;
  created_by_name?: string;
  requires_doc?: boolean;
  doc_type?: 'ТН' | 'ТТН' | 'Акт' | null;
  doc_number?: string | null;
  doc_date?: string | null;
}

export interface Transaction {
  id: string;
  object_id: string | null;
  invoice_id?: string | null; // NEW: Link to invoice
  type: TransactionType;
  amount: number;
  requested_amount?: number | null;
  planned_amount?: number | null;
  planned_date?: string | null;
  fact_amount?: number | null;
  status: TransactionStatus;
  category: string | null;
  description: string | null;
  doc_link?: string | null;
  doc_name?: string | null;
  created_at: string;
  created_by: string | null;
  created_by_name?: string;
  processed_by?: string | null;
  processed_at?: string | null;
  processor_name?: string;
  deleted_at?: string | null;
  payments?: TransactionPayment[];
  objects?: {
    id: string;
    name: string;
    responsible_id: string | null;
  };
}

// --- Unified ERP 2.0 Product Master ---
export interface Product {
  id: string;
  name: string;
  sku?: string | null;
  category: string;
  type: 'product' | 'material' | 'service';
  unit: string;
  base_price: number; // Cost / Закупка (BYN)
  retail_price: number; // Sales / Продажа (BYN)
  description?: string | null;
  manufacturer?: string | null; // Added
  origin_country?: string | null; // Added
  weight?: number | null; // Added
  has_serial: boolean;
  warranty_days: number | null;
  stock_min_level?: number;
  image_url?: string | null; // NEW: Product Image
  is_archived: boolean;
  created_at: string;
  markup_percent?: number; // Individual Delta
}

export interface PriceRule {
  id: string;
  category_name: string;
  markup_delta: number;
}

export type InventoryItemStatus = 'in_stock' | 'deployed' | 'maintenance' | 'scrapped' | 'reserved';

export interface InventoryItem {
  id: string;
  product_id: string;
  serial_number?: string | null;
  quantity: number; 
  purchase_price?: number | null; // Фактическая цена партии (BYN)
  status: InventoryItemStatus;
  current_object_id?: string | null;
  assigned_to_id?: string | null;
  warranty_start?: string | null;
  warranty_end?: string | null;
  reserved_for_invoice_id?: string | null; // NEW: Reservation Link
  created_at: string;
  
  // Joins
  product?: Product;
  object?: { id: string; name: string };
  invoice?: { number: number };
  
  // Legacy support placeholders (to prevent crash before full migration)
  catalog_id?: string;
  catalog?: any;
}

export interface TableSchema {
  name: string;
  description: string;
  columns: any[];
}

export interface CommercialProposal {
  id: string;
  number: number;
  title?: string | null;
  client_id: string | null;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  exchange_rate: number; // Deprecated, always 1
  discount_percent: number | null;
  has_vat: boolean;
  total_amount_byn?: number | null;
  created_by: string | null;
  created_at: string;
  client?: { name: string; requisites?: string; address?: string };
  creator?: { full_name: string };
  items?: CPItem[];
}

export interface CPItem {
  id: string;
  cp_id: string | null;
  product_id: string | null;
  quantity: number;
  price_at_moment: number; // Price per unit in BYN
  final_price_byn: number; // Total price or redundant unit price depending on context
  snapshot_name?: string | null;
  snapshot_description?: string | null;
  snapshot_unit?: string | null;
  parent_id?: string | null; // NEW: Hierarchy
  product?: Product;
  // Legacy
  catalog_id?: string;
  catalog?: any;
}

export interface CompanySettings {
  id: string;
  company_name: string;
  requisites?: string;
  bank_details?: string;
  default_vat_percent: number;
  global_markup?: number;
}

// --- NEW TYPES FOR DOCUMENTS & ORDERS ---

export interface DocumentTemplate {
  id: string;
  type: 'cp' | 'invoice';
  header_text: string;
  footer_text: string;
  signatory_1: string; // Руководитель
  signatory_2: string; // Бухгалтер
  is_default: boolean;
}

export interface Invoice {
  id: string;
  number: number;
  cp_id: string | null;
  client_id: string | null;
  object_id?: string | null; // NEW: Link to Object
  total_amount: number;
  has_vat: boolean;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  shipping_status?: 'none' | 'partial' | 'shipped'; // NEW: Shipping Tracking
  due_date?: string | null; // NEW: Invoice validity date
  created_at: string;
  created_by: string;
  
  // Joins
  client?: { name: string; requisites: string };
  object?: { name: string }; // NEW
  commercial_proposal?: { number: number };
  items?: InvoiceItem[];
  creator?: { full_name: string };
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string | null;
  parent_id?: string | null; // NEW: Hierarchy
  name: string;
  quantity: number;
  unit: string;
  price: number;
  total: number;
  
  // Helpers for UI
  product?: Product;
}

export interface SupplyOrder {
  id: string;
  invoice_id: string | null; // Ссылка на счет, из-за которого возник дефицит
  status: 'pending' | 'ordered' | 'received';
  created_at: string;
  created_by: string;
  
  // Joins
  invoice?: { number: number; client?: { name: string } };
  items?: SupplyOrderItem[];
}

export interface SupplyOrderItem {
  id: string;
  supply_order_id: string;
  product_id: string;
  quantity_needed: number;
  quantity_ordered?: number;
  status: 'pending' | 'ordered' | 'received';
  
  // Joins
  product?: Product;
}

// Legacy Type needed for some components until refactor is complete
export interface PriceCatalogItem {
  id: string;
  name: string;
  description?: string | null;
  price_eur: number; // Legacy name, now treated as BYN
  markup_percent: number;
  global_category: string;
  item_type: string;
  unit: string;
  is_active: boolean;
}

// --- PARTNERS & CLIENTS ---

export interface Partner {
  id: string;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  default_commission_percent: number;
  status: 'active' | 'inactive';
  notes?: string | null;
  created_at: string;
  updated_at: string;
  
  // Joins
  clients?: any[]; // Can be Client[] or count object
  total_clients?: number;
  total_revenue?: number;
  paid_commission?: number;
}

export interface Client {
  id: string;
  name: string;
  type: 'person' | 'company'; // Исправлено с individual
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  requisites: string | null;
  lead_source: string | null;
  referred_by: string | null;
  partner_id: string | null;
  manager_id: string | null;
  created_at: string | null; // Разрешаем null для сборки
  updated_at: string | null;
  
  // Joins (делаем опциональными и гибкими, чтобы Supabase не ломал типизацию при выборке)
  partner?: any; 
  manager?: { full_name: string } | null;
  objects?: any[];
  
  // Legacy
  source?: string | null;
  address?: string | null;
}

