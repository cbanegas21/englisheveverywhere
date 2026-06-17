-- 050: one session row per booking (P0-3).
-- A concurrent room-join (teacher + student opening /sala the same instant) could
-- insert two public.sessions rows for one booking: getRoomAccess read null then
-- inserted, with no DB guard. Downstream consumers use .maybeSingle() which ERRORS
-- on multiple rows, so "Terminar Clase"/completeSession could fail or read the row
-- missing student_joined_at — silently withholding a real teacher payout. This
-- mirrors the existing payments_booking_id_unique guard (migration 034).
--
-- Step 1 (safety): consolidate any existing duplicates into the earliest row,
-- preserving attendance + lifecycle stamps. (Currently zero duplicates in prod, so
-- this is a no-op, but it makes the migration safe if a race lands before apply.)
with agg as (
  select booking_id,
         max(student_joined_at)      as sj,
         max(ended_at)               as ea,
         max(transcript)             as tr,
         max(transcript_captured_at) as tc,
         max(teacher_notes)          as tn
  from public.sessions
  group by booking_id
),
keeper as (
  select distinct on (booking_id) id, booking_id
  from public.sessions
  order by booking_id, created_at asc, started_at asc nulls last
)
update public.sessions s set
  student_joined_at      = coalesce(s.student_joined_at, agg.sj),
  ended_at               = coalesce(s.ended_at, agg.ea),
  transcript             = coalesce(s.transcript, agg.tr),
  transcript_captured_at = coalesce(s.transcript_captured_at, agg.tc),
  teacher_notes          = coalesce(s.teacher_notes, agg.tn)
from keeper k
join agg on agg.booking_id = k.booking_id
where s.id = k.id;

-- Step 2: drop the non-keeper duplicate rows.
delete from public.sessions s
using (
  select id,
         row_number() over (partition by booking_id order by created_at asc, started_at asc nulls last) as rn
  from public.sessions
) r
where s.id = r.id and r.rn > 1;

-- Step 3: enforce one session per booking going forward.
create unique index if not exists sessions_booking_id_unique
  on public.sessions (booking_id);
