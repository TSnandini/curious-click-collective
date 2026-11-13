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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      handlers: {
        Row: {
          available: boolean
          capacity: number
          created_at: string
          id: string
          is_escalation: boolean
          name: string
          zone: string
        }
        Insert: {
          available?: boolean
          capacity?: number
          created_at?: string
          id: string
          is_escalation?: boolean
          name: string
          zone: string
        }
        Update: {
          available?: boolean
          capacity?: number
          created_at?: string
          id?: string
          is_escalation?: boolean
          name?: string
          zone?: string
        }
        Relationships: []
      }
      report_events: {
        Row: {
          created_at: string
          from_status: string | null
          id: number
          note: string
          report_id: string
          to_status: string
        }
        Insert: {
          created_at?: string
          from_status?: string | null
          id?: number
          note?: string
          report_id: string
          to_status: string
        }
        Update: {
          created_at?: string
          from_status?: string | null
          id?: number
          note?: string
          report_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          assignment_type: string
          category: string
          category_scores: Json
          classification_conflict: boolean
          complaint_code: string
          created_at: string
          description: string
          handler_id: string | null
          id: string
          order_id: string
          priority: number
          priority_override: string | null
          reporter_email: string
          reporter_name: string
          reporter_phone: string
          restaurant_id: string
          routing_note: string
          status: string
          updated_at: string
          urgency: string
          zone: string
          zone_code: string
        }
        Insert: {
          assignment_type: string
          category: string
          category_scores?: Json
          classification_conflict?: boolean
          complaint_code: string
          created_at?: string
          description: string
          handler_id?: string | null
          id: string
          order_id: string
          priority: number
          priority_override?: string | null
          reporter_email: string
          reporter_name: string
          reporter_phone: string
          restaurant_id: string
          routing_note?: string
          status: string
          updated_at?: string
          urgency: string
          zone: string
          zone_code: string
        }
        Update: {
          assignment_type?: string
          category?: string
          category_scores?: Json
          classification_conflict?: boolean
          complaint_code?: string
          created_at?: string
          description?: string
          handler_id?: string | null
          id?: string
          order_id?: string
          priority?: number
          priority_override?: string | null
          reporter_email?: string
          reporter_name?: string
          reporter_phone?: string
          restaurant_id?: string
          routing_note?: string
          status?: string
          updated_at?: string
          urgency?: string
          zone?: string
          zone_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_handler_id_fkey"
            columns: ["handler_id"]
            isOneToOne: false
            referencedRelation: "handlers"
            referencedColumns: ["id"]
          },
        ]
      }
      routing_table: {
        Row: {
          backup_handler: string
          category: string
          id: number
          primary_handler: string
          zone: string
        }
        Insert: {
          backup_handler: string
          category: string
          id?: number
          primary_handler: string
          zone: string
        }
        Update: {
          backup_handler?: string
          category?: string
          id?: number
          primary_handler?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "routing_table_backup_handler_fkey"
            columns: ["backup_handler"]
            isOneToOne: false
            referencedRelation: "handlers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routing_table_primary_handler_fkey"
            columns: ["primary_handler"]
            isOneToOne: false
            referencedRelation: "handlers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
