-- posts テーブルに "posting" と "sending" ステータスを追加
-- アトミッククレーム（重複投稿防止）で使用
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_status_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_status_check
  CHECK (status IN ('draft', 'scheduled', 'posted', 'failed', 'pending_approval', 'posting', 'sending'));

-- updated_at カラム追加（スタック復旧で使用）
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 既存レコードの updated_at を created_at で初期化
UPDATE public.posts SET updated_at = created_at WHERE updated_at = NOW();

-- 自動更新トリガー
CREATE OR REPLACE FUNCTION update_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_posts_updated_at ON public.posts;
CREATE TRIGGER set_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION update_posts_updated_at();
