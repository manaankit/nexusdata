import { createClient } from '@/libs/supabase/server'
import { NextResponse } from 'next/server'
import { getUserRole, checkPermission } from '@/libs/auth/protected-route'
// Note: We'll implement a safer testing method that doesn't expose credentials

// POST /api/database-connections/[id]/test - Test a database connection
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authResult = await getUserRole()
  
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }
  
  const { user } = authResult
  
  // Only administrators and delegates can test connections
  if (!checkPermission(user.role, 'delegate')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  
  const supabase = createClient()
  
  // Get the connection details
  let query = supabase
    .from('database_connections')
    .select('*')
    .eq('id', params.id)
  
  // Non-administrators can only test their own connections
  if (user.role !== 'administrator') {
    query = query.eq('created_by', user.id)
  }
  
  const { data: connection, error: fetchError } = await query.single()
  
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }
  
  if (!connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }
  
  // Update the connection status to "testing"
  await supabase
    .from('database_connections')
    .update({ 
      status: 'testing',
      last_tested: new Date().toISOString()
    })
    .eq('id', params.id)
  
  // For security reasons, we'll simulate a test since we can't actually connect to external databases
  // In a real implementation, you would use a backend service to test the connection
  const testResult = {
    success: true,
    message: 'Connection test successful (simulated)'
  }
  
  // Update the connection with test results
  const { error: updateError } = await supabase
    .from('database_connections')
    .update({ 
      status: testResult.success ? 'active' : 'error',
      test_result: testResult.message,
      last_tested: new Date().toISOString()
    })
    .eq('id', params.id)
  
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }
  
  return NextResponse.json({
    success: testResult.success,
    message: testResult.message
  })
}
