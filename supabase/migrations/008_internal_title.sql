-- 投稿の内部タイトル（反復防止に使用、ユーザーには非表示）
ALTER TABLE posts ADD COLUMN IF NOT EXISTS internal_title TEXT;

-- コメント
COMMENT ON COLUMN posts.internal_title IS 'AI生成時の内部トピックタイトル（反復防止用）';
