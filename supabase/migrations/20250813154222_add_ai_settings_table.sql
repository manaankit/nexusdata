BEGIN;

-- Create ai_settings table
CREATE TABLE IF NOT EXISTS ai_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'openai',
    openai_api_key_encrypted TEXT,
    openai_model TEXT DEFAULT 'gpt-4o',
    gemini_api_key_encrypted TEXT,
    gemini_model TEXT DEFAULT 'gemini-1.5-pro',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for ai_settings
DROP TRIGGER IF EXISTS update_ai_settings_updated_at ON ai_settings;
CREATE TRIGGER update_ai_settings_updated_at
BEFORE UPDATE ON ai_settings
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

COMMIT;