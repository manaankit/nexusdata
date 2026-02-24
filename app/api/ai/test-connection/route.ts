import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { provider, apiKey, model } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    try {
      if (provider === 'openai') {
        const client = new OpenAI({ apiKey });
        await client.chat.completions.create({
          model: model || 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5
        });
      } else if (provider === 'gemini') {
        const genAI = new GoogleGenerativeAI(apiKey);
        const geminiModel = genAI.getGenerativeModel({ model: model || 'gemini-1.5-pro' });
        await geminiModel.generateContent('Hello');
      } else {
        return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
      }

      return NextResponse.json({ success: true });

    } catch (apiError: any) {
      console.error(`${provider} API error:`, apiError);
      return NextResponse.json(
        { error: `Connection failed: ${apiError.message}` },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error testing connection:', error);
    return NextResponse.json(
      { error: 'Failed to test connection' },
      { status: 500 }
    );
  }
}
