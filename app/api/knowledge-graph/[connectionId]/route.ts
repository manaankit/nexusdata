import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import KnowledgeGraphService from '@/lib/services/knowledge-graph-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const graph = await KnowledgeGraphService.generateGraph(params.connectionId);
    return NextResponse.json({ graph });
  } catch (error) {
    console.error('Error generating knowledge graph:', error);
    return NextResponse.json(
      { error: 'Failed to generate knowledge graph' },
      { status: 500 }
    );
  }
}
