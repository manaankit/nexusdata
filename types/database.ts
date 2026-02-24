import { Database } from '@/types/supabase'

export type DatabaseConnection = Database['public']['Tables']['database_connections']['Row']
export type DatabaseConnectionInsert = Database['public']['Tables']['database_connections']['Insert']
export type DatabaseConnectionUpdate = Database['public']['Tables']['database_connections']['Update']
export type ConnectionStatus = Database['public']['Enums']['connection_status']
