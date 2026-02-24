BEGIN;

-- Create recommendations table
CREATE TABLE IF NOT EXISTS recommendations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    connection_id UUID REFERENCES database_connections(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    schema_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('error', 'warning', 'issue')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    sql_script TEXT,
    severity INTEGER DEFAULT 1 CHECK (severity IN (1, 2, 3)),
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_recommendations_connection ON recommendations(connection_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_type ON recommendations(type);
CREATE INDEX IF NOT EXISTS idx_recommendations_severity ON recommendations(severity);
CREATE INDEX IF NOT EXISTS idx_recommendations_resolved ON recommendations(is_resolved);

COMMIT;