import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import DatabaseService from '@/lib/services/database-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbService = new DatabaseService();
    await dbService.deactivateDatabaseConnection(params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deactivating connection:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate connection' },
      { status: 500 }
    );
  }
}
