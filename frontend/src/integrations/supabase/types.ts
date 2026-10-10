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
      composition_assets: {
        Row: {
          allocation_percent: number
          asset_id: string
          category: string
          composition_id: string
          created_at: string
          current_simulated_price: number
          current_value: number
          exposure: string
          id: string
          initial_simulated_price: number
          initial_value: number
          name: string
          risks: string
          ticker: string
          user_id: string
          why: string
        }
        Insert: {
          allocation_percent: number
          asset_id: string
          category: string
          composition_id: string
          created_at?: string
          current_simulated_price: number
          current_value: number
          exposure: string
          id?: string
          initial_simulated_price: number
          initial_value: number
          name: string
          risks: string
          ticker: string
          user_id: string
          why: string
        }
        Update: {
          allocation_percent?: number
          asset_id?: string
          category?: string
          composition_id?: string
          created_at?: string
          current_simulated_price?: number
          current_value?: number
          exposure?: string
          id?: string
          initial_simulated_price?: number
          initial_value?: number
          name?: string
          risks?: string
          ticker?: string
          user_id?: string
          why?: string
        }
        Relationships: [
          {
            foreignKeyName: "composition_assets_composition_id_fkey"
            columns: ["composition_id"]
            isOneToOne: false
            referencedRelation: "compositions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "composition_assets_owner_fkey"
            columns: ["composition_id", "user_id"]
            isOneToOne: false
            referencedRelation: "compositions"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "composition_assets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      compositions: {
        Row: {
          created_at: string
          current_simulated_value: number
          id: string
          initial_amount: number
          thesis_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_simulated_value: number
          id?: string
          initial_amount: number
          thesis_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_simulated_value?: number
          id?: string
          initial_amount?: number
          thesis_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compositions_thesis_id_fkey"
            columns: ["thesis_id"]
            isOneToOne: true
            referencedRelation: "theses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compositions_thesis_owner_fkey"
            columns: ["thesis_id", "user_id"]
            isOneToOne: false
            referencedRelation: "theses"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "compositions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_sessions: {
        Row: {
          created_at: string
          id: string
          secret_hash: string
          state: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          secret_hash: string
          state?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          secret_hash?: string
          state?: Json
          updated_at?: string
        }
        Relationships: []
      }
      demo_wallet_approval_challenges: {
        Row: {
          challenge: Json
          consumed_at: string | null
          created_at: string
          demo_session_id: string
          expires_at: string
          id: string
          nonce: string
          wallet_address: string
        }
        Insert: {
          challenge: Json
          consumed_at?: string | null
          created_at?: string
          demo_session_id: string
          expires_at: string
          id: string
          nonce: string
          wallet_address: string
        }
        Update: {
          challenge?: Json
          consumed_at?: string | null
          created_at?: string
          demo_session_id?: string
          expires_at?: string
          id?: string
          nonce?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_wallet_approval_challenges_demo_session_id_fkey"
            columns: ["demo_session_id"]
            isOneToOne: false
            referencedRelation: "demo_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      early_access_signups: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          whatsapp: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          whatsapp: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          whatsapp?: string
        }
        Relationships: []
      }
      performance_snapshots: {
        Row: {
          composition_id: string
          created_at: string
          id: string
          snapshot_date: string
          user_id: string
          value: number
        }
        Insert: {
          composition_id: string
          created_at?: string
          id?: string
          snapshot_date: string
          user_id: string
          value: number
        }
        Update: {
          composition_id?: string
          created_at?: string
          id?: string
          snapshot_date?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_snapshots_composition_id_fkey"
            columns: ["composition_id"]
            isOneToOne: false
            referencedRelation: "compositions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_snapshots_owner_fkey"
            columns: ["composition_id", "user_id"]
            isOneToOne: false
            referencedRelation: "compositions"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "performance_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      theses: {
        Row: {
          created_at: string
          demo_session_id: string | null
          id: string
          interpreted_thesis: string
          original_belief: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          demo_session_id?: string | null
          id?: string
          interpreted_thesis: string
          original_belief: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          demo_session_id?: string | null
          id?: string
          interpreted_thesis?: string
          original_belief?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "theses_user_id_fkey"
            columns: ["user_id"]
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
      consume_demo_wallet_approval: {
        Args: { challenge_id: string; session_id: string }
        Returns: boolean
      }
      save_tracked_thesis_atomic: {
        Args: { owner_id: string; payload: Json; session_id: string }
        Returns: string
      }
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
