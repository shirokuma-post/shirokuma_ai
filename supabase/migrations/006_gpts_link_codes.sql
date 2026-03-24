-- GPTs連携コードテーブル
CREATE TABLE public.gpts_link_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL CHECK (purpose IN ('api_keys', 'philosophy')),
  used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gpts_link_codes_code ON public.gpts_link_codes(code) WHERE used = false;
CREATE INDEX idx_gpts_link_codes_user ON public.gpts_link_codes(user_id);

ALTER TABLE public.gpts_link_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own link codes"
  ON public.gpts_link_codes FOR ALL USING (auth.uid() = user_id);

-- service_role用（GPTs APIから使う）
CREATE POLICY "Service can read link codes"
  ON public.gpts_link_codes FOR SELECT USING (true);
CREATE POLICY "Service can update link codes"
  ON public.gpts_link_codes FOR UPDATE USING (true);
