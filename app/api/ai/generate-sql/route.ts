import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AISettingsService } from '@/lib/services/ai-settings-service';
import { AIAssistantService } from '@/lib/services/ai-assistant';
import MetadataService from '@/lib/services/metadata-service';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recommendation, connectionId } = await request.json();
    
    if (!recommendation || !connectionId) {
      return NextResponse.json(
        { error: 'Recommendation and connection ID are required' },
        { status: 400 }
      );
    }

    // Get table metadata
    const metadata = await MetadataService.getCachedMetadata(connectionId);
    const tableMetadata = metadata.find(meta => 
      meta.table_name === recommendation.tableName && 
      meta.schema_name === recommendation.schemaName
    );

    if (!tableMetadata) {
      return NextResponse.json(
        { error: 'Table metadata not found' },
        { status: 404 }
      );
    }

    // Get user AI settings
    let aiSettings = await AISettingsService.getUserSettings(user.id);
    if (!aiSettings) {
      aiSettings = await AISettingsService.getDefaultSettings();
    }

    // Check if API key is available
    const hasApiKey = aiSettings.provider === 'openai'
      ? aiSettings.openai_api_key || process.env.OPENAI_API_KEY
      : aiSettings.gemini_api_key || process.env.GEMINI_API_KEY;

    if (!hasApiKey) {
      return NextResponse.json({
        error: `No API key configured for ${aiSettings.provider}. Please update your AI settings.`
      }, { status: 400 });
    }

    const aiService = new AIAssistantService(aiSettings);
    const sqlScript = await aiService.generateSQLScript(recommendation, tableMetadata);

    return NextResponse.json({ sqlScript });
  } catch (error) {
    console.error('Error generating SQL script:', error);
    return NextResponse.json(
      { error: 'Failed to generate SQL script' },
      { status: 500 }
    );
  }
}
