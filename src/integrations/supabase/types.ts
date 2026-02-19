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
      catalog_items: {
        Row: {
          category: string
          compatible_with: string[] | null
          created_at: string
          description: string
          id: string
          in_stock: boolean
          lead_time_days: number
          manufacturer: string
          model: string
          name: string
          price_usd: number
          search_vector: unknown
          specs: Json | null
          supplier: string
          updated_at: string
        }
        Insert: {
          category: string
          compatible_with?: string[] | null
          created_at?: string
          description?: string
          id: string
          in_stock?: boolean
          lead_time_days: number
          manufacturer: string
          model: string
          name: string
          price_usd: number
          search_vector?: unknown
          specs?: Json | null
          supplier: string
          updated_at?: string
        }
        Update: {
          category?: string
          compatible_with?: string[] | null
          created_at?: string
          description?: string
          id?: string
          in_stock?: boolean
          lead_time_days?: number
          manufacturer?: string
          model?: string
          name?: string
          price_usd?: number
          search_vector?: unknown
          specs?: Json | null
          supplier?: string
          updated_at?: string
        }
        Relationships: []
      }
      po_line_items: {
        Row: {
          catalog_item_id: string
          created_at: string
          id: string
          line_total: number | null
          po_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          catalog_item_id: string
          created_at?: string
          id?: string
          line_total?: number | null
          po_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          catalog_item_id?: string
          created_at?: string
          id?: string
          line_total?: number | null
          po_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "po_line_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_line_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      po_status_history: {
        Row: {
          id: string
          note: string | null
          po_id: string
          status: Database["public"]["Enums"]["po_status"]
          transitioned_at: string
        }
        Insert: {
          id?: string
          note?: string | null
          po_id: string
          status: Database["public"]["Enums"]["po_status"]
          transitioned_at?: string
        }
        Update: {
          id?: string
          note?: string | null
          po_id?: string
          status?: Database["public"]["Enums"]["po_status"]
          transitioned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_status_history_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          cost_center: string
          created_at: string
          current_status: Database["public"]["Enums"]["po_status"]
          id: string
          idempotency_key: string | null
          needed_by_date: string | null
          payment_terms: string
          po_number: string
          requestor: string
          supplier: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          cost_center?: string
          created_at?: string
          current_status?: Database["public"]["Enums"]["po_status"]
          id?: string
          idempotency_key?: string | null
          needed_by_date?: string | null
          payment_terms?: string
          po_number?: string
          requestor: string
          supplier: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          cost_center?: string
          created_at?: string
          current_status?: Database["public"]["Enums"]["po_status"]
          id?: string
          idempotency_key?: string | null
          needed_by_date?: string | null
          payment_terms?: string
          po_number?: string
          requestor?: string
          supplier?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      po_status: "Draft" | "Submitted" | "Approved" | "Rejected" | "Fulfilled"
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
      po_status: ["Draft", "Submitted", "Approved", "Rejected", "Fulfilled"],
    },
  },
} as const
