-- Add missing UPDATE policy on public.devices.
--
-- bootstrapSession() calls upsert() on devices. When the row already exists
-- (returning user / reinstall with new key), the INSERT ON CONFLICT DO UPDATE
-- path requires an UPDATE policy. Without one, RLS denies the update and
-- throws "new row violates row-level security policy for table devices".

drop policy if exists "device-update-self" on public.devices;

create policy "device-update-self" on public.devices
  for update
  using     (id = auth.uid())
  with check (id = auth.uid());
