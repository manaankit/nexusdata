import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('recommendations')
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('id', params.connectionId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error resolving recommendation:', error);
    return NextResponse.json(
      { error: 'Failed to resolve recommendation' },
      { status: 500 }
    );
  }
}
