-- 動画投稿対応
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS video_url text;
