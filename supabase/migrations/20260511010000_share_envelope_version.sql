-- H2: add `version` columns to `shares` and `annotations`.
--
-- The envelope format is bumped from 1 → 2 so AES-GCM can bind the
-- ciphertext to its (sender, row-id) tuple via additional authenticated
-- data. Existing rows are implicitly v1 (default = 1) and continue to
-- decrypt correctly under the legacy code path. New writes from the
-- updated client set version = 2 and include the AAD binding.
--
-- The column is intentionally a small int, not a check constraint — so
-- a future v3 bump (e.g. for ECDSA signatures) doesn't need another
-- migration.

alter table public.shares
  add column if not exists version smallint not null default 1;

alter table public.annotations
  add column if not exists version smallint not null default 1;
