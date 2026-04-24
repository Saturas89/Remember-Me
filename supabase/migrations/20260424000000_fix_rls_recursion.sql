-- Fix infinite recursion between shares ↔ share_recipients RLS policies.
--
-- Root cause: any policy that joins shares → share_recipients → shares creates
-- a cycle that PostgreSQL detects and aborts with "infinite recursion detected
-- in policy for relation". This affects shares, share_recipients, annotations,
-- share_media and storage.objects.
--
-- Fix: two SECURITY DEFINER helpers that bypass RLS on the target table,
-- returning only a boolean about auth.uid(). No row data is ever returned.

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

-- Restrict direct invocation to authenticated users only.
revoke execute on function public.is_share_owner(uuid)      from public;
revoke execute on function public.is_share_recipient(uuid)  from public;
grant  execute on function public.is_share_owner(uuid)      to authenticated;
grant  execute on function public.is_share_recipient(uuid)  to authenticated;

-- ── share_recipients policies ─────────────────────────────────────────────────

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

-- ── shares: recipient-select policy ──────────────────────────────────────────

drop policy if exists "share-select-recipient" on public.shares;

create policy "share-select-recipient" on public.shares
  for select using (public.is_share_recipient(id));

-- ── annotations policies ──────────────────────────────────────────────────────
-- annotation-select-audience and annotation-insert-audience previously joined
-- shares → share_recipients → back to shares, causing the same cycle.

drop policy if exists "annotation-select-audience" on public.annotations;
drop policy if exists "annotation-insert-audience" on public.annotations;

create policy "annotation-select-audience" on public.annotations
  for select using (
    public.is_share_owner(share_id)
    or public.is_share_recipient(share_id)
  );

create policy "annotation-insert-audience" on public.annotations
  for insert with check (
    author_id = auth.uid()
    and (
      public.is_share_owner(share_id)
      or public.is_share_recipient(share_id)
    )
  );

-- ── share_media policies ──────────────────────────────────────────────────────
-- media-select-audience had the same cross-join pattern.

drop policy if exists "media-select-audience" on public.share_media;
drop policy if exists "media-write-owner"     on public.share_media;
drop policy if exists "media-delete-owner"    on public.share_media;

create policy "media-select-audience" on public.share_media
  for select using (
    public.is_share_owner(share_id)
    or public.is_share_recipient(share_id)
  );

create policy "media-write-owner" on public.share_media
  for insert with check (public.is_share_owner(share_id));

create policy "media-delete-owner" on public.share_media
  for delete using (public.is_share_owner(share_id));

-- ── storage.objects policies ──────────────────────────────────────────────────
-- Same cross-join pattern via the share_id path prefix.

drop policy if exists "storage-share-media-read"   on storage.objects;
drop policy if exists "storage-share-media-write"  on storage.objects;
drop policy if exists "storage-share-media-delete" on storage.objects;

create policy "storage-share-media-read" on storage.objects
  for select using (
    bucket_id = 'share-media'
    and (
      public.is_share_owner((regexp_split_to_array(name, '/'))[1]::uuid)
      or public.is_share_recipient((regexp_split_to_array(name, '/'))[1]::uuid)
    )
  );

create policy "storage-share-media-write" on storage.objects
  for insert with check (
    bucket_id = 'share-media'
    and public.is_share_owner((regexp_split_to_array(name, '/'))[1]::uuid)
  );

create policy "storage-share-media-delete" on storage.objects
  for delete using (
    bucket_id = 'share-media'
    and public.is_share_owner((regexp_split_to_array(name, '/'))[1]::uuid)
  );
