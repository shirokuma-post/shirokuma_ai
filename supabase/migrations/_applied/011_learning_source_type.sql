-- 011: learning_posts に source_type カラム追加（自分 vs 他者のバズ投稿）
ALTER TABLE public.learning_posts
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'own'
  CHECK (source_type IN ('own', 'others'));

-- 他者投稿にはオプションで出典情報を保存
ALTER TABLE public.learning_posts
  ADD COLUMN IF NOT EXISTS source_account TEXT DEFAULT NULL;

COMMENT ON COLUMN public.learning_posts.source_type IS 'own = 自分の投稿, others = 他者のバズ投稿（Business限定）';
COMMENT ON COLUMN public.learning_posts.source_account IS '他者投稿の場合の出典アカウント名（任意）';
