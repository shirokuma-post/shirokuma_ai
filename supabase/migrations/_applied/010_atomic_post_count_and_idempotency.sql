-- =====================================================
-- 010: Atomic daily post count + Stripe idempotency
-- =====================================================

-- 1. Atomic increment function for daily_post_count
-- Returns true if increment succeeded (within limit), false if limit reached
CREATE OR REPLACE FUNCTION public.increment_daily_post_count(
  p_user_id UUID,
  p_plan_limit INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today TEXT := to_char(now() AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD');
  v_current_count INT;
BEGIN
  -- Reset if new day, then increment atomically
  UPDATE public.profiles
  SET
    daily_post_count = CASE
      WHEN daily_reset_at != v_today THEN 1  -- New day: reset to 1
      ELSE daily_post_count + 1               -- Same day: increment
    END,
    daily_reset_at = v_today
  WHERE id = p_user_id
    AND (
      p_plan_limit = -1  -- Business: unlimited
      OR daily_reset_at != v_today  -- New day: always allow (resetting)
      OR daily_post_count < p_plan_limit  -- Within limit
    )
  RETURNING daily_post_count INTO v_current_count;

  RETURN v_current_count IS NOT NULL;
END;
$$;

-- 2. Reset daily count (used at post time if day changed)
CREATE OR REPLACE FUNCTION public.reset_daily_count_if_needed(
  p_user_id UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today TEXT := to_char(now() AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD');
  v_count INT;
BEGIN
  UPDATE public.profiles
  SET
    daily_post_count = CASE WHEN daily_reset_at != v_today THEN 0 ELSE daily_post_count END,
    daily_reset_at = v_today
  WHERE id = p_user_id
  RETURNING daily_post_count INTO v_count;

  RETURN COALESCE(v_count, 0);
END;
$$;

-- 3. Stripe webhook idempotency table
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-cleanup old events (keep 7 days)
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed_at
  ON public.stripe_webhook_events (processed_at);

-- 4. Add index on profiles.stripe_customer_id for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON public.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
