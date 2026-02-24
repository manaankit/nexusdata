import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AISettingsService } from '@/lib/services/ai-settings-service';
import MetadataService from '@/lib/services/metadata-service';
import AIRecommendationService from '@/lib/services/ai-recommendation-service';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const connectionId = url.searchParams.get('connectionId');

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    const recommendations = await AIRecommendationService.getRecommendations(connectionId);
    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { connectionId } = await request.json();
    
    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    // Get metadata for analysis
    const metadata = await MetadataService.getCachedMetadata(connectionId);
    
    if (metadata.length === 0) {
      return NextResponse.json(
        { error: 'No metadata found. Please extract metadata first.' },
        { status: 400 }
      );
    }

    // Get user AI settings
    let aiSettings = await AISettingsService.getUserSettings(user.id);
    if (!aiSettings) {
      aiSettings = await AISettingsService.getDefaultSettings();
    }

    if (aiSettings.provider === 'openai' && !aiSettings.openai_api_key) {
      aiSettings.openai_api_key = process.env.OPENAI_API_KEY || '';
    }

    if (aiSettings.provider === 'gemini' && !aiSettings.gemini_api_key) {
      aiSettings.gemini_api_key = process.env.GEMINI_API_KEY || '';
    }

    // Check if API key is available
    const hasApiKey = aiSettings.provider === 'openai'
      ? aiSettings.openai_api_key
      : aiSettings.gemini_api_key;

    if (!hasApiKey) {
      return NextResponse.json({
        error: `No API key configured for ${aiSettings.provider}. Please update your AI settings.`
      }, { status: 400 });
    }

    const analysis = await AIRecommendationService.analyzeDataQuality(connectionId, aiSettings);

    return NextResponse.json({ 
      analysis,
      message: `Generated ${analysis.length} recommendations using ${aiSettings.provider}`
    });
  } catch (error) {
    console.error('Error analyzing data quality:', error);
    return NextResponse.json(
      { error: 'Failed to analyze data quality' },
      { status: 500 }
    );
  }
}
