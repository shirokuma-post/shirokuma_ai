-- ============================================================
-- 014: Supabase Security Advisor 指摘事項の一括修正
-- ============================================================

-- ========== 1. stripe_webhook_events: RLS有効化 ==========
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- サービスロールのみ読み書き可（Webhook処理はサーバーサイドのみ）
CREATE POLICY "Service role full access on stripe_webhook_events"
  ON public.stripe_webhook_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ========== 2. schedule_executions: 過剰なINSERTポリシー修正 ==========
-- 既存の「WITH CHECK (true)」ポリシーを削除して、サービスロール限定に
DROP POLICY IF EXISTS "Service can insert executions" ON public.schedule_executions;
CREATE POLICY "Service can insert executions"
  ON public.schedule_executions
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ========== 3. gpts_link_codes: 過剰なUPDATEポリシー修正 ==========
DROP POLICY IF EXISTS "Service can update link codes" ON public.gpts_link_codes;
CREATE POLICY "Service can update link codes"
  ON public.gpts_link_codes
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ========== 4. Functions: search_path を固定 ==========
-- search_path未設定は search_path injection 攻撃のリスクがある

ALTER FUNCTION public.update_posts_updated_at()
  SET search_path = public;

ALTER FUNCTION public.handle_new_user()
  SET search_path = public;

ALTER FUNCTION public.update_updated_at()
  SET search_path = public;

ALTER FUNCTION public.reset_daily_count_if_needed(uuid)
  SET search_path = public;

ALTER FUNCTION public.increment_daily_post_count(uuid, integer)
  SET search_path = public;
