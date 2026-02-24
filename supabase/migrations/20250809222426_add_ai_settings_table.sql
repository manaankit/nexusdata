BEGIN;

-- Create AI provider enum
CREATE TYPE ai_provider AS ENUM ('openai', 'gemini');

-- Create AI settings table
CREATE TABLE IF NOT EXISTS ai_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider ai_provider NOT NULL DEFAULT 'openai',
    openai_api_key_encrypted TEXT,
    gemini_api_key_encrypted TEXT,
    openai_model VARCHAR(50) DEFAULT 'gpt-4o',
    gemini_model VARCHAR(50) DEFAULT 'gemini-1.5-pro',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_settings_user ON ai_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_settings_provider ON ai_settings(provider);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_settings_updated_at BEFORE UPDATE
    ON ai_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

COMMIT;