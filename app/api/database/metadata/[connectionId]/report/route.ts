import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import SchemaReportService from '@/lib/services/schema-report-service';

export async function GET(
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

    const csv = await SchemaReportService.generateCsvReport(params.connectionId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="schema-report-${params.connectionId}-${timestamp}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error generating schema report:', error);
    return NextResponse.json(
      { error: 'Failed to generate schema report' },
      { status: 500 }
    );
  }
}
