-- REQ-021: lightweight in-app feedback.
--
-- A user taps a smiley (1-5) and optionally adds a comment. No user
-- identification is stored — anon insert only, server-side admin
-- queries the table via the service role.
--
-- The table deliberately stores nothing but the rating, an optional
-- comment, and the timestamp. No device_id, no app_version, no locale,
-- no app_mode. Adding columns later is cheap; removing them is not.

create table public.feedback_submissions (
  id         uuid primary key default gen_random_uuid(),
  rating     smallint not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now()
);

alter table public.feedback_submissions enable row level security;

-- Anyone (including the anon role used by the client SDK) may insert.
-- No select / update / delete policy → reads are only possible via the
-- service-role key, which the client never sees.
create policy "anonymous insert"
  on public.feedback_submissions
  for insert
  to anon, authenticated
  with check (
    rating between 1 and 5
    and (comment is null or length(comment) <= 500)
  );
