import { NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';
import { checkPermission, getUserRole } from '@/libs/auth/protected-route';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authResult = await getUserRole();

  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { user } = authResult;
  if (!checkPermission(user.role, 'delegate')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const supabase = createClient();

  let query = supabase
    .from('database_connections')
    .select('id, created_by')
    .eq('id', params.id);

  if (user.role !== 'administrator') {
    query = query.eq('created_by', user.id);
  }

  const { data: connection, error: connectionError } = await query.single();

  if (connectionError) {
    return NextResponse.json({ error: connectionError.message }, { status: 500 });
  }

  if (!connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  const ownerId = connection.created_by || user.id;

  const { error: deactivateError } = await supabase
    .from('database_connections')
    .update({ is_active: false })
    .eq('created_by', ownerId);

  if (deactivateError) {
    return NextResponse.json({ error: deactivateError.message }, { status: 500 });
  }

  const { error: activateError } = await supabase
    .from('database_connections')
    .update({ is_active: true, status: 'active' })
    .eq('id', params.id);

  if (activateError) {
    return NextResponse.json({ error: activateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
