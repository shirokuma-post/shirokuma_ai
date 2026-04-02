-- =====================================================
-- 009: posts.status に pending_approval, posting を追加
-- pending_approval: 承認ワークフロー用
-- posting: cron重複投稿防止のための中間ステータス
-- =====================================================

-- 既存のCHECK制約を削除して再作成
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_status_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_status_check
  CHECK (status IN ('draft', 'scheduled', 'posted', 'failed', 'pending_approval', 'posting'));
