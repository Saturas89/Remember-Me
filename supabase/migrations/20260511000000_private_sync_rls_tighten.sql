-- H6: Tighten RLS policy on private_sync_state.
--
-- The initial policy was FOR ALL (no operation split) and lacked an explicit
-- role grant, which defaults to PUBLIC. That widens the blast radius beyond
-- what the table needs: anon clients can attempt operations against the
-- table at all, and we lose the defense-in-depth of "this policy applies
-- only to SELECTs / only to UPDATEs etc."
--
-- This migration replaces it with four operation-specific policies, each
-- gated on `TO authenticated`. The semantic check (own row only) stays the
-- same — auth.uid() must equal user_id for both read and write.

drop policy if exists "own rows only" on public.private_sync_state;

create policy "private_sync_state-select-own"
  on public.private_sync_state
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "private_sync_state-insert-own"
  on public.private_sync_state
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "private_sync_state-update-own"
  on public.private_sync_state
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "private_sync_state-delete-own"
  on public.private_sync_state
  for delete
  to authenticated
  using (auth.uid() = user_id);
