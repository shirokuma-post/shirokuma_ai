-- 005: 画像投稿対応
-- posts に image_url カラムを追加
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Supabase Storage: post-images バケット作成（手動でダッシュボードから作成推奨）
-- INSERT INTO storage.buckets (id, name, public) VALUES ('post-images', 'post-images', true)
-- ON CONFLICT DO NOTHING;
