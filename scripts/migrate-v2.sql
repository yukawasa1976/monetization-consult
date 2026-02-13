-- v2: ユーザー認証 + セッション紐付け + insights強化

-- Auth.js用ユーザーテーブル
CREATE TABLE IF NOT EXISTS auth_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  "emailVerified" TIMESTAMPTZ,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auth.js用アカウントテーブル（OAuth連携）
CREATE TABLE IF NOT EXISTS auth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  type VARCHAR(255) NOT NULL,
  provider VARCHAR(255) NOT NULL,
  "providerAccountId" VARCHAR(255) NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT
);

-- 既存テーブルにuser_id追加
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL;

-- insights強化用
ALTER TABLE insights ADD COLUMN IF NOT EXISTS user_stats JSONB;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_accounts_user ON auth_accounts("userId");
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
