import { createPool } from '@vercel/postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

const pool = createPool({ connectionString: process.env.POSTGRES_URL });

const statements = [
  `CREATE TABLE IF NOT EXISTS auth_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    "emailVerified" TIMESTAMPTZ,
    image TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS auth_accounts (
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
  )`,
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL`,
  `ALTER TABLE insights ADD COLUMN IF NOT EXISTS user_stats JSONB`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_auth_accounts_user ON auth_accounts("userId")`,
  `CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email)`,
];

for (const stmt of statements) {
  try {
    await pool.query(stmt);
    console.log('OK:', stmt.split('\n')[0].trim().slice(0, 70));
  } catch (err) {
    console.error('ERR:', stmt.split('\n')[0].trim().slice(0, 70), '-', err.message);
  }
}

await pool.end();
console.log('\nMigration v2 complete.');
