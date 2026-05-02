-- Private sync state table (E2E encrypted via AES-256-GCM, recovery-code key derivation)
-- Only text data is stored here; media files are stored in the user's own cloud provider.

CREATE TABLE IF NOT EXISTS private_sync_state (
  user_id    uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  state_ct   text NOT NULL,
  state_iv   text NOT NULL,
  encryption text NOT NULL DEFAULT 'recovery-code'
               CHECK (encryption = 'recovery-code'),
  version    bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE private_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own rows only"
  ON private_sync_state
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
