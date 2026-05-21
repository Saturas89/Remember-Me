-- Adds answer_id to shares for cross-device auto-share deduplication.
--
-- The auto-share queue (useAutoShare) uses a local IndexedDB share-log to
-- skip (answer, friend) pairs already sent. On a new device the log is empty,
-- causing all answers to be re-sent to all shareAll contacts. Storing the
-- answer_id in plaintext lets the client query its own shares on bootstrap
-- and repopulate the log without decrypting any ciphertext.
--
-- NULL for shares created before this migration (one-off manual shares) and
-- for the owner's self-ACL slot — only auto-share sets this column.

alter table public.shares
  add column if not exists answer_id text;

create index if not exists shares_owner_answer_idx
  on public.shares (owner_id, answer_id)
  where answer_id is not null;
