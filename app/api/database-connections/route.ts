import { createClient } from '@/libs/supabase/server'
import { NextResponse } from 'next/server'
import { getUserRole, checkPermission } from '@/libs/auth/protected-route'
import { DatabaseConnectionInsert } from '@/types/database'
import { encrypt, decrypt } from '@/libs/crypto'

// GET /api/database-connections - Get all database connections (with optional filtering)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const schema = searchParams.get('schema')
  const isActive = searchParams.get('is_active')
  
  const authResult = await getUserRole()
  
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }
  
  const { user } = authResult
  
  // Only administrators and delegates can view connections
  if (!checkPermission(user.role, 'delegate')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  
  const supabase = createClient()
  
  let query = supabase
    .from('database_connections')
    .select('*')
    .order('created_at', { ascending: false })
  
  // Apply filters if provided
  if (schema) {
    query = query.eq('schema_name', schema)
  }
  
  if (isActive !== null) {
    query = query.eq('is_active', isActive === 'true')
  }
  
  // Non-administrators can only see their own connections
  if (user.role !== 'administrator') {
    query = query.eq('created_by', user.id)
  }
  
  const { data, error } = await query
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  // Decrypt passwords for response (only for administrators)
  const connections = data.map(connection => {
    if (user.role === 'administrator') {
      return {
        ...connection,
        password: decrypt(connection.password_encrypted)
      }
    }
    // Remove sensitive data for non-administrators
    const { password_encrypted, ...safeConnection } = connection
    return safeConnection
  })
  
  return NextResponse.json(connections)
}

// POST /api/database-connections - Create a new database connection
export async function POST(request: Request) {
  const authResult = await getUserRole()
  
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }
  
  const { user } = authResult
  
  // Only administrators and delegates can create connections
  if (!checkPermission(user.role, 'delegate')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  
  const supabase = createClient()
  const body = await request.json() as DatabaseConnectionInsert & { password?: string }
  const plainPassword = body.password || body.password_encrypted || ''

  if (!plainPassword) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 })
  }
  
  // Encrypt the password
  const encryptedPassword = encrypt(plainPassword)
  
  const newConnection: DatabaseConnectionInsert = {
    ...body,
    password_encrypted: encryptedPassword,
    created_by: user.id,
    is_active: body.is_active ?? true,
    port: body.port ?? 5432,
    schema_name: body.schema_name ?? 'public'
  }
  
  // Remove plain password from object if it exists
  if ('password' in newConnection) {
    delete (newConnection as any).password
  }
  
  const { data, error } = await supabase
    .from('database_connections')
    .insert(newConnection)
    .select()
    .single()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(data)
}
