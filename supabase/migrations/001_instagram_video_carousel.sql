-- =====================================================
-- Instagram + 動画 + カルーセル + サイクル対応
-- 適用先: 既存の本番DB（schema.sql 適用済み環境）
-- 実行日: 2026-04-01
-- =====================================================

-- 1. posts: 動画URL + カルーセルメディアURLs
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.posts.video_url IS '動画付き投稿用URL（Threads VIDEO / Instagram Reels）';
COMMENT ON COLUMN public.posts.media_urls IS 'カルーセル用メディアURL配列 [{ url, type }]';

-- 2. schedule_configs: Instagram投稿サイクル設定
ALTER TABLE public.schedule_configs
  ADD COLUMN IF NOT EXISTS ig_cycle JSONB DEFAULT NULL;

COMMENT ON COLUMN public.schedule_configs.ig_cycle IS 'Instagram投稿サイクル { enabled: bool, intervalDays: number }';

-- 3. api_keys: instagram プロバイダー追加
ALTER TABLE public.api_keys
  DROP CONSTRAINT IF EXISTS api_keys_provider_check;
ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_provider_check
  CHECK (provider IN ('anthropic', 'openai', 'google', 'x', 'threads', 'instagram'));

-- 4. profiles: sns_provider に instagram 追加
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_sns_provider_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_sns_provider_check
  CHECK (sns_provider IN ('x', 'threads', 'instagram'));

-- 5. posts: status に posting/sending 追加（既に適用済みの場合はスキップ）
-- ※ CHECK制約名が環境によって異なる可能性があるため、既存を削除して再作成
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_status_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_status_check
  CHECK (status IN ('draft', 'scheduled', 'posted', 'failed', 'pending_approval', 'posting', 'sending'));
