import { readFileSync } from 'fs';
import { createPool } from '@vercel/postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

const pool = createPool({ connectionString: process.env.POSTGRES_URL });

// Run each CREATE statement separately
const statements = [
  `CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip VARCHAR(45),
    user_agent TEXT,
    mode VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    plan_text TEXT,
    score_total SMALLINT,
    score_product SMALLINT,
    score_pricing SMALLINT,
    score_sales SMALLINT,
    score_scale SMALLINT,
    score_finance SMALLINT,
    full_response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_start DATE NOT NULL,
    analysis TEXT NOT NULL,
    faq_additions TEXT,
    prompt_suggestions TEXT,
    knowledge_gaps TEXT,
    auto_applied BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_evaluations_score ON evaluations(score_total)`,
  `CREATE INDEX IF NOT EXISTS idx_insights_week ON insights(week_start)`,
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
console.log('\nMigration complete.');
