export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      }
    }
    Views: {}
    Functions: {}
    Enums: {
      ai_provider: "openai" | "gemini"
      connection_status: "active" | "inactive" | "testing" | "error"
      user_role: "administrator" | "delegate" | "read_only"
    }
    CompositeTypes: {}
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
