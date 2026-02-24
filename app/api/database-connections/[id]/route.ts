import { createClient } from '@/libs/supabase/server'
import { NextResponse } from 'next/server'
import { getUserRole, checkPermission } from '@/libs/auth/protected-route'
import { DatabaseConnectionUpdate } from '@/types/database'
import { decrypt, encrypt } from '@/libs/crypto'

// GET /api/database-connections/[id] - Get a specific database connection
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
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
    .eq('id', params.id)
  
  // Non-administrators can only see their own connections
  if (user.role !== 'administrator') {
    query = query.eq('created_by', user.id)
  }
  
  const { data, error } = await query.single()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  if (!data) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }
  
  // Decrypt password for administrators
  if (user.role === 'administrator') {
    return NextResponse.json({
      ...data,
      password: decrypt(data.password_encrypted)
    })
  }
  
  // Remove sensitive data for non-administrators
  const { password_encrypted, ...safeConnection } = data
  return NextResponse.json(safeConnection)
}

// PUT /api/database-connections/[id] - Update a database connection
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authResult = await getUserRole()
  
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }
  
  const { user } = authResult
  
  // Only administrators and delegates can update connections
  if (!checkPermission(user.role, 'delegate')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  
  const supabase = createClient()
  const body = await request.json() as DatabaseConnectionUpdate & { password?: string }
  
  // Check if connection exists and user has permission to update it
  const { data: existingConnection, error: fetchError } = await supabase
    .from('database_connections')
    .select('created_by')
    .eq('id', params.id)
    .single()
  
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }
  
  if (!existingConnection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }
  
  // Non-administrators can only update their own connections
  if (user.role !== 'administrator' && existingConnection.created_by !== user.id) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  
  // Encrypt password if provided
  let updateData: DatabaseConnectionUpdate = { ...body }

  const incomingPassword = (() => {
    if (typeof body.password === 'string' && body.password.trim() !== '') {
      return body.password
    }

    if (typeof body.password_encrypted === 'string' && body.password_encrypted.trim() !== '') {
      return body.password_encrypted
    }

    return ''
  })()

  if (incomingPassword) {
    updateData.password_encrypted = encrypt(incomingPassword)
  }
  
  // Remove plain password from object if it exists
  if ('password' in updateData) {
    delete (updateData as any).password
  }
  
  const { data, error } = await supabase
    .from('database_connections')
    .update(updateData)
    .eq('id', params.id)
    .select()
    .single()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(data)
}

// DELETE /api/database-connections/[id] - Delete a database connection
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authResult = await getUserRole()
  
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }
  
  const { user } = authResult
  
  // Only administrators and delegates can delete connections
  if (!checkPermission(user.role, 'delegate')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  
  const supabase = createClient()
  
  // Check if connection exists and user has permission to delete it
  const { data: existingConnection, error: fetchError } = await supabase
    .from('database_connections')
    .select('created_by')
    .eq('id', params.id)
    .single()
  
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }
  
  if (!existingConnection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }
  
  // Non-administrators can only delete their own connections
  if (user.role !== 'administrator' && existingConnection.created_by !== user.id) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  
  const { error } = await supabase
    .from('database_connections')
    .delete()
    .eq('id', params.id)
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ message: 'Connection deleted successfully' })
}
