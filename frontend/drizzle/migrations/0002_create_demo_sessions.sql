CREATE TABLE public.demo_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_hash text NOT NULL,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT demo_sessions_secret_hash_length CHECK (char_length(secret_hash) = 64),
  CONSTRAINT demo_sessions_state_size CHECK (octet_length(state::text) <= 100000)
);

GRANT ALL ON public.demo_sessions TO service_role;

ALTER TABLE public.demo_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public reads of demo sessions"
ON public.demo_sessions FOR SELECT TO anon, authenticated USING (false);

CREATE POLICY "No public inserts of demo sessions"
ON public.demo_sessions FOR INSERT TO anon, authenticated WITH CHECK (false);

CREATE POLICY "No public updates of demo sessions"
ON public.demo_sessions FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "No public deletes of demo sessions"
ON public.demo_sessions FOR DELETE TO anon, authenticated USING (false);

CREATE INDEX demo_sessions_updated_at_idx ON public.demo_sessions (updated_at DESC);