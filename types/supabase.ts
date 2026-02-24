export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      ai_settings: {
        Row: {
          created_at: string | null
          gemini_api_key_encrypted: string | null
          gemini_model: string | null
          id: string
          openai_api_key_encrypted: string | null
          openai_model: string | null
          provider: Database["public"]["Enums"]["ai_provider"]
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          gemini_api_key_encrypted?: string | null
          gemini_model?: string | null
          id?: string
          openai_api_key_encrypted?: string | null
          openai_model?: string | null
          provider?: Database["public"]["Enums"]["ai_provider"]
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          gemini_api_key_encrypted?: string | null
          gemini_model?: string | null
          id?: string
          openai_api_key_encrypted?: string | null
          openai_model?: string | null
          provider?: Database["public"]["Enums"]["ai_provider"]
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      database_connections: {
        Row: {
          created_at: string | null
          created_by: string | null
          database_name: string
          host: string
          id: string
          is_active: boolean | null
          last_tested: string | null
          name: string
          password_encrypted: string
          port: number
          schema_name: string
          status: Database["public"]["Enums"]["connection_status"] | null
          test_result: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          database_name: string
          host: string
          id?: string
          is_active?: boolean | null
          last_tested?: string | null
          name: string
          password_encrypted: string
          port?: number
          schema_name?: string
          status?: Database["public"]["Enums"]["connection_status"] | null
          test_result?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          database_name?: string
          host?: string
          id?: string
          is_active?: boolean | null
          last_tested?: string | null
          name?: string
          password_encrypted?: string
          port?: number
          schema_name?: string
          status?: Database["public"]["Enums"]["connection_status"] | null
          test_result?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "database_connections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          connection_id: string | null
          created_at: string | null
          description: string
          id: string
          is_resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          schema_name: string
          severity: number | null
          sql_script: string | null
          table_name: string
          title: string
          type: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          is_resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          schema_name: string
          severity?: number | null
          sql_script?: string | null
          table_name: string
          title: string
          type: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          is_resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          schema_name?: string
          severity?: number | null
          sql_script?: string | null
          table_name?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "database_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      table_metadata: {
        Row: {
          column_count: number | null
          connection_id: string | null
          constraints: Json | null
          created_at: string | null
          data_types: Json | null
          foreign_keys: Json | null
          id: string
          indexes: Json | null
          nullable_columns: number | null
          primary_key: string | null
          row_count: number | null
          schema_name: string
          table_name: string
          updated_at: string | null
        }
        Insert: {
          column_count?: number | null
          connection_id?: string | null
          constraints?: Json | null
          created_at?: string | null
          data_types?: Json | null
          foreign_keys?: Json | null
          id?: string
          indexes?: Json | null
          nullable_columns?: number | null
          primary_key?: string | null
          row_count?: number | null
          schema_name: string
          table_name: string
          updated_at?: string | null
        }
        Update: {
          column_count?: number | null
          connection_id?: string | null
          constraints?: Json | null
          created_at?: string | null
          data_types?: Json | null
          foreign_keys?: Json | null
          id?: string
          indexes?: Json | null
          nullable_columns?: number | null
          primary_key?: string | null
          row_count?: number | null
          schema_name?: string
          table_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "table_metadata_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "database_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean | null
          last_login: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      ai_provider: "openai" | "gemini"
      connection_status: "active" | "inactive" | "testing" | "error"
      user_role: "administrator" | "delegate" | "read_only"
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
      ai_provider: ["openai", "gemini"],
      connection_status: ["active", "inactive", "testing", "error"],
      user_role: ["administrator", "delegate", "read_only"],
    },
  },
} as const
