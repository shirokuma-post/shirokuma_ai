-- =====================================================
-- SHIROKUMA Post - Initial Schema
-- Supabase (PostgreSQL)
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. Profiles
-- =====================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 2. API Keys (BYOK - encrypted storage)
-- =====================================================

CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL
    CHECK (provider IN ('anthropic', 'openai', 'google', 'x', 'threads')),
  key_name TEXT NOT NULL,
  -- Store encrypted; decrypt in app layer
  encrypted_value TEXT NOT NULL,
  metadata JSONB,
  is_valid BOOLEAN NOT NULL DEFAULT TRUE,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user ON public.api_keys(user_id, provider);
-- One key per provider per user
CREATE UNIQUE INDEX idx_api_keys_unique ON public.api_keys(user_id, provider, key_name);

-- =====================================================
-- 3. Philosophies (uploaded thought documents)
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
-- 4. Post Configs (generation settings)
-- =====================================================

CREATE TABLE public.post_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  philosophy_id UUID NOT NULL REFERENCES public.philosophies(id) ON DELETE CASCADE,
  ai_provider TEXT NOT NULL DEFAULT 'anthropic'
    CHECK (ai_provider IN ('anthropic', 'openai', 'google')),
  sns_targets TEXT[] NOT NULL DEFAULT ARRAY['x'],
  post_style TEXT NOT NULL DEFAULT 'mix'
    CHECK (post_style IN ('paradigm_break', 'provocative', 'flip', 'poison_story', 'mix')),
  schedule_times TEXT[] NOT NULL DEFAULT ARRAY['07:00', '12:30', '21:00'],
  timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo',
  banned_words TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  custom_prompt TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_post_configs_user ON public.post_configs(user_id);

-- =====================================================
-- 5. Posts (generated & posted content)
-- =====================================================

CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  config_id UUID REFERENCES public.post_configs(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  style_used TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'posted', 'failed')),
  scheduled_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  sns_post_ids JSONB,
  error_message TEXT,
  ai_model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_posts_user ON public.posts(user_id, created_at DESC);
CREATE INDEX idx_posts_status ON public.posts(status, scheduled_at);

-- =====================================================
-- 6. RLS Policies
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.philosophies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile"
  ON public.profiles FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users manage own api_keys"
  ON public.api_keys FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own philosophies"
  ON public.philosophies FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own post_configs"
  ON public.post_configs FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own posts"
  ON public.posts FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- 7. Auto-update trigger
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

CREATE TRIGGER tr_post_configs_updated
  BEFORE UPDATE ON public.post_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 8. Auto-create profile on signup
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
