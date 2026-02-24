import { createClient } from '@/libs/supabase/server'
import { NextResponse } from 'next/server'
import { Database } from '@/types/supabase'

export async function getUserRole() {
  const supabase = createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return { error: 'Not authenticated', status: 401 }
  }
  
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role, is_active')
    .eq('id', user.id)
    .single()
  
  if (userError) {
    return { error: 'User not found', status: 404 }
  }
  
  if (!userData.is_active) {
    return { error: 'User account is inactive', status: 403 }
  }
  
  return { 
    user: {
      id: user.id,
      email: user.email,
      role: userData.role as Database['public']['Enums']['user_role']
    }
  }
}

export function checkPermission(
  userRole: Database['public']['Enums']['user_role'], 
  requiredRole: Database['public']['Enums']['user_role']
) {
  const roleHierarchy: Record<Database['public']['Enums']['user_role'], number> = {
    'administrator': 3,
    'delegate': 2,
    'read_only': 1
  }
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}
