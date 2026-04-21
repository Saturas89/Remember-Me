-- Remember Me: online-sharing schema
--
-- Everything here is zero-knowledge:
--   • ciphertext/iv columns hold only AES-GCM ciphertext produced client-side
--   • encrypted_keys is a jsonb map of device-id → wrapped content-key
--   • display_name is NEVER stored on the server (owner/author names travel
--     inside the ciphertext payload)
--
-- Identity: anonymous Supabase auth. auth.uid() gives a stable UUID per
-- device. The devices row is what clients reference in ACLs.

-- ── Devices ──────────────────────────────────────────────────────────────────

create table if not exists public.devices (
  id         uuid primary key references auth.users (id) on delete cascade,
  public_key bytea not null,                       -- ECDH P-256 SPKI
  created_at timestamptz not null default now()
);

alter table public.devices enable row level security;

-- Any anonymous user can register their own device record (one per auth user).
create policy "device-insert-self" on public.devices
  for insert with check (id = auth.uid());

-- Any authenticated user can read devices (needed to fetch recipients'
-- public keys before encrypting). Public keys are not secret.
create policy "device-select-any" on public.devices
  for select using (auth.uid() is not null);

-- Users can only delete their own device (used by the "deactivate online
-- sharing" flow → cascades via FKs below).
create policy "device-delete-self" on public.devices
  for delete using (id = auth.uid());

-- ── Shares ───────────────────────────────────────────────────────────────────

create table if not exists public.shares (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.devices (id) on delete cascade,
  ciphertext     bytea not null,                  -- encrypted ShareBody JSON
  iv             bytea not null,                  -- 12 bytes
  encrypted_keys jsonb not null,                  -- { device_id: { iv, ciphertext } }
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.shares enable row level security;

-- Owner always sees their own shares.
create policy "share-select-owner" on public.shares
  for select using (owner_id = auth.uid());

-- Recipients see shares addressed to them.
create policy "share-select-recipient" on public.shares
  for select using (
    exists (
      select 1 from public.share_recipients sr
      where sr.share_id = shares.id and sr.recipient_id = auth.uid()
    )
  );

-- Only the owner writes.
create policy "share-write-owner" on public.shares
  for insert with check (owner_id = auth.uid());
create policy "share-update-owner" on public.shares
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "share-delete-owner" on public.shares
  for delete using (owner_id = auth.uid());

-- ── Share recipients (ACL) ───────────────────────────────────────────────────

create table if not exists public.share_recipients (
  share_id     uuid not null references public.shares (id) on delete cascade,
  recipient_id uuid not null references public.devices (id) on delete cascade,
  primary key (share_id, recipient_id)
);

alter table public.share_recipients enable row level security;

create policy "recipient-select-self-or-owner" on public.share_recipients
  for select using (
    recipient_id = auth.uid()
    or exists (select 1 from public.shares s where s.id = share_id and s.owner_id = auth.uid())
  );

create policy "recipient-write-owner" on public.share_recipients
  for insert with check (
    exists (select 1 from public.shares s where s.id = share_id and s.owner_id = auth.uid())
  );
create policy "recipient-delete-owner" on public.share_recipients
  for delete using (
    exists (select 1 from public.shares s where s.id = share_id and s.owner_id = auth.uid())
  );

-- ── Annotations (Ergänzungen) ───────────────────────────────────────────────

create table if not exists public.annotations (
  id             uuid primary key default gen_random_uuid(),
  share_id       uuid not null references public.shares (id) on delete cascade,
  author_id      uuid not null references public.devices (id) on delete cascade,
  ciphertext     bytea not null,
  iv             bytea not null,
  encrypted_keys jsonb not null,                  -- same audience as parent share
  created_at     timestamptz not null default now()
);

alter table public.annotations enable row level security;

-- Audience for reading an annotation = owner of parent share + all recipients
-- of parent share. Encoded as: exists relationship to the shares policy.
create policy "annotation-select-audience" on public.annotations
  for select using (
    exists (
      select 1 from public.shares s
      where s.id = annotations.share_id
        and (
          s.owner_id = auth.uid()
          or exists (
            select 1 from public.share_recipients sr
            where sr.share_id = s.id and sr.recipient_id = auth.uid()
          )
        )
    )
  );

-- Anyone who can read the parent share can write an annotation. Author must
-- be the caller.
create policy "annotation-insert-audience" on public.annotations
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.shares s
      where s.id = annotations.share_id
        and (
          s.owner_id = auth.uid()
          or exists (
            select 1 from public.share_recipients sr
            where sr.share_id = s.id and sr.recipient_id = auth.uid()
          )
        )
    )
  );

-- Authors can delete their own annotations. Owner of the parent share can
-- NOT delete other people's annotations (by design – eigene Erinnerungen
-- editiert nur der Autor selbst).
create policy "annotation-delete-author" on public.annotations
  for delete using (author_id = auth.uid());

-- ── Media (image ciphertext lives in Storage, metadata here) ────────────────

create table if not exists public.share_media (
  id           uuid primary key default gen_random_uuid(),
  share_id     uuid not null references public.shares (id) on delete cascade,
  storage_path text not null,                     -- e.g. share-media/{share_id}/{id}.bin
  iv           bytea not null,
  created_at   timestamptz not null default now()
);

alter table public.share_media enable row level security;

create policy "media-select-audience" on public.share_media
  for select using (
    exists (
      select 1 from public.shares s
      where s.id = share_media.share_id
        and (
          s.owner_id = auth.uid()
          or exists (
            select 1 from public.share_recipients sr
            where sr.share_id = s.id and sr.recipient_id = auth.uid()
          )
        )
    )
  );

create policy "media-write-owner" on public.share_media
  for insert with check (
    exists (
      select 1 from public.shares s
      where s.id = share_media.share_id and s.owner_id = auth.uid()
    )
  );

create policy "media-delete-owner" on public.share_media
  for delete using (
    exists (
      select 1 from public.shares s
      where s.id = share_media.share_id and s.owner_id = auth.uid()
    )
  );

-- ── Storage bucket (private) ────────────────────────────────────────────────
--
-- Create the bucket if it doesn't exist; set it private so reads require a
-- signed URL or RLS policy. Clients upload already-encrypted bytes only.

insert into storage.buckets (id, name, public)
values ('share-media', 'share-media', false)
on conflict (id) do nothing;

-- Owner can upload objects whose path starts with their share-id; recipients
-- (and owner) can read. Path convention: {share_id}/{media_id}.bin
-- We enforce share membership via the path prefix and a join with shares.

create policy "storage-share-media-read" on storage.objects
  for select using (
    bucket_id = 'share-media'
    and exists (
      select 1 from public.shares s
      where s.id = (regexp_split_to_array(name, '/'))[1]::uuid
        and (
          s.owner_id = auth.uid()
          or exists (
            select 1 from public.share_recipients sr
            where sr.share_id = s.id and sr.recipient_id = auth.uid()
          )
        )
    )
  );

create policy "storage-share-media-write" on storage.objects
  for insert with check (
    bucket_id = 'share-media'
    and exists (
      select 1 from public.shares s
      where s.id = (regexp_split_to_array(name, '/'))[1]::uuid
        and s.owner_id = auth.uid()
    )
  );

create policy "storage-share-media-delete" on storage.objects
  for delete using (
    bucket_id = 'share-media'
    and exists (
      select 1 from public.shares s
      where s.id = (regexp_split_to_array(name, '/'))[1]::uuid
        and s.owner_id = auth.uid()
    )
  );

-- ── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists shares_owner_idx           on public.shares (owner_id, created_at desc);
create index if not exists share_recipients_recip_idx on public.share_recipients (recipient_id);
create index if not exists annotations_share_idx      on public.annotations (share_id, created_at);
create index if not exists share_media_share_idx      on public.share_media (share_id);
