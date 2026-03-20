-- =====================================================
-- 002: DB不整合の修正
-- 既存のデータを壊さずに、コード側の実態に合わせる
-- =====================================================

-- -------------------------------------------------------
-- 1. posts.style_used を nullable に
--    手動投稿では style_used が渡されないケースがある
-- -------------------------------------------------------
ALTER TABLE public.posts ALTER COLUMN style_used DROP NOT NULL;

-- -------------------------------------------------------
-- 2. schedule_configs の旧カラムを削除
--    slots JSONB に移行済み。旧カラムはコードから参照なし
-- -------------------------------------------------------
ALTER TABLE public.schedule_configs DROP COLUMN IF EXISTS times;
ALTER TABLE public.schedule_configs DROP COLUMN IF EXISTS sns_targets;
ALTER TABLE public.schedule_configs DROP COLUMN IF EXISTS style;
ALTER TABLE public.schedule_configs DROP COLUMN IF EXISTS post_length;
ALTER TABLE public.schedule_configs DROP COLUMN IF EXISTS split_mode;
ALTER TABLE public.schedule_configs DROP COLUMN IF EXISTS character_type;

-- -------------------------------------------------------
-- 3. post_configs テーブルを削除
--    スロットベースの schedule_configs に完全移行済み
--    コード上の参照ゼロ。posts.config_id の FK だけ残す
-- -------------------------------------------------------
-- まず posts.config_id の外部キー制約を外す
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_config_id_fkey;
-- テーブル削除
DROP TABLE IF EXISTS public.post_configs;

-- -------------------------------------------------------
-- 4. slots カラムのデフォルトを確実に設定
-- -------------------------------------------------------
ALTER TABLE public.schedule_configs
  ALTER COLUMN slots SET DEFAULT '[]'::jsonb;
