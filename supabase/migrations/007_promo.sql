-- プロモーション: 3ヶ月Business無料
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS promo_type TEXT,
  ADD COLUMN IF NOT EXISTS promo_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promo_notified_7d BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_notified_0d BOOLEAN NOT NULL DEFAULT false;
