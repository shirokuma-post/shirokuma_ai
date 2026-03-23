-- =====================================================
-- SHIROKUMA Post - 統合スキーマ（現在の正）
-- 新規環境構築時はこれ1つを実行すればOK
-- 最終更新: 2026-03-23
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. Profiles（ユーザー情報 + プラン + Stripe）
-- =====================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'pro', 'business')),
  daily_post_count INT NOT NULL DEFAULT 0,
  daily_reset_at DATE NOT NULL DEFAULT CURRENT_DATE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_subscription_status TEXT DEFAULT 'none',
  sns_provider TEXT CHECK (sns_provider IN ('x', 'threads')),
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  style_defaults JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 2. API Keys（BYOK - 暗号化保存）
-- =====================================================
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL
    CHECK (provider IN ('anthropic', 'openai', 'google', 'x', 'threads')),
  key_name TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  metadata JSONB,
  is_valid BOOLEAN NOT NULL DEFAULT TRUE,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user ON public.api_keys(user_id, provider);
CREATE UNIQUE INDEX idx_api_keys_unique ON public.api_keys(user_id, provider, key_name);

-- =====================================================
-- 3. Philosophies（思想・理論テキスト + 構造化サマリー）
--    summary: JSON文字列（StructuredSummary）or プレーンテキスト
--    core_concepts: レガシー（構造化サマリー移行前の概念リスト）
-- =====================================================
CREATE TABLE public.philosophies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  core_concepts JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_philosophies_user ON public.philosophies(user_id);
CREATE UNIQUE INDEX idx_philosophies_active
  ON public.philosophies(user_id) WHERE is_active = TRUE;

-- =====================================================
-- 4. Posts（生成・投稿された内容）
-- =====================================================
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  style_used TEXT,                -- nullable: 手動投稿では未設定の場合あり
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'posted', 'failed', 'pending_approval')),
  scheduled_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  sns_post_ids JSONB,             -- { "x": {...}, "threads": {...} }
  error_message TEXT,
  ai_model_used TEXT,             -- "anthropic" | "openai" | "google"
  sns_target TEXT DEFAULT 'x',    -- "x" | "threads"
  auto_post BOOLEAN NOT NULL DEFAULT true,
  slot_index INTEGER,             -- スロット番号（0-indexed）
  slot_config JSONB,              -- 生成時のスロット設定を保持
  image_url TEXT,                 -- 画像付き投稿用（Supabase Storage公開URL）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_posts_user ON public.posts(user_id, created_at DESC);
CREATE INDEX idx_posts_status ON public.posts(status, scheduled_at);
CREATE INDEX idx_posts_draft_scheduled
  ON public.posts(user_id, status, scheduled_at) WHERE status = 'draft';

-- =====================================================
-- 5. Schedule Configs（スロットベース自動投稿設定）
--    slots: JSONB配列
--    [{ time, target, style, character, length, split }]
-- =====================================================
CREATE TABLE public.schedule_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  require_approval BOOLEAN NOT NULL DEFAULT false,
  trend_enabled BOOLEAN NOT NULL DEFAULT false,
  trend_categories JSONB NOT NULL DEFAULT '["general", "technology", "business"]'::jsonb,
  slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_schedule_configs_enabled
  ON public.schedule_configs(enabled) WHERE enabled = true;

-- =====================================================
-- 6. Schedule Executions（実行ログ）
-- =====================================================
CREATE TABLE public.schedule_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_time TEXT NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'failed', 'skipped')),
  post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  sns_results JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schedule_executions_user
  ON public.schedule_executions(user_id, created_at DESC);

-- =====================================================
-- 7. Learning Posts（伸びた投稿の学習データ）
-- =====================================================
CREATE TABLE public.learning_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  platform TEXT DEFAULT 'x',
  metrics JSONB DEFAULT '{}',
  ai_analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_learning_posts_user
  ON public.learning_posts(user_id, created_at DESC);

-- =====================================================
-- 8. Daily Trends（RSSトレンドキャッシュ）
-- =====================================================
CREATE TABLE public.daily_trends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  summary TEXT,
  source_url TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_daily_trends_fetched
  ON public.daily_trends(fetched_at DESC);

-- =====================================================
-- 9. RLS Policies
-- =====================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.philosophies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_trends ENABLE ROW LEVEL SECURITY;

-- ユーザー自身のデータのみ操作可能
CREATE POLICY "Users manage own profile"
  ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users manage own api_keys"
  ON public.api_keys FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own philosophies"
  ON public.philosophies FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own posts"
  ON public.posts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own schedule"
  ON public.schedule_configs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users view own executions"
  ON public.schedule_executions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own learning posts"
  ON public.learning_posts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read trends"
  ON public.daily_trends FOR SELECT USING (true);

-- service_role用（cronハンドラー）
CREATE POLICY "Service can read all schedules"
  ON public.schedule_configs FOR SELECT USING (true);
CREATE POLICY "Service can insert executions"
  ON public.schedule_executions FOR INSERT WITH CHECK (true);

-- =====================================================
-- 9. Triggers
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_api_keys_updated
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_philosophies_updated
  BEFORE UPDATE ON public.philosophies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_schedule_configs_updated
  BEFORE UPDATE ON public.schedule_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 10. Auto-create profile on signup
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
