-- =====================================================
-- 003: バッチ生成 + SNSプロバイダー選択
-- 適用元: 002_fix_inconsistencies.sql 適用済み環境
-- 最終更新: 2026-03-23
-- =====================================================

-- ===== posts テーブルに一括生成用カラム追加 =====
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS sns_target TEXT DEFAULT 'x';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS auto_post BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS slot_index INTEGER;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS slot_config JSONB;

CREATE INDEX IF NOT EXISTS idx_posts_draft_scheduled
  ON public.posts(user_id, status, scheduled_at) WHERE status = 'draft';

-- ===== profiles テーブルにSNS選択 + オンボーディング追加 =====
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sns_provider TEXT
    CHECK (sns_provider IN ('x', 'threads'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.sns_provider IS 'Free/Pro: 選択した1つのSNS（ロック）。Business: NULLでも両方使える';
COMMENT ON COLUMN public.profiles.onboarding_completed IS '初回SNS選択が完了したか';
