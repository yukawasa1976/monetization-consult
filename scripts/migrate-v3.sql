-- v3: フィードバック機能

CREATE TABLE IF NOT EXISTS feedbacks (
  id SERIAL PRIMARY KEY,
  category VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON feedbacks(created_at DESC);
