-- 004: トレンドカテゴリ選択機能
-- schedule_configs に trend_categories カラムを追加
ALTER TABLE public.schedule_configs
  ADD COLUMN IF NOT EXISTS trend_categories JSONB NOT NULL DEFAULT '["general", "technology", "business"]'::jsonb;
