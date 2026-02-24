import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import AIRecommendationService from '@/lib/services/ai-recommendation-service';

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

    const recommendations = await AIRecommendationService.getRecommendations(params.connectionId);
    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
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

    const analysis = await AIRecommendationService.analyzeDataQuality(params.connectionId);
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('Error analyzing data quality:', error);
    return NextResponse.json(
      { error: 'Failed to analyze data quality' },
      { status: 500 }
    );
  }
}
