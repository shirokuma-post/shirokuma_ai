-- =====================================================
-- Batch Generation: posts テーブル拡張
-- 一括生成 → ドラフト → スロット別投稿の仕組み
-- =====================================================

-- 1. posts テーブルに新カラム追加
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS sns_target TEXT DEFAULT 'x';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS auto_post BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS slot_index INTEGER;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS slot_config JSONB;

-- 2. ドラフト検索用インデックス
CREATE INDEX IF NOT EXISTS idx_posts_draft_scheduled
  ON public.posts(user_id, status, scheduled_at) WHERE status = 'draft';

-- 3. schedule_configs に batch_enabled カラム（既存 enabled と分離）
-- enabled = 自動投稿ON/OFF（スロット時刻に draft を投稿するか）
-- batch_generate = 深夜一括生成ON/OFF
-- ※ 今回は enabled を「一括生成+自動投稿」の統合トグルとして使う
