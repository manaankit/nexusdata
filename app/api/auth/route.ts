import { createClient } from '@/libs/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const supabase = createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  
  // Get user role from database
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role, is_active')
    .eq('id', user.id)
    .single()
  
  if (userError) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  
  if (!userData.is_active) {
    return NextResponse.json({ error: 'User account is inactive' }, { status: 403 })
  }
  
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: userData.role,
    }
  })
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { email, password } = await request.json()
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  
  // Update last login
  await supabase
    .from('users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', data.user.id)
  
  return NextResponse.json({ user: data.user })
}

export async function DELETE() {
  const supabase = createClient()
  
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  
  return NextResponse.json({ message: 'Signed out successfully' })
}
