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
      admin_login_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip: string | null
          phone: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          ip?: string | null
          phone: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip?: string | null
          phone?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: []
      }
      admin_otp_codes: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          ip: string | null
          phone: string
          used_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          ip?: string | null
          phone: string
          used_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          ip?: string | null
          phone?: string
          used_at?: string | null
        }
        Relationships: []
      }
      ai_model_events: {
        Row: {
          attempt: number
          cost_usd: number | null
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          meta: Json
          model_id: string
          order_id: string | null
          output_tokens: number | null
          prompt_version: string | null
          status: string
          task_type: string
          user_id: string | null
        }
        Insert: {
          attempt?: number
          cost_usd?: number | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          meta?: Json
          model_id: string
          order_id?: string | null
          output_tokens?: number | null
          prompt_version?: string | null
          status: string
          task_type: string
          user_id?: string | null
        }
        Update: {
          attempt?: number
          cost_usd?: number | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          meta?: Json
          model_id?: string
          order_id?: string | null
          output_tokens?: number | null
          prompt_version?: string | null
          status?: string
          task_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_model_health: {
        Row: {
          avg_latency_1h_ms: number | null
          circuit_state: string
          consecutive_failures: number
          failure_rate_1h: number
          is_healthy: boolean
          last_error: string | null
          last_failure_at: string | null
          last_success_at: string | null
          model_id: string
          next_probe_at: string | null
          opened_at: string | null
          task_type: string
          updated_at: string
        }
        Insert: {
          avg_latency_1h_ms?: number | null
          circuit_state?: string
          consecutive_failures?: number
          failure_rate_1h?: number
          is_healthy?: boolean
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          model_id: string
          next_probe_at?: string | null
          opened_at?: string | null
          task_type: string
          updated_at?: string
        }
        Update: {
          avg_latency_1h_ms?: number | null
          circuit_state?: string
          consecutive_failures?: number
          failure_rate_1h?: number
          is_healthy?: boolean
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          model_id?: string
          next_probe_at?: string | null
          opened_at?: string | null
          task_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_models_config: {
        Row: {
          backoff_base_ms: number
          created_at: string
          enabled: boolean
          id: string
          max_retries: number
          max_tokens: number | null
          model_id: string
          notes: string | null
          params: Json
          priority: number
          prompt_version: string
          safety_level: string | null
          task_type: string
          temperature: number | null
          timeout_ms: number
          top_k: number | null
          top_p: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          backoff_base_ms?: number
          created_at?: string
          enabled?: boolean
          id?: string
          max_retries?: number
          max_tokens?: number | null
          model_id: string
          notes?: string | null
          params?: Json
          priority?: number
          prompt_version?: string
          safety_level?: string | null
          task_type: string
          temperature?: number | null
          timeout_ms?: number
          top_k?: number | null
          top_p?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          backoff_base_ms?: number
          created_at?: string
          enabled?: boolean
          id?: string
          max_retries?: number
          max_tokens?: number | null
          model_id?: string
          notes?: string | null
          params?: Json
          priority?: number
          prompt_version?: string
          safety_level?: string | null
          task_type?: string
          temperature?: number | null
          timeout_ms?: number
          top_k?: number | null
          top_p?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          after: Json | null
          before: Json | null
          created_at: string
          diff: Json | null
          id: string
          ip: string | null
          meta: Json
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          diff?: Json | null
          id?: string
          ip?: string | null
          meta?: Json
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          diff?: Json | null
          id?: string
          ip?: string | null
          meta?: Json
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      background_jobs: {
        Row: {
          attempts: number
          created_at: string
          finished_at: string | null
          id: string
          kind: string
          last_error: string | null
          max_attempts: number
          next_run_at: string
          order_id: string | null
          payload: Json
          priority: number
          result: Json | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          kind: string
          last_error?: string | null
          max_attempts?: number
          next_run_at?: string
          order_id?: string | null
          payload?: Json
          priority?: number
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          max_attempts?: number
          next_run_at?: string
          order_id?: string | null
          payload?: Json
          priority?: number
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      business_config: {
        Row: {
          category: string
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          category: string
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          category?: string
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      character_analysis_cache: {
        Row: {
          cache_key: string
          character_dna: Json
          cost_saved_usd: number
          created_at: string
          expires_at: string
          hits: number
          image_hash: string
          last_hit_at: string | null
          model_id: string
        }
        Insert: {
          cache_key: string
          character_dna: Json
          cost_saved_usd?: number
          created_at?: string
          expires_at: string
          hits?: number
          image_hash: string
          last_hit_at?: string | null
          model_id: string
        }
        Update: {
          cache_key?: string
          character_dna?: Json
          cost_saved_usd?: number
          created_at?: string
          expires_at?: string
          hits?: number
          image_hash?: string
          last_hit_at?: string | null
          model_id?: string
        }
        Relationships: []
      }
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
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          discount_iqd: number
          id: string
          order_id: string
          user_id: string | null
        }
        Insert: {
          coupon_id: string
          created_at?: string
          discount_iqd: number
          id?: string
          order_id: string
          user_id?: string | null
        }
        Update: {
          coupon_id?: string
          created_at?: string
          discount_iqd?: number
          id?: string
          order_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_costs_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          applies_quality: string[]
          applies_tier: string[]
          applies_to: string
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          max_uses: number | null
          min_pages: number
          updated_at: string
          uses_count: number
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          active?: boolean
          applies_quality?: string[]
          applies_tier?: string[]
          applies_to?: string
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          id?: string
          max_uses?: number | null
          min_pages?: number
          updated_at?: string
          uses_count?: number
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          active?: boolean
          applies_quality?: string[]
          applies_tier?: string[]
          applies_to?: string
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          max_uses?: number | null
          min_pages?: number
          updated_at?: string
          uses_count?: number
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: []
      }
      download_events: {
        Row: {
          created_at: string
          id: string
          ip: string | null
          order_id: string
          source: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip?: string | null
          order_id: string
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string | null
          order_id?: string
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "download_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_costs_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "download_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_controls: {
        Row: {
          ai_all_paused: boolean
          ai_image_paused: boolean
          ai_text_paused: boolean
          id: boolean
          paused_at: string | null
          paused_by: string | null
          qa_paused: boolean
          reason: string | null
          updated_at: string
        }
        Insert: {
          ai_all_paused?: boolean
          ai_image_paused?: boolean
          ai_text_paused?: boolean
          id?: boolean
          paused_at?: string | null
          paused_by?: string | null
          qa_paused?: boolean
          reason?: string | null
          updated_at?: string
        }
        Update: {
          ai_all_paused?: boolean
          ai_image_paused?: boolean
          ai_text_paused?: boolean
          id?: boolean
          paused_at?: string | null
          paused_by?: string | null
          qa_paused?: boolean
          reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          age: number | null
          character_dna: Json | null
          character_sheet_url: string | null
          created_at: string
          display_name: string
          gender: string | null
          id: string
          is_archived: boolean
          is_favorite: boolean
          last_used_at: string | null
          nickname: string | null
          role: string
          source_photo_path: string | null
          times_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          age?: number | null
          character_dna?: Json | null
          character_sheet_url?: string | null
          created_at?: string
          display_name: string
          gender?: string | null
          id?: string
          is_archived?: boolean
          is_favorite?: boolean
          last_used_at?: string | null
          nickname?: string | null
          role?: string
          source_photo_path?: string | null
          times_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: number | null
          character_dna?: Json | null
          character_sheet_url?: string | null
          created_at?: string
          display_name?: string
          gender?: string | null
          id?: string
          is_archived?: boolean
          is_favorite?: boolean
          last_used_at?: string | null
          nickname?: string | null
          role?: string
          source_photo_path?: string | null
          times_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          audience: string
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          key: string
          notes: string | null
          owner: string | null
          rollout_percent: number
          updated_at: string
          user_ids: string[]
        }
        Insert: {
          audience?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          key: string
          notes?: string | null
          owner?: string | null
          rollout_percent?: number
          updated_at?: string
          user_ids?: string[]
        }
        Update: {
          audience?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          key?: string
          notes?: string | null
          owner?: string | null
          rollout_percent?: number
          updated_at?: string
          user_ids?: string[]
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
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          order_id: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          order_id?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          order_id?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      order_characters: {
        Row: {
          age: number | null
          character_profile: Json | null
          character_sheet_url: string | null
          created_at: string
          description: string | null
          family_member_id: string | null
          id: string
          is_primary: boolean
          name: string
          order_id: string
          photo_path: string | null
          position: number
          role: string
          visual_brief: string | null
        }
        Insert: {
          age?: number | null
          character_profile?: Json | null
          character_sheet_url?: string | null
          created_at?: string
          description?: string | null
          family_member_id?: string | null
          id?: string
          is_primary?: boolean
          name: string
          order_id: string
          photo_path?: string | null
          position?: number
          role?: string
          visual_brief?: string | null
        }
        Update: {
          age?: number | null
          character_profile?: Json | null
          character_sheet_url?: string | null
          created_at?: string
          description?: string | null
          family_member_id?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          order_id?: string
          photo_path?: string | null
          position?: number
          role?: string
          visual_brief?: string | null
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
          art_style_lock: string | null
          batch_meta: Json | null
          character_brief: string | null
          character_dna: Json | null
          character_id: string | null
          coupon_code: string | null
          coupon_discount_iqd: number
          created_at: string
          custom_instructions: string | null
          customer_phone: string
          delivered_at: string | null
          disclaimer_accepted_at: string | null
          gallery_featured: boolean
          id: string
          image_quality_tier: string | null
          images_error: string | null
          images_status: string
          is_public: boolean
          mood_extra_iqd: number
          moods: string[]
          notes: string | null
          order_number: number
          page_count: number
          paid_at: string | null
          payment_confirmed_at: string | null
          payment_confirmed_notified_at: string | null
          payment_status: string
          pdf_generation_status: string | null
          pdf_orientation: string
          pdf_path: string | null
          public_author_name: string | null
          public_title: string | null
          redownload_amount_iqd: number | null
          redownload_paid_at: string | null
          redownload_requested_at: string | null
          redownload_status: string | null
          reflective_question: string | null
          rejected_at: string | null
          rejection_reason: string | null
          share_token: string | null
          show_author: boolean
          status: Database["public"]["Enums"]["order_status"]
          story_qa_report: Json | null
          tier: Database["public"]["Enums"]["order_tier"] | null
          title: string | null
          updated_at: string
          user_id: string | null
          whatsapp_sent_at: string | null
        }
        Insert: {
          amount_iqd?: number
          art_style_lock?: string | null
          batch_meta?: Json | null
          character_brief?: string | null
          character_dna?: Json | null
          character_id?: string | null
          coupon_code?: string | null
          coupon_discount_iqd?: number
          created_at?: string
          custom_instructions?: string | null
          customer_phone: string
          delivered_at?: string | null
          disclaimer_accepted_at?: string | null
          gallery_featured?: boolean
          id?: string
          image_quality_tier?: string | null
          images_error?: string | null
          images_status?: string
          is_public?: boolean
          mood_extra_iqd?: number
          moods?: string[]
          notes?: string | null
          order_number?: number
          page_count?: number
          paid_at?: string | null
          payment_confirmed_at?: string | null
          payment_confirmed_notified_at?: string | null
          payment_status?: string
          pdf_generation_status?: string | null
          pdf_orientation?: string
          pdf_path?: string | null
          public_author_name?: string | null
          public_title?: string | null
          redownload_amount_iqd?: number | null
          redownload_paid_at?: string | null
          redownload_requested_at?: string | null
          redownload_status?: string | null
          reflective_question?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          share_token?: string | null
          show_author?: boolean
          status?: Database["public"]["Enums"]["order_status"]
          story_qa_report?: Json | null
          tier?: Database["public"]["Enums"]["order_tier"] | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp_sent_at?: string | null
        }
        Update: {
          amount_iqd?: number
          art_style_lock?: string | null
          batch_meta?: Json | null
          character_brief?: string | null
          character_dna?: Json | null
          character_id?: string | null
          coupon_code?: string | null
          coupon_discount_iqd?: number
          created_at?: string
          custom_instructions?: string | null
          customer_phone?: string
          delivered_at?: string | null
          disclaimer_accepted_at?: string | null
          gallery_featured?: boolean
          id?: string
          image_quality_tier?: string | null
          images_error?: string | null
          images_status?: string
          is_public?: boolean
          mood_extra_iqd?: number
          moods?: string[]
          notes?: string | null
          order_number?: number
          page_count?: number
          paid_at?: string | null
          payment_confirmed_at?: string | null
          payment_confirmed_notified_at?: string | null
          payment_status?: string
          pdf_generation_status?: string | null
          pdf_orientation?: string
          pdf_path?: string | null
          public_author_name?: string | null
          public_title?: string | null
          redownload_amount_iqd?: number | null
          redownload_paid_at?: string | null
          redownload_requested_at?: string | null
          redownload_status?: string | null
          reflective_question?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          share_token?: string | null
          show_author?: boolean
          status?: Database["public"]["Enums"]["order_status"]
          story_qa_report?: Json | null
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
      phone_bans: {
        Row: {
          banned_at: string
          banned_by: string | null
          phone: string
          reason: string | null
        }
        Insert: {
          banned_at?: string
          banned_by?: string | null
          phone: string
          reason?: string | null
        }
        Update: {
          banned_at?: string
          banned_by?: string | null
          phone?: string
          reason?: string | null
        }
        Relationships: []
      }
      preview_templates: {
        Row: {
          active: boolean
          cover_image_path: string | null
          created_at: string
          frame_style: string | null
          hidden: boolean
          id: string
          language: string
          moods: string[]
          name: string
          orientation: string
          page_count: number
          page_images: string[]
          pages: Json
          palette: Json | null
          priority: number
          reflective_question: string | null
          season_end: string | null
          season_start: string | null
          seasonal_end: string | null
          seasonal_start: string | null
          story_type: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cover_image_path?: string | null
          created_at?: string
          frame_style?: string | null
          hidden?: boolean
          id?: string
          language?: string
          moods?: string[]
          name: string
          orientation?: string
          page_count?: number
          page_images?: string[]
          pages?: Json
          palette?: Json | null
          priority?: number
          reflective_question?: string | null
          season_end?: string | null
          season_start?: string | null
          seasonal_end?: string | null
          seasonal_start?: string | null
          story_type?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cover_image_path?: string | null
          created_at?: string
          frame_style?: string | null
          hidden?: boolean
          id?: string
          language?: string
          moods?: string[]
          name?: string
          orientation?: string
          page_count?: number
          page_images?: string[]
          pages?: Json
          palette?: Json | null
          priority?: number
          reflective_question?: string | null
          season_end?: string | null
          season_start?: string | null
          seasonal_end?: string | null
          seasonal_start?: string | null
          story_type?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      pricing_settings: {
        Row: {
          ai_cost_estimate_premium: number
          ai_cost_estimate_standard: number
          free_moods_count: number
          id: number
          image_quality_tier: string
          image_tier_premium_extra_iqd: number
          image_tier_standard_extra_iqd: number
          iqd_per_usd: number
          max_characters: number
          mood_extra_iqd: number
          pdf_image_quality: number | null
          pdf_max_width: number | null
          per_character_iqd_pdf: number
          per_character_iqd_printed: number
          per_character_iqd_video: number
          per_page_iqd_pdf: number
          per_page_iqd_printed: number
          per_page_iqd_video: number
          print_cost_iqd: number
          quality_premium_multiplier: number
          redownload_iqd_pdf: number
          redownload_iqd_printed: number
          redownload_iqd_video: number
          shipping_cost_iqd: number
          tier_fast_extra_iqd: number
          tier_pdf_iqd: number
          tier_premium_extra_iqd: number
          tier_printed_iqd: number
          tier_video_iqd: number
          updated_at: string
          usd_per_credit: number
          video_tier_enabled: boolean
          whatsapp_admin_number: string
        }
        Insert: {
          ai_cost_estimate_premium?: number
          ai_cost_estimate_standard?: number
          free_moods_count?: number
          id?: number
          image_quality_tier?: string
          image_tier_premium_extra_iqd?: number
          image_tier_standard_extra_iqd?: number
          iqd_per_usd?: number
          max_characters?: number
          mood_extra_iqd?: number
          pdf_image_quality?: number | null
          pdf_max_width?: number | null
          per_character_iqd_pdf?: number
          per_character_iqd_printed?: number
          per_character_iqd_video?: number
          per_page_iqd_pdf?: number
          per_page_iqd_printed?: number
          per_page_iqd_video?: number
          print_cost_iqd?: number
          quality_premium_multiplier?: number
          redownload_iqd_pdf?: number
          redownload_iqd_printed?: number
          redownload_iqd_video?: number
          shipping_cost_iqd?: number
          tier_fast_extra_iqd?: number
          tier_pdf_iqd?: number
          tier_premium_extra_iqd?: number
          tier_printed_iqd?: number
          tier_video_iqd?: number
          updated_at?: string
          usd_per_credit?: number
          video_tier_enabled?: boolean
          whatsapp_admin_number?: string
        }
        Update: {
          ai_cost_estimate_premium?: number
          ai_cost_estimate_standard?: number
          free_moods_count?: number
          id?: number
          image_quality_tier?: string
          image_tier_premium_extra_iqd?: number
          image_tier_standard_extra_iqd?: number
          iqd_per_usd?: number
          max_characters?: number
          mood_extra_iqd?: number
          pdf_image_quality?: number | null
          pdf_max_width?: number | null
          per_character_iqd_pdf?: number
          per_character_iqd_printed?: number
          per_character_iqd_video?: number
          per_page_iqd_pdf?: number
          per_page_iqd_printed?: number
          per_page_iqd_video?: number
          print_cost_iqd?: number
          quality_premium_multiplier?: number
          redownload_iqd_pdf?: number
          redownload_iqd_printed?: number
          redownload_iqd_video?: number
          shipping_cost_iqd?: number
          tier_fast_extra_iqd?: number
          tier_pdf_iqd?: number
          tier_premium_extra_iqd?: number
          tier_printed_iqd?: number
          tier_video_iqd?: number
          updated_at?: string
          usd_per_credit?: number
          video_tier_enabled?: boolean
          whatsapp_admin_number?: string
        }
        Relationships: []
      }
      promo_videos: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          muted_default: boolean
          sort_order: number
          title: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          muted_default?: boolean
          sort_order?: number
          title?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          muted_default?: boolean
          sort_order?: number
          title?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      prompt_cache: {
        Row: {
          cache_key: string
          cost_saved_usd: number
          created_at: string
          expires_at: string
          hits: number
          last_hit_at: string | null
          model_id: string
          response: Json
          task_type: string
        }
        Insert: {
          cache_key: string
          cost_saved_usd?: number
          created_at?: string
          expires_at: string
          hits?: number
          last_hit_at?: string | null
          model_id: string
          response: Json
          task_type: string
        }
        Update: {
          cache_key?: string
          cost_saved_usd?: number
          created_at?: string
          expires_at?: string
          hits?: number
          last_hit_at?: string | null
          model_id?: string
          response?: Json
          task_type?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          identifier: string
          updated_at: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          identifier: string
          updated_at?: string
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          identifier?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      redownload_requests: {
        Row: {
          amount_iqd: number
          created_at: string
          id: string
          order_id: string
          paid_at: string | null
          requested_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_iqd: number
          created_at?: string
          id?: string
          order_id: string
          paid_at?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_iqd?: number
          created_at?: string
          id?: string
          order_id?: string
          paid_at?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redownload_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_costs_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "redownload_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redownload_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_rewards: {
        Row: {
          amount_iqd: number
          applied_order_id: string | null
          created_at: string
          id: string
          reason: string
          referral_id: string | null
          user_id: string
        }
        Insert: {
          amount_iqd: number
          applied_order_id?: string | null
          created_at?: string
          id?: string
          reason: string
          referral_id?: string | null
          user_id: string
        }
        Update: {
          amount_iqd?: number
          applied_order_id?: string | null
          created_at?: string
          id?: string
          reason?: string
          referral_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_applied_order_id_fkey"
            columns: ["applied_order_id"]
            isOneToOne: false
            referencedRelation: "order_costs_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "referral_rewards_applied_order_id_fkey"
            columns: ["applied_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          code: string
          completed_at: string | null
          created_at: string
          first_order_id: string | null
          id: string
          referred_user_id: string | null
          referrer_user_id: string
          reward_amount_iqd: number
          rewarded_at: string | null
          status: string
        }
        Insert: {
          code: string
          completed_at?: string | null
          created_at?: string
          first_order_id?: string | null
          id?: string
          referred_user_id?: string | null
          referrer_user_id: string
          reward_amount_iqd?: number
          rewarded_at?: string | null
          status?: string
        }
        Update: {
          code?: string
          completed_at?: string | null
          created_at?: string
          first_order_id?: string | null
          id?: string
          referred_user_id?: string | null
          referrer_user_id?: string
          reward_amount_iqd?: number
          rewarded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_first_order_id_fkey"
            columns: ["first_order_id"]
            isOneToOne: false
            referencedRelation: "order_costs_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "referrals_first_order_id_fkey"
            columns: ["first_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_user_id_fkey"
            columns: ["referrer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      seasonal_themes: {
        Row: {
          accent_color: string | null
          active: boolean
          banner_text_ar: string | null
          banner_text_en: string | null
          banner_url: string | null
          created_at: string
          end_date: string | null
          frame_style: string | null
          header_size: string | null
          header_title_ar: string | null
          header_title_en: string | null
          id: string
          meaning_ar: string | null
          meaning_en: string | null
          motifs: Json | null
          name: string
          palette: Json | null
          pattern: string | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          active?: boolean
          banner_text_ar?: string | null
          banner_text_en?: string | null
          banner_url?: string | null
          created_at?: string
          end_date?: string | null
          frame_style?: string | null
          header_size?: string | null
          header_title_ar?: string | null
          header_title_en?: string | null
          id?: string
          meaning_ar?: string | null
          meaning_en?: string | null
          motifs?: Json | null
          name: string
          palette?: Json | null
          pattern?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          active?: boolean
          banner_text_ar?: string | null
          banner_text_en?: string | null
          banner_url?: string | null
          created_at?: string
          end_date?: string | null
          frame_style?: string | null
          header_size?: string | null
          header_title_ar?: string | null
          header_title_en?: string | null
          id?: string
          meaning_ar?: string | null
          meaning_en?: string | null
          motifs?: Json | null
          name?: string
          palette?: Json | null
          pattern?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      share_cards: {
        Row: {
          card_type: string
          generated_at: string
          height: number
          order_id: string
          storage_path: string
          width: number
        }
        Insert: {
          card_type: string
          generated_at?: string
          height: number
          order_id: string
          storage_path: string
          width: number
        }
        Update: {
          card_type?: string
          generated_at?: string
          height?: number
          order_id?: string
          storage_path?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "share_cards_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_costs_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "share_cards_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      share_events: {
        Row: {
          created_at: string
          id: string
          ip: string | null
          order_id: string | null
          platform_key: string
          share_token: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip?: string | null
          order_id?: string | null
          platform_key: string
          share_token?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string | null
          order_id?: string | null
          platform_key?: string
          share_token?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "share_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_costs_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "share_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      share_platforms: {
        Row: {
          card_type: string
          created_at: string
          enabled: boolean
          icon: string | null
          key: string
          label_ar: string
          label_en: string
          meta: Json
          needs_download: boolean
          sort_order: number
          updated_at: string
          url_template: string | null
        }
        Insert: {
          card_type?: string
          created_at?: string
          enabled?: boolean
          icon?: string | null
          key: string
          label_ar: string
          label_en: string
          meta?: Json
          needs_download?: boolean
          sort_order?: number
          updated_at?: string
          url_template?: string | null
        }
        Update: {
          card_type?: string
          created_at?: string
          enabled?: boolean
          icon?: string | null
          key?: string
          label_ar?: string
          label_en?: string
          meta?: Json
          needs_download?: boolean
          sort_order?: number
          updated_at?: string
          url_template?: string | null
        }
        Relationships: []
      }
      site_content: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      story_fingerprints: {
        Row: {
          created_at: string
          hash: string
          opening: string | null
          order_id: string | null
          plan_seed: string
          title: string | null
        }
        Insert: {
          created_at?: string
          hash: string
          opening?: string | null
          order_id?: string | null
          plan_seed: string
          title?: string | null
        }
        Update: {
          created_at?: string
          hash?: string
          opening?: string | null
          order_id?: string | null
          plan_seed?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "story_fingerprints_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_costs_v"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "story_fingerprints_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      story_pages: {
        Row: {
          created_at: string
          id: string
          image_path: string | null
          image_prompt: string | null
          order_id: string
          page_number: number
          qa_report: Json | null
          qa_retries: number
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
          qa_report?: Json | null
          qa_retries?: number
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
          qa_report?: Json | null
          qa_retries?: number
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
      testimonials: {
        Row: {
          author_city: string | null
          author_name: string
          avatar_url: string | null
          content: string
          created_at: string
          featured: boolean
          id: string
          published: boolean
          rating: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          author_city?: string | null
          author_name: string
          avatar_url?: string | null
          content: string
          created_at?: string
          featured?: boolean
          id?: string
          published?: boolean
          rating?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          author_city?: string | null
          author_name?: string
          avatar_url?: string | null
          content?: string
          created_at?: string
          featured?: boolean
          id?: string
          published?: boolean
          rating?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
          referral_code: string | null
          referral_credit_iqd: number
          referred_by_user_id: string | null
          status: string
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
          referral_code?: string | null
          referral_credit_iqd?: number
          referred_by_user_id?: string | null
          status?: string
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
          referral_code?: string | null
          referral_credit_iqd?: number
          referred_by_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_referred_by_user_id_fkey"
            columns: ["referred_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_events: {
        Row: {
          created_at: string
          id: string
          path: string
          referral_code: string | null
          referrer: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          referral_code?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          referral_code?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      generate_referral_code: { Args: never; Returns: string }
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
