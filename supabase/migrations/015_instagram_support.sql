-- Instagram対応: CHECK制約の更新

-- api_keys.provider に 'instagram' を追加
ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_provider_check;
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_provider_check
  CHECK (provider IN ('anthropic', 'openai', 'google', 'x', 'threads', 'instagram'));

-- profiles.sns_provider に 'instagram' を追加
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_sns_provider_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_sns_provider_check
  CHECK (sns_provider IN ('x', 'threads', 'instagram'));
