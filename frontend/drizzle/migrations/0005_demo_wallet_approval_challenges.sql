-- Anonymous demo sessions use a server-verified capability secret, not an auth user.
-- No permanent wallet/user association; clients cannot read or write challenges.
CREATE TABLE public.demo_wallet_approval_challenges (
  id uuid PRIMARY KEY,
  demo_session_id uuid NOT NULL REFERENCES public.demo_sessions(id) ON DELETE CASCADE,
  wallet_address text NOT NULL CHECK (length(wallet_address) BETWEEN 32 AND 44),
  nonce text NOT NULL UNIQUE CHECK (length(nonce) = 64),
  challenge jsonb NOT NULL CHECK (octet_length(challenge::text) <= 12000),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CHECK (expires_at > created_at - interval '1 minute'),
  CHECK (challenge->>'network' = 'solana:devnet'),
  CHECK (challenge->>'walletAddress' = wallet_address),
  CHECK (challenge->>'nonce' = nonce),
  CHECK ((challenge->>'sessionId')::uuid = demo_session_id),
  CHECK ((challenge->>'id')::uuid = id)
);
ALTER TABLE public.demo_wallet_approval_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.demo_wallet_approval_challenges FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_wallet_approval_challenges TO service_role;
CREATE INDEX demo_wallet_approval_session_idx ON public.demo_wallet_approval_challenges(demo_session_id);
CREATE INDEX demo_wallet_approval_expiry_idx ON public.demo_wallet_approval_challenges(expires_at);

-- UPDATE obtains a row lock and rechecks the predicate after concurrent updates.
-- Database time also rejects challenges expiring during signature verification.
CREATE FUNCTION public.consume_demo_wallet_approval(challenge_id uuid, session_id uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  WITH consumed AS (
    UPDATE public.demo_wallet_approval_challenges
    SET consumed_at = clock_timestamp()
    WHERE id = challenge_id AND demo_session_id = session_id
      AND consumed_at IS NULL AND expires_at > clock_timestamp()
    RETURNING id
  ) SELECT EXISTS (SELECT 1 FROM consumed);
$$;
REVOKE ALL ON FUNCTION public.consume_demo_wallet_approval(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_demo_wallet_approval(uuid, uuid) TO service_role;
