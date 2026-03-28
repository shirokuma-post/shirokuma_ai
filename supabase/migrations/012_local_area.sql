-- schedule_configs にローカルエリア（地域）カラムを追加
ALTER TABLE schedule_configs
  ADD COLUMN IF NOT EXISTS local_area TEXT DEFAULT NULL;

COMMENT ON COLUMN schedule_configs.local_area IS 'ユーザーの地域設定（例: 横浜）— 地域トレンドRSS取得に使用';

-- daily_trends の category に "local" を想定（既存のTEXTカラムなので変更不要）
-- local_area ごとにトレンドを分離するための user_id カラムを追加
ALTER TABLE daily_trends
  ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT NULL REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_daily_trends_user_local
  ON daily_trends (user_id, category)
  WHERE category = 'local';
