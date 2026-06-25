-- ============================================
   KARAI v2 - Supabase Database Schema
   Sarkas tapi Berguna
   ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE,
    name VARCHAR(255),
    avatar TEXT,
    tier VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================
-- CONVERSATIONS TABLE
-- ============================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'New Chat',
    mode VARCHAR(50) DEFAULT 'chat', -- chat, voice, coding
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at);
CREATE INDEX idx_conversations_mode ON conversations(mode);

-- ============================================
-- MESSAGES TABLE
-- ============================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- user, assistant, system
    content TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_role ON messages(role);

-- ============================================
-- USAGE TABLE (for rate limiting)
-- ============================================
CREATE TABLE usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    message_count INTEGER DEFAULT 0,
    last_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Indexes
CREATE INDEX idx_usage_user_id ON usage(user_id);
CREATE INDEX idx_usage_date ON usage(date);

-- ============================================
-- GUEST SESSIONS TABLE (for guest mode tracking)
-- ============================================
CREATE TABLE guest_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    message_count INTEGER DEFAULT 0,
    daily_limit INTEGER DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_guest_sessions_session_id ON guest_sessions(session_id);
CREATE INDEX idx_guest_sessions_created_at ON guest_sessions(created_at);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to reset daily usage
CREATE OR REPLACE FUNCTION reset_daily_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.date > OLD.date THEN
        NEW.message_count = 0;
        NEW.last_reset = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to check guest daily limit
CREATE OR REPLACE FUNCTION check_guest_limit(p_session_id VARCHAR)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, limit_val INTEGER) AS $$
DECLARE
    session_record RECORD;
    today DATE := CURRENT_DATE;
    today_count INTEGER;
BEGIN
    -- Get guest session info
    SELECT * INTO session_record
    FROM guest_sessions
    WHERE session_id = p_session_id
    AND DATE(created_at) = today;
    
    -- Count today's messages
    SELECT COALESCE(SUM(message_count), 0) INTO today_count
    FROM guest_sessions
    WHERE session_id = p_session_id
    AND DATE(created_at) = today;
    
    -- Return result
    IF session_record IS NULL THEN
        RETURN QUERY SELECT TRUE, 50, 50;
    ELSE
        remaining := session_record.daily_limit - today_count;
        RETURN QUERY SELECT 
            (remaining > 0),
            GREATEST(remaining, 0),
            session_record.daily_limit;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger to update updated_at on users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on conversations table
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_sessions ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own data"
    ON users FOR SELECT
    USING (auth.uid() = id OR id IS NULL);

CREATE POLICY "Users can insert own data"
    ON users FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own data"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- Conversations policies
CREATE POLICY "Users can view own conversations"
    ON conversations FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own conversations"
    ON conversations FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own conversations"
    ON conversations FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
    ON conversations FOR DELETE
    USING (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Users can view own messages"
    ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND (conversations.user_id = auth.uid() OR conversations.user_id IS NULL)
        )
    );

CREATE POLICY "Users can insert own messages"
    ON messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND (conversations.user_id = auth.uid() OR conversations.user_id IS NULL)
        )
    );

-- Usage policies
CREATE POLICY "Users can view own usage"
    ON usage FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
    ON usage FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
    ON usage FOR UPDATE
    USING (auth.uid() = user_id);

-- Guest sessions policies (public for guest mode)
CREATE POLICY "Anyone can create guest session"
    ON guest_sessions FOR INSERT
    WITH CHECK (TRUE);

CREATE POLICY "Anyone can view own guest session"
    ON guest_sessions FOR SELECT
    USING (session_id = current_setting('app.session_id', TRUE));

CREATE POLICY "Anyone can update own guest session"
    ON guest_sessions FOR UPDATE
    USING (session_id = current_setting('app.session_id', TRUE));

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert a default admin user (optional, for testing)
-- INSERT INTO users (id, email, name, avatar, tier)
-- VALUES (
--     '00000000-0000-0000-0000-000000000001',
--     'admin@karai.dev',
--     'Admin',
--     'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
--     'admin'
-- );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE users IS 'Stores user profile information';
COMMENT ON TABLE conversations IS 'Stores conversation metadata';
COMMENT ON TABLE messages IS 'Stores individual messages in conversations';
COMMENT ON TABLE usage IS 'Tracks daily API usage per user';
COMMENT ON TABLE guest_sessions IS 'Tracks guest user sessions and limits';

COMMENT ON COLUMN conversations.mode IS 'Chat mode: chat, voice, or coding';
COMMENT ON COLUMN messages.role IS 'Message role: user, assistant, or system';
COMMENT ON COLUMN messages.image_url IS 'Optional image URL for vision analysis';
COMMENT ON COLUMN usage.message_count IS 'Number of messages sent today';
COMMENT ON COLUMN guest_sessions.daily_limit IS 'Daily message limit for guest (default 50)';
