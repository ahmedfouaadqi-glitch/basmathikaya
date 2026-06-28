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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      characters: {
        Row: {
          age: number
          created_at: string
          customer_name: string
          customer_phone: string
          id: string
          image_path: string | null
          language: string
          mood: string
        }
        Insert: {
          age: number
          created_at?: string
          customer_name: string
          customer_phone: string
          id?: string
          image_path?: string | null
          language?: string
          mood: string
        }
        Update: {
          age?: number
          created_at?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          image_path?: string | null
          language?: string
          mood?: string
        }
        Relationships: []
      }
      generation_events: {
        Row: {
          aig_log_id: string | null
          aig_run_id: string | null
          cost_credits: number | null
          cost_iqd: number | null
          cost_usd: number | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          image_count: number | null
          input_tokens: number | null
          model: string
          operation: string
          order_id: string | null
          output_tokens: number | null
          provider: string
          reconciled: boolean
          status: Database["public"]["Enums"]["event_status"]
          step: string
          tier: string | null
          total_tokens: number | null
        }
        Insert: {
          aig_log_id?: string | null
          aig_run_id?: string | null
          cost_credits?: number | null
          cost_iqd?: number | null
          cost_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          image_count?: number | null
          input_tokens?: number | null
          model: string
          operation: string
          order_id?: string | null
          output_tokens?: number | null
          provider?: string
          reconciled?: boolean
          status?: Database["public"]["Enums"]["event_status"]
          step: string
          tier?: string | null
          total_tokens?: number | null
        }
        Update: {
          aig_log_id?: string | null
          aig_run_id?: string | null
          cost_credits?: number | null
          cost_iqd?: number | null
          cost_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          image_count?: number | null
          input_tokens?: number | null
          model?: string
          operation?: string
          order_id?: string | null
          output_tokens?: number | null
          provider?: string
          reconciled?: boolean
          status?: Database["public"]["Enums"]["event_status"]
          step?: string
          tier?: string | null
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_costs_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "generation_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      generations: {
        Row: {
          cover_image_path: string | null
          created_at: string
          first_paragraph: string | null
          full_story: string | null
          id: string
          order_id: string
          updated_at: string
        }
        Insert: {
          cover_image_path?: string | null
          created_at?: string
          first_paragraph?: string | null
          full_story?: string | null
          id?: string
          order_id: string
          updated_at?: string
        }
        Update: {
          cover_image_path?: string | null
          created_at?: string
          first_paragraph?: string | null
          full_story?: string | null
          id?: string
          order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "order_costs_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "generations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_characters: {
        Row: {
          age: number | null
          created_at: string
          description: string | null
          id: string
          is_primary: boolean
          name: string
          order_id: string
          position: number
          role: string
        }
        Insert: {
          age?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_primary?: boolean
          name: string
          order_id: string
          position?: number
          role?: string
        }
        Update: {
          age?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          order_id?: string
          position?: number
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_characters_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_costs_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_characters_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_iqd: number
          character_brief: string | null
          character_id: string | null
          created_at: string
          custom_instructions: string | null
          customer_phone: string
          delivered_at: string | null
          id: string
          images_error: string | null
          images_status: string
          moods: string[]
          notes: string | null
          order_number: number
          page_count: number
          paid_at: string | null
          payment_confirmed_at: string | null
          pdf_path: string | null
          status: Database["public"]["Enums"]["order_status"]
          tier: Database["public"]["Enums"]["order_tier"] | null
          title: string | null
          updated_at: string
          user_id: string | null
          whatsapp_sent_at: string | null
        }
        Insert: {
          amount_iqd?: number
          character_brief?: string | null
          character_id?: string | null
          created_at?: string
          custom_instructions?: string | null
          customer_phone: string
          delivered_at?: string | null
          id?: string
          images_error?: string | null
          images_status?: string
          moods?: string[]
          notes?: string | null
          order_number?: number
          page_count?: number
          paid_at?: string | null
          payment_confirmed_at?: string | null
          pdf_path?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          tier?: Database["public"]["Enums"]["order_tier"] | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp_sent_at?: string | null
        }
        Update: {
          amount_iqd?: number
          character_brief?: string | null
          character_id?: string | null
          created_at?: string
          custom_instructions?: string | null
          customer_phone?: string
          delivered_at?: string | null
          id?: string
          images_error?: string | null
          images_status?: string
          moods?: string[]
          notes?: string | null
          order_number?: number
          page_count?: number
          paid_at?: string | null
          payment_confirmed_at?: string | null
          pdf_path?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          tier?: Database["public"]["Enums"]["order_tier"] | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
        }
        Relationships: []
      }
      pricing_settings: {
        Row: {
          id: number
          iqd_per_usd: number
          max_characters: number
          per_character_iqd_pdf: number
          per_character_iqd_printed: number
          per_character_iqd_video: number
          per_page_iqd_pdf: number
          per_page_iqd_printed: number
          per_page_iqd_video: number
          print_cost_iqd: number
          shipping_cost_iqd: number
          tier_pdf_iqd: number
          tier_printed_iqd: number
          tier_video_iqd: number
          updated_at: string
          usd_per_credit: number
        }
        Insert: {
          id?: number
          iqd_per_usd?: number
          max_characters?: number
          per_character_iqd_pdf?: number
          per_character_iqd_printed?: number
          per_character_iqd_video?: number
          per_page_iqd_pdf?: number
          per_page_iqd_printed?: number
          per_page_iqd_video?: number
          print_cost_iqd?: number
          shipping_cost_iqd?: number
          tier_pdf_iqd?: number
          tier_printed_iqd?: number
          tier_video_iqd?: number
          updated_at?: string
          usd_per_credit?: number
        }
        Update: {
          id?: number
          iqd_per_usd?: number
          max_characters?: number
          per_character_iqd_pdf?: number
          per_character_iqd_printed?: number
          per_character_iqd_video?: number
          per_page_iqd_pdf?: number
          per_page_iqd_printed?: number
          per_page_iqd_video?: number
          print_cost_iqd?: number
          shipping_cost_iqd?: number
          tier_pdf_iqd?: number
          tier_printed_iqd?: number
          tier_video_iqd?: number
          updated_at?: string
          usd_per_credit?: number
        }
        Relationships: []
      }
      story_pages: {
        Row: {
          created_at: string
          id: string
          image_path: string | null
          image_prompt: string | null
          order_id: string
          page_number: number
          text: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_path?: string | null
          image_prompt?: string | null
          order_id: string
          page_number: number
          text?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_path?: string | null
          image_prompt?: string | null
          order_id?: string
          page_number?: number
          text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_pages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_costs_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "story_pages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          full_name: string
          id: string
          last_login_at: string | null
          marketing_consent: boolean
          notes: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          last_login_at?: string | null
          marketing_consent?: boolean
          notes?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          last_login_at?: string | null
          marketing_consent?: boolean
          notes?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      order_costs_v: {
        Row: {
          cost_credits: number | null
          cost_iqd: number | null
          cost_usd: number | null
          created_at: string | null
          gross_profit_iqd: number | null
          images_generated: number | null
          margin_pct: number | null
          order_id: string | null
          order_number: number | null
          revenue_iqd: number | null
          status: Database["public"]["Enums"]["order_status"] | null
          tier: Database["public"]["Enums"]["order_tier"] | null
          total_tokens: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      event_status: "success" | "error"
      order_status: "pending" | "paid" | "delivered" | "cancelled"
      order_tier: "pdf" | "printed" | "video"
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
      event_status: ["success", "error"],
      order_status: ["pending", "paid", "delivered", "cancelled"],
      order_tier: ["pdf", "printed", "video"],
    },
  },
} as const
