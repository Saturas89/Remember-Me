-- H7: harden the recovery-code PBKDF2 derivation.
--
-- The pre-H7 client derived the vault key with `salt = userId UTF-8` and
-- `iterations = 200_000`. OWASP 2023 recommends ≥ 600_000 for PBKDF2-SHA256,
-- and a random per-user salt prevents pre-computed rainbow-table lookups
-- (even though the recovery code is itself 24 chars of Base62 → ~143 bits
-- of entropy, defense-in-depth still applies if the code is leaked by a
-- side channel or quoted in a public place).
--
-- This migration adds the `salt` column. NULL means "legacy v2 row" — the
-- client falls back to the old `salt = userId, 200_000 iter` params on
-- decrypt. Once a row is re-pushed by an updated client, the salt is
-- populated with a random 16-byte value (base64url-encoded) and reads
-- thereafter use the new params.

alter table public.private_sync_state
  add column if not exists salt text;
