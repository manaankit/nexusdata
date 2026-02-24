import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';
import { getUserRole, checkPermission } from '@/libs/auth/protected-route';
import { encrypt } from '@/libs/crypto';

export async function GET(request: NextRequest) {
  try {
    const authResult = await getUserRole();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    
    const { user } = authResult;
    
    // Only administrators and delegates can view settings
    if (!checkPermission(user.role, 'delegate')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows returned"
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // If no settings exist, return default settings
    if (!data) {
      return NextResponse.json({
        provider: 'openai',
        openai_model: 'gpt-4o',
        gemini_model: 'gemini-1.5-pro'
      });
    }
    
    // Remove encrypted keys from response for security
    const { openai_api_key_encrypted, gemini_api_key_encrypted, ...safeData } = data;
    
    // Return masked API keys
    return NextResponse.json({
      ...safeData,
      openai_api_key: openai_api_key_encrypted ? '••••••••••••••••' : '',
      gemini_api_key: gemini_api_key_encrypted ? '••••••••••••••••' : ''
    });
  } catch (error: any) {
    console.error('Error fetching AI settings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await getUserRole();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    
    const { user } = authResult;
    
    // Only administrators and delegates can update settings
    if (!checkPermission(user.role, 'delegate')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    const body = await request.json();
    const supabase = createClient();
    
    // Encrypt API keys if provided and not masked
    const updateData: any = {
      provider: body.provider,
      user_id: user.id
    };
    
    if (body.provider === 'openai') {
      updateData.openai_model = body.openai_model;
      if (body.openai_api_key && !body.openai_api_key.includes('•')) {
        updateData.openai_api_key_encrypted = encrypt(body.openai_api_key);
      }
    } else {
      updateData.gemini_model = body.gemini_model;
      if (body.gemini_api_key && !body.gemini_api_key.includes('•')) {
        updateData.gemini_api_key_encrypted = encrypt(body.gemini_api_key);
      }
    }
    
    // Check if settings already exist for this user
    const { data: existingSettings } = await supabase
      .from('ai_settings')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    let result;
    
    if (existingSettings) {
      // Update existing settings
      result = await supabase
        .from('ai_settings')
        .update(updateData)
        .eq('id', existingSettings.id)
        .select()
        .single();
    } else {
      // Create new settings
      result = await supabase
        .from('ai_settings')
        .insert(updateData)
        .select()
        .single();
    }
    
    if (result.error) {
      throw new Error(result.error.message);
    }
    
    // Return the updated settings (without showing the actual API keys)
    const { openai_api_key_encrypted, gemini_api_key_encrypted, ...safeData } = result.data;
    
    return NextResponse.json({
      ...safeData,
      openai_api_key: openai_api_key_encrypted ? '••••••••••••••••' : '',
      gemini_api_key: gemini_api_key_encrypted ? '••••••••••••••••' : ''
    });
  } catch (error: any) {
    console.error('Error updating AI settings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
