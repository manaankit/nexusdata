import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AISettingsService } from '@/lib/services/ai-settings-service';
import { AIAssistantService } from '@/lib/services/ai-assistant';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recommendation } = await request.json();
    
    if (!recommendation) {
      return NextResponse.json(
        { error: 'Recommendation data is required' },
        { status: 400 }
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
    const explanation = await aiService.explainRecommendation(recommendation);

    return NextResponse.json({ explanation });
  } catch (error) {
    console.error('Error explaining recommendation:', error);
    return NextResponse.json(
      { error: 'Failed to explain recommendation' },
      { status: 500 }
    );
  }
}
