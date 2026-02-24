import { NextRequest, NextResponse } from 'next/server';
import WorkspaceIngestionService from '@/lib/services/workspace-ingestion-service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const maxRecordsValue = formData.get('maxRecords');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'A file field is required in multipart form data.' },
        { status: 400 }
      );
    }

    let maxRecords: number | null | undefined = undefined;
    if (typeof maxRecordsValue === 'string' && maxRecordsValue.trim().length > 0) {
      if (maxRecordsValue.trim().toLowerCase() === 'all') {
        maxRecords = null;
      } else {
        const parsed = Number(maxRecordsValue);
        if (!Number.isFinite(parsed)) {
          return NextResponse.json(
            { error: 'maxRecords must be a number or "all".' },
            { status: 400 }
          );
        }
        maxRecords = parsed;
      }
    }

    const datasets = await WorkspaceIngestionService.parseFile(file, { maxRecords });
    return NextResponse.json({ datasets });
  } catch (error) {
    console.error('Workspace parse-file error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse file' },
      { status: 500 }
    );
  }
}
