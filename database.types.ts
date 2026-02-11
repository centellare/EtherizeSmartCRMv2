
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          comment: string | null
          contact_person: string | null
          contact_position: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          id: string
          manager_id: string | null
          name: string
          phone: string | null
          requisites: string | null
          type: Database["public"]["Enums"]["client_type"]
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          comment?: string | null
          contact_person?: string | null
          contact_position?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          manager_id?: string | null
          name: string
          phone?: string | null
          requisites?: string | null
          type: Database["public"]["Enums"]["client_type"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          comment?: string | null
          contact_person?: string | null
          contact_position?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          phone?: string | null
          requisites?: string | null
          type?: Database["public"]["Enums"]["client_type"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_clients_creator"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_clients_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_clients_updater"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_proposals: {
        Row: {
          client_id: string | null
          created_at: string | null
          created_by: string | null
          exchange_rate: number
          global_markup: number | null
          has_vat: boolean | null
          header_data: Json | null
          id: string
          number: number
          status: string | null
          title: string | null
          total_amount_byn: number | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          exchange_rate: number
          global_markup?: number | null
          has_vat?: boolean | null
          header_data?: Json | null
          id?: string
          number?: number
          status?: string | null
          title?: string | null
          total_amount_byn?: number | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          exchange_rate?: number
          global_markup?: number | null
          has_vat?: boolean | null
          header_data?: Json | null
          id?: string
          number?: number
          status?: string | null
          title?: string | null
          total_amount_byn?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_proposals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cp_items: {
        Row: {
          catalog_id: string | null
          cp_id: string | null
          final_price_byn: number | null
          id: string
          quantity: number | null
          snapshot_base_price_eur: number | null
          snapshot_description: string | null
          snapshot_global_category: string | null
          snapshot_name: string | null
          snapshot_unit: string | null
        }
        Insert: {
          catalog_id?: string | null
          cp_id?: string | null
          final_price_byn?: number | null
          id?: string
          quantity?: number | null
          snapshot_base_price_eur?: number | null
          snapshot_description?: string | null
          snapshot_global_category?: string | null
          snapshot_name?: string | null
          snapshot_unit?: string | null
        }
        Update: {
          catalog_id?: string | null
          cp_id?: string | null
          final_price_byn?: number | null
          id?: string
          quantity?: number | null
          snapshot_base_price_eur?: number | null
          snapshot_description?: string | null
          snapshot_global_category?: string | null
          snapshot_name?: string | null
          snapshot_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cp_items_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "price_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_items_cp_id_fkey"
            columns: ["cp_id"]
            isOneToOne: false
            referencedRelation: "commercial_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      finances: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          object_id: string | null
          type: string
        }
        Insert: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          object_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          object_id?: string | null
          type?: string
        }
        Relationships: []
      }
      inventory_catalog: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string | null
          has_serial: boolean | null
          id: string
          is_deleted: boolean | null
          item_type: string | null
          last_purchase_price: number | null
          name: string
          sku: string | null
          unit: string | null
          warranty_period_months: number | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          has_serial?: boolean | null
          id?: string
          is_deleted?: boolean | null
          item_type?: string | null
          last_purchase_price?: number | null
          name: string
          sku?: string | null
          unit?: string | null
          warranty_period_months?: number | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          has_serial?: boolean | null
          id?: string
          is_deleted?: boolean | null
          item_type?: string | null
          last_purchase_price?: number | null
          name?: string
          sku?: string | null
          unit?: string | null
          warranty_period_months?: number | null
        }
        Relationships: []
      }
      inventory_history: {
        Row: {
          action_type: string
          comment: string | null
          created_at: string | null
          created_by: string | null
          from_object_id: string | null
          id: string
          is_deleted: boolean | null
          item_id: string
          to_object_id: string | null
        }
        Insert: {
          action_type: string
          comment?: string | null
          created_at?: string | null
          created_by?: string | null
          from_object_id?: string | null
          id?: string
          is_deleted?: boolean | null
          item_id: string
          to_object_id?: string | null
        }
        Update: {
          action_type?: string
          comment?: string | null
          created_at?: string | null
          created_by?: string | null
          from_object_id?: string | null
          id?: string
          is_deleted?: boolean | null
          item_id?: string
          to_object_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          assigned_to_id: string | null
          catalog_id: string
          created_at: string | null
          current_object_id: string | null
          deleted_at: string | null
          id: string
          is_deleted: boolean | null
          purchase_price: number | null
          quantity: number | null
          serial_number: string | null
          status: string
          total_price: number | null
          updated_at: string | null
          warranty_end: string | null
          warranty_start: string | null
        }
        Insert: {
          assigned_to_id?: string | null
          catalog_id: string
          created_at?: string | null
          current_object_id?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean | null
          purchase_price?: number | null
          quantity?: number | null
          serial_number?: string | null
          status?: string
          total_price?: number | null
          updated_at?: string | null
          warranty_end?: string | null
          warranty_start?: string | null
        }
        Update: {
          assigned_to_id?: string | null
          catalog_id?: string
          created_at?: string | null
          current_object_id?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean | null
          purchase_price?: number | null
          quantity?: number | null
          serial_number?: string | null
          status?: string
          total_price?: number | null
          updated_at?: string | null
          warranty_end?: string | null
          warranty_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_inventory_assignee"
            columns: ["assigned_to_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_inventory_catalog"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "inventory_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_inventory_object"
            columns: ["current_object_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_read: boolean
          profile_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_read?: boolean
          profile_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_read?: boolean
          profile_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      object_history: {
        Row: {
          action_text: string
          created_at: string | null
          id: string
          object_id: string | null
          profile_id: string | null
        }
        Insert: {
          action_text: string
          created_at?: string | null
          id?: string
          object_id?: string | null
          profile_id?: string | null
        }
        Update: {
          action_text?: string
          created_at?: string | null
          id?: string
          object_id?: string | null
          profile_id?: string | null
        }
        Relationships: []
      }
      object_stages: {
        Row: {
          completed_at: string | null
          created_at: string | null
          deadline: string | null
          extension_days: number | null
          id: string
          object_id: string | null
          responsible_id: string | null
          stage_name: string
          started_at: string | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          deadline?: string | null
          extension_days?: number | null
          id?: string
          object_id?: string | null
          responsible_id?: string | null
          stage_name: string
          started_at?: string | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          deadline?: string | null
          extension_days?: number | null
          id?: string
          object_id?: string | null
          responsible_id?: string | null
          stage_name?: string
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      objects: {
        Row: {
          address: string | null
          client_id: string | null
          comment: string | null
          created_at: string | null
          created_by: string | null
          current_stage: string | null
          current_status: string | null
          deleted_at: string | null
          id: string
          is_deleted: boolean | null
          metadata: Json | null
          name: string
          responsible_id: string | null
          rolled_back_from: string | null
          status: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          client_id?: string | null
          comment?: string | null
          created_at?: string | null
          created_by?: string | null
          current_stage?: string | null
          current_status?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean | null
          metadata?: Json | null
          name: string
          responsible_id?: string | null
          rolled_back_from?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          client_id?: string | null
          comment?: string | null
          created_at?: string | null
          created_by?: string | null
          current_stage?: string | null
          current_status?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean | null
          metadata?: Json | null
          name?: string
          responsible_id?: string | null
          rolled_back_from?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_objects_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_objects_creator"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_objects_responsible"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_objects_updater"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_catalog: {
        Row: {
          created_at: string | null
          description: string | null
          global_category: string
          id: string
          is_active: boolean | null
          item_type: string
          markup_percent: number | null
          name: string
          price_eur: number
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          global_category: string
          id?: string
          is_active?: boolean | null
          item_type: string
          markup_percent?: number | null
          name: string
          price_eur?: number
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          global_category?: string
          id?: string
          is_active?: boolean | null
          item_type?: string
          markup_percent?: number | null
          name?: string
          price_eur?: number
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          birth_date: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string
          full_name: string
          id: string
          must_change_password: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          skills: string[] | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email: string
          full_name: string
          id?: string
          must_change_password?: boolean
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          skills?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          full_name?: string
          id?: string
          must_change_password?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          skills?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      task_checklists: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_completed: boolean
          task_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_completed?: boolean
          task_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_completed?: boolean
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklists_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string
          comment: string | null
          completed_at: string | null
          completed_by: string | null
          completion_comment: string | null
          completion_doc_link: string | null
          completion_doc_name: string | null
          created_at: string | null
          created_by: string | null
          deadline: string | null
          deleted_at: string | null
          deleted_by: string | null
          doc_link: string | null
          doc_name: string | null
          id: string
          is_deleted: boolean | null
          last_edited_at: string | null
          last_edited_by: string | null
          object_id: string | null
          pause_reason: string | null
          paused_at: string | null
          stage_id: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          assigned_to: string
          comment?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_comment?: string | null
          completion_doc_link?: string | null
          completion_doc_name?: string | null
          created_at?: string | null
          created_by?: string | null
          deadline?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          doc_link?: string | null
          doc_name?: string | null
          id?: string
          is_deleted?: boolean | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          object_id?: string | null
          pause_reason?: string | null
          paused_at?: string | null
          stage_id?: string | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string
          comment?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_comment?: string | null
          completion_doc_link?: string | null
          completion_doc_name?: string | null
          created_at?: string | null
          created_by?: string | null
          deadline?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          doc_link?: string | null
          doc_name?: string | null
          id?: string
          is_deleted?: boolean | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          object_id?: string | null
          pause_reason?: string | null
          paused_at?: string | null
          stage_id?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_tasks_assigned"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tasks_creator"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tasks_object"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_payments: {
        Row: {
          amount: number
          comment: string | null
          created_at: string | null
          created_by: string
          doc_date: string | null
          doc_number: string | null
          doc_type: string | null
          id: string
          payment_date: string | null
          requires_doc: boolean | null
          transaction_id: string
        }
        Insert: {
          amount?: number
          comment?: string | null
          created_at?: string | null
          created_by: string
          doc_date?: string | null
          doc_number?: string | null
          doc_type?: string | null
          id?: string
          payment_date?: string | null
          requires_doc?: boolean | null
          transaction_id: string
        }
        Update: {
          amount?: number
          comment?: string | null
          created_at?: string | null
          created_by?: string
          doc_date?: string | null
          doc_number?: string | null
          doc_type?: string | null
          id?: string
          payment_date?: string | null
          requires_doc?: boolean | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          approved_amount: number | null
          category: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          doc_link: string | null
          doc_name: string | null
          fact_amount: number | null
          fact_date: string | null
          id: string
          object_id: string | null
          planned_amount: number | null
          planned_date: string | null
          processed_at: string | null
          processed_by: string | null
          requested_amount: number | null
          status: string | null
          type: string | null
        }
        Insert: {
          amount: number
          approved_amount?: number | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          doc_link?: string | null
          doc_name?: string | null
          fact_amount?: number | null
          fact_date?: string | null
          id?: string
          object_id?: string | null
          planned_amount?: number | null
          planned_date?: string | null
          processed_at?: string | null
          processed_by?: string | null
          requested_amount?: number | null
          status?: string | null
          type?: string | null
        }
        Update: {
          amount?: number
          approved_amount?: number | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          doc_link?: string | null
          doc_name?: string | null
          fact_amount?: number | null
          fact_date?: string | null
          id?: string
          object_id?: string | null
          planned_amount?: number | null
          planned_date?: string | null
          processed_at?: string | null
          processed_by?: string | null
          requested_amount?: number | null
          status?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_user_password: {
        Args: { new_password: string; target_user_id: string }
        Returns: undefined
      }
      create_task_safe:
        | {
            Args: {
              p_assigned_to: string
              p_comment: string
              p_deadline: string
              p_doc_link: string
              p_doc_name: string
              p_object_id: string
              p_start_date: string
              p_title: string
              p_user_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_assigned_to: string
              p_comment: string
              p_deadline: string
              p_doc_link: string
              p_doc_name: string
              p_object_id: string
              p_start_date: string
              p_title: string
              p_user_id: string
            }
            Returns: undefined
          }
      finalize_project: {
        Args: { p_object_id: string; p_user_id: string }
        Returns: undefined
      }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_user_first_name: { Args: { full_name: string }; Returns: string }
      rollback_object_stage: {
        Args: {
          p_object_id: string
          p_reason: string
          p_responsible_id: string
          p_target_stage: string
          p_user_id: string
        }
        Returns: undefined
      }
      transition_object_stage:
        | {
            Args: {
              p_deadline: string
              p_next_stage: string
              p_object_id: string
              p_responsible_id: string
              p_user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_deadline: string
              p_next_stage: string
              p_object_id: string
              p_responsible_id: string
              p_user_id: string
            }
            Returns: undefined
          }
    }
    Enums: {
      client_type: "person" | "company"
      finance_status: "pending" | "approved" | "rejected"
      object_type: "apartment" | "house" | "office"
      project_status:
        | "in_work"
        | "on_pause"
        | "completed"
        | "frozen"
        | "on_review"
      stage_name:
        | "negotiation"
        | "design"
        | "logistics"
        | "assembly"
        | "mounting"
        | "commissioning"
        | "programming"
        | "support"
      user_role: "admin" | "director" | "manager" | "specialist"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      client_type: ["person", "company"],
      finance_status: ["pending", "approved", "rejected"],
      object_type: ["apartment", "house", "office"],
      project_status: [
        "in_work",
        "on_pause",
        "completed",
        "frozen",
        "on_review",
      ],
      stage_name: [
        "negotiation",
        "design",
        "logistics",
        "assembly",
        "mounting",
        "commissioning",
        "programming",
        "support",
      ],
      user_role: ["admin", "director", "manager", "specialist"],
    },
  },
} as const
