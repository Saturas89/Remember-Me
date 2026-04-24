-- Fix infinite recursion between shares and share_recipients RLS policies.
--
-- Root cause: share-select-recipient queries share_recipients, whose
-- recipient-select-self-or-owner policy queries back to shares → cycle.
--
-- Fix: introduce two SECURITY DEFINER helpers that bypass RLS on the target
-- table, returning only a boolean about auth.uid(). No data is exposed.

-- ── Helpers ──────────────────────────────────────────────────────────────────

create or replace function public.is_share_owner(p_share_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.shares
    where id = p_share_id and owner_id = auth.uid()
  )
$$;

create or replace function public.is_share_recipient(p_share_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.share_recipients
    where share_id = p_share_id and recipient_id = auth.uid()
  )
$$;

-- ── Recreate share_recipients policies ───────────────────────────────────────
-- Use is_share_owner() so no back-join to shares is needed.

drop policy if exists "recipient-select-self-or-owner" on public.share_recipients;
drop policy if exists "recipient-write-owner"          on public.share_recipients;
drop policy if exists "recipient-delete-owner"         on public.share_recipients;

create policy "recipient-select-self-or-owner" on public.share_recipients
  for select using (
    recipient_id = auth.uid()
    or public.is_share_owner(share_id)
  );

create policy "recipient-write-owner" on public.share_recipients
  for insert with check (public.is_share_owner(share_id));

create policy "recipient-delete-owner" on public.share_recipients
  for delete using (public.is_share_owner(share_id));

-- ── Recreate shares recipient-select policy ───────────────────────────────────
-- Use is_share_recipient() so no back-join to share_recipients inside a
-- share-RLS context is needed.

drop policy if exists "share-select-recipient" on public.shares;

create policy "share-select-recipient" on public.shares
  for select using (public.is_share_recipient(id));
