-- Add missing UPDATE policy for the devices table.
--
-- The original schema only had INSERT / SELECT / DELETE. Without an UPDATE
-- policy the upsert in bootstrapSession silently does nothing when the row
-- already exists, so a device whose public_key was stored incorrectly (e.g.
-- from the Uint8Array serialisation bug) could never self-correct.

drop policy if exists "device-update-self" on public.devices;

create policy "device-update-self" on public.devices
  for update using (id = auth.uid()) with check (id = auth.uid());
