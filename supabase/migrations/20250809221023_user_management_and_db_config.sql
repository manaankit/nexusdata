BEGIN;

-- Create enum for user roles
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('administrator', 'delegate', 'read_only');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for database connection status
DO $$ BEGIN
    CREATE TYPE connection_status AS ENUM ('active', 'inactive', 'testing', 'error');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create users table for role management
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'read_only',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Create database_connections table
CREATE TABLE IF NOT EXISTS database_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 5432,
    database_name TEXT NOT NULL,
    username TEXT NOT NULL,
    password_encrypted TEXT NOT NULL,
    schema_name TEXT NOT NULL DEFAULT 'public',
    status connection_status DEFAULT 'inactive',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_tested TIMESTAMP WITH TIME ZONE,
    test_result TEXT,
    is_active BOOLEAN DEFAULT false
);

-- Create table_metadata table
CREATE TABLE IF NOT EXISTS table_metadata (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    connection_id UUID REFERENCES database_connections(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    schema_name TEXT NOT NULL,
    column_count INTEGER,
    row_count BIGINT,
    data_types JSONB,
    constraints JSONB,
    indexes JSONB,
    foreign_keys JSONB,
    nullable_columns INTEGER,
    primary_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(connection_id, table_name, schema_name)
);

-- Insert default admin user if not exists
INSERT INTO users (email, full_name, role) 
VALUES ('admin@example.com', 'System Administrator', 'administrator')
ON CONFLICT (email) DO NOTHING;

COMMIT;