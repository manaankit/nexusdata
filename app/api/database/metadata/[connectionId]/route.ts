import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import MetadataService from '@/lib/services/metadata-service';

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

    const metadata = await MetadataService.getCachedMetadata(params.connectionId);
    return NextResponse.json({ metadata });
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metadata' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const metadata = await MetadataService.extractAndStoreMetadata(params.connectionId);
    return NextResponse.json({ 
      metadata,
      message: 'Metadata extracted and stored successfully' 
    });
  } catch (error) {
    console.error('Error extracting metadata:', error);
    return NextResponse.json(
      { error: 'Failed to extract metadata' },
      { status: 500 }
    );
  }
}
