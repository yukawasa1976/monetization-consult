-- v5: 投資リード評価（認知コストゼロ設計の証明スクリーニング）

CREATE TABLE IF NOT EXISTS investment_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  x_account VARCHAR(255),
  answers JSONB NOT NULL,
  score SMALLINT NOT NULL,
  level VARCHAR(20) NOT NULL CHECK (level IN ('NG', 'HOLD', 'GO', 'PRIORITY')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investment_leads_level ON investment_leads(level);
CREATE INDEX IF NOT EXISTS idx_investment_leads_score ON investment_leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_investment_leads_user ON investment_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_investment_leads_created ON investment_leads(created_at DESC);
