CREATE TABLE public.early_access_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  whatsapp text NOT NULL CHECK (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  email text NOT NULL CHECK (char_length(email) <= 254),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT early_access_signups_email_unique UNIQUE (email),
  CONSTRAINT early_access_signups_whatsapp_unique UNIQUE (whatsapp)
);

GRANT ALL ON public.early_access_signups TO service_role;

ALTER TABLE public.early_access_signups ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.early_access_signups IS 'Private early access registrations submitted through the public VicTy landing page.';
COMMENT ON COLUMN public.early_access_signups.whatsapp IS 'Normalized E.164 phone number.';