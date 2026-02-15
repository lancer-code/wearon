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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string
          provider: string
          request_id: string | null
          store_id: string | null
        }
        Insert: {
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed_at?: string
          provider: string
          request_id?: string | null
          store_id?: string | null
        }
        Update: {
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string
          provider?: string
          request_id?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_webhook_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_sessions: {
        Row: {
          accessories: Json | null
          completed_at: string | null
          created_at: string | null
          credits_used: number | null
          error_message: string | null
          estimated_cost_usd: number | null
          generated_image_url: string | null
          id: string
          input_tokens: number | null
          model_image_url: string
          outfit_image_url: string | null
          output_tokens: number | null
          processing_time_ms: number | null
          prompt_system: string
          prompt_user: string | null
          status: string
          stitched_image_url: string | null
          user_id: string
        }
        Insert: {
          accessories?: Json | null
          completed_at?: string | null
          created_at?: string | null
          credits_used?: number | null
          error_message?: string | null
          estimated_cost_usd?: number | null
          generated_image_url?: string | null
          id?: string
          input_tokens?: number | null
          model_image_url: string
          outfit_image_url?: string | null
          output_tokens?: number | null
          processing_time_ms?: number | null
          prompt_system: string
          prompt_user?: string | null
          status?: string
          stitched_image_url?: string | null
          user_id: string
        }
        Update: {
          accessories?: Json | null
          completed_at?: string | null
          created_at?: string | null
          credits_used?: number | null
          error_message?: string | null
          estimated_cost_usd?: number | null
          generated_image_url?: string | null
          id?: string
          input_tokens?: number | null
          model_image_url?: string
          outfit_image_url?: string | null
          output_tokens?: number | null
          processing_time_ms?: number | null
          prompt_system?: string
          prompt_user?: string | null
          status?: string
          stitched_image_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          resource: string
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          resource: string
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          resource?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string | null
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string | null
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string | null
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      store_analytics_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          shopper_email: string | null
          store_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          shopper_email?: string | null
          store_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          shopper_email?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_analytics_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_api_keys: {
        Row: {
          allowed_domains: string[]
          created_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string | null
          store_id: string
        }
        Insert: {
          allowed_domains?: string[]
          created_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix?: string | null
          store_id: string
        }
        Update: {
          allowed_domains?: string[]
          created_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_api_keys_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_credit_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          request_id: string | null
          store_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          request_id?: string | null
          store_id: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          request_id?: string | null
          store_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_credit_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_credits: {
        Row: {
          balance: number
          id: string
          store_id: string
          total_purchased: number
          total_spent: number
          updated_at: string | null
        }
        Insert: {
          balance?: number
          id?: string
          store_id: string
          total_purchased?: number
          total_spent?: number
          updated_at?: string | null
        }
        Update: {
          balance?: number
          id?: string
          store_id?: string
          total_purchased?: number
          total_spent?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_credits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_generation_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          credits_used: number
          error_message: string | null
          estimated_cost_usd: number | null
          generated_image_url: string | null
          id: string
          input_tokens: number | null
          model_image_url: string
          outfit_image_url: string | null
          output_tokens: number | null
          processing_time_ms: number | null
          prompt_system: string
          prompt_user: string | null
          request_id: string | null
          shopper_email: string | null
          status: string
          store_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          credits_used?: number
          error_message?: string | null
          estimated_cost_usd?: number | null
          generated_image_url?: string | null
          id?: string
          input_tokens?: number | null
          model_image_url: string
          outfit_image_url?: string | null
          output_tokens?: number | null
          processing_time_ms?: number | null
          prompt_system: string
          prompt_user?: string | null
          request_id?: string | null
          shopper_email?: string | null
          status?: string
          store_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          credits_used?: number
          error_message?: string | null
          estimated_cost_usd?: number | null
          generated_image_url?: string | null
          id?: string
          input_tokens?: number | null
          model_image_url?: string
          outfit_image_url?: string | null
          output_tokens?: number | null
          processing_time_ms?: number | null
          prompt_system?: string
          prompt_user?: string | null
          request_id?: string | null
          shopper_email?: string | null
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_generation_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_shopper_credits: {
        Row: {
          balance: number
          created_at: string | null
          id: string
          shopper_email: string
          store_id: string
          total_purchased: number
          total_spent: number
          updated_at: string | null
        }
        Insert: {
          balance?: number
          created_at?: string | null
          id?: string
          shopper_email: string
          store_id: string
          total_purchased?: number
          total_spent?: number
          updated_at?: string | null
        }
        Update: {
          balance?: number
          created_at?: string | null
          id?: string
          shopper_email?: string
          store_id?: string
          total_purchased?: number
          total_spent?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_shopper_credits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_shopper_purchases: {
        Row: {
          amount_paid: number
          created_at: string | null
          credits_purchased: number
          currency: string
          id: string
          shopify_order_id: string
          shopper_email: string
          store_id: string
        }
        Insert: {
          amount_paid: number
          created_at?: string | null
          credits_purchased: number
          currency?: string
          id?: string
          shopify_order_id: string
          shopper_email: string
          store_id: string
        }
        Update: {
          amount_paid?: number
          created_at?: string | null
          credits_purchased?: number
          currency?: string
          id?: string
          shopify_order_id?: string
          shopper_email?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_shopper_purchases_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          access_token_encrypted: string | null
          billing_mode: string
          churn_flagged_at: string | null
          created_at: string | null
          id: string
          is_churn_risk: boolean
          onboarding_completed: boolean
          owner_user_id: string | null
          paddle_customer_id: string | null
          retail_credit_price: number | null
          shop_domain: string
          shopify_product_id: string | null
          shopify_variant_id: string | null
          status: string
          subscription_current_period_end: string | null
          subscription_id: string | null
          subscription_status: string | null
          subscription_tier: string | null
          updated_at: string | null
        }
        Insert: {
          access_token_encrypted?: string | null
          billing_mode?: string
          churn_flagged_at?: string | null
          created_at?: string | null
          id?: string
          is_churn_risk?: boolean
          onboarding_completed?: boolean
          owner_user_id?: string | null
          paddle_customer_id?: string | null
          retail_credit_price?: number | null
          shop_domain: string
          shopify_product_id?: string | null
          shopify_variant_id?: string | null
          status?: string
          subscription_current_period_end?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token_encrypted?: string | null
          billing_mode?: string
          churn_flagged_at?: string | null
          created_at?: string | null
          id?: string
          is_churn_risk?: boolean
          onboarding_completed?: boolean
          owner_user_id?: string | null
          paddle_customer_id?: string | null
          retail_credit_price?: number | null
          shop_domain?: string
          shopify_product_id?: string | null
          shopify_variant_id?: string | null
          status?: string
          subscription_current_period_end?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_body_profiles: {
        Row: {
          body_type: string | null
          created_at: string | null
          est_chest_cm: number | null
          est_hip_cm: number | null
          est_shoulder_cm: number | null
          est_waist_cm: number | null
          fit_preference: string | null
          gender: string | null
          height_cm: number
          id: string
          source: string
          updated_at: string | null
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          body_type?: string | null
          created_at?: string | null
          est_chest_cm?: number | null
          est_hip_cm?: number | null
          est_shoulder_cm?: number | null
          est_waist_cm?: number | null
          fit_preference?: string | null
          gender?: string | null
          height_cm: number
          id?: string
          source?: string
          updated_at?: string | null
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          body_type?: string | null
          created_at?: string | null
          est_chest_cm?: number | null
          est_hip_cm?: number | null
          est_shoulder_cm?: number | null
          est_waist_cm?: number | null
          fit_preference?: string | null
          gender?: string | null
          height_cm?: number
          id?: string
          source?: string
          updated_at?: string | null
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance: number
          id: string
          total_earned: number | null
          total_spent: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number
          id?: string
          total_earned?: number | null
          total_spent?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number
          id?: string
          total_earned?: number | null
          total_spent?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          age: number | null
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string
          gender: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email: string
          gender?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string
          gender?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_store_credits: {
        Args: {
          p_amount: number
          p_description?: string
          p_request_id: string
          p_store_id: string
          p_type: string
        }
        Returns: undefined
      }
      deduct_credits: {
        Args: { p_amount: number; p_description?: string; p_user_id: string }
        Returns: boolean
      }
      deduct_store_credits: {
        Args: {
          p_amount: number
          p_description?: string
          p_request_id: string
          p_store_id: string
        }
        Returns: boolean
      }
      deduct_store_shopper_credits: {
        Args: {
          p_amount: number
          p_description?: string
          p_request_id: string
          p_shopper_email: string
          p_store_id: string
        }
        Returns: boolean
      }
      get_generation_status_counts: {
        Args: never
        Returns: {
          count: number
          status: string
        }[]
      }
      get_processing_metrics: {
        Args: never
        Returns: {
          avg_ms: number
          max_ms: number
          min_ms: number
          total: number
        }[]
      }
      get_store_generation_counts: {
        Args: never
        Returns: {
          completed: number
          failed: number
          store_id: string
          total: number
        }[]
      }
      get_user_generation_stats: {
        Args: { p_user_id: string }
        Returns: {
          completed: number
          failed: number
          total: number
        }[]
      }
      get_user_permissions: {
        Args: { p_user_id: string }
        Returns: {
          permission_name: string
        }[]
      }
      get_user_roles: {
        Args: { p_user_id: string }
        Returns: {
          role_name: string
        }[]
      }
      process_store_shopper_purchase: {
        Args: {
          p_amount_paid: number
          p_credits_purchased: number
          p_currency?: string
          p_request_id?: string
          p_shopify_order_id: string
          p_shopper_email: string
          p_store_id: string
        }
        Returns: {
          amount_paid: number
          credits_purchased: number
          currency: string
          purchase_id: string
          shopify_order_id: string
          shopper_email: string
          status: string
          store_id: string
        }[]
      }
      refund_credits: {
        Args: { p_amount: number; p_description?: string; p_user_id: string }
        Returns: undefined
      }
      refund_store_credits: {
        Args: {
          p_amount: number
          p_description?: string
          p_request_id: string
          p_store_id: string
        }
        Returns: undefined
      }
      refund_store_shopper_credits: {
        Args: {
          p_amount: number
          p_description?: string
          p_request_id: string
          p_shopper_email: string
          p_store_id: string
        }
        Returns: undefined
      }
      user_has_permission: {
        Args: { p_permission_name: string; p_user_id: string }
        Returns: boolean
      }
      user_has_role: {
        Args: { p_role_name: string; p_user_id: string }
        Returns: boolean
      }
      uuid_generate_v7: { Args: never; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
