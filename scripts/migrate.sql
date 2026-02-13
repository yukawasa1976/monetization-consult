-- sessions: チャットor評価の1セッション
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip VARCHAR(45),
  user_agent TEXT,
  mode VARCHAR(10) NOT NULL,  -- 'chat' | 'evaluate'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- messages: 個別メッセージ
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL,  -- 'user' | 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- evaluations: 評価スコア（集計用に分離）
CREATE TABLE IF NOT EXISTS evaluations (
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
);

-- insights: 自動分析結果（Phase 3で使用）
CREATE TABLE IF NOT EXISTS insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  analysis TEXT NOT NULL,           -- Claude分析レポート全文
  faq_additions TEXT,               -- 自動生成FAQ（プロンプトに注入）
  prompt_suggestions TEXT,          -- プロンプト改善提案
  knowledge_gaps TEXT,              -- ナレッジベースの不足領域
  auto_applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_score ON evaluations(score_total);
CREATE INDEX IF NOT EXISTS idx_insights_week ON insights(week_start);
