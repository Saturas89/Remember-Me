-- ── Invite codes for short Sandra-invite links ──────────────────────────────
--
-- Each Sandra invite stores the question pack + contact handshake under a
-- short human-readable code (6 chars, no confusable letters/digits).
-- After Ingrid accepts, she writes her own contact back into `response`.
-- Sandra's app polls `response` and auto-adds Ingrid as a friend.

CREATE TABLE public.invites (
  code        TEXT PRIMARY KEY,
  payload     JSONB NOT NULL,
  response    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days')
);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "create_invite" ON public.invites
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "read_invite" ON public.invites
  FOR SELECT
  TO authenticated
  USING (expires_at > now());

-- Ingrid writes her contact exactly once on an unexpired, still-open invite.
CREATE POLICY "respond_invite" ON public.invites
  FOR UPDATE
  TO authenticated
  USING (expires_at > now() AND response IS NULL)
  WITH CHECK (response IS NOT NULL);
