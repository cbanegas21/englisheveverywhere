-- Teachers were defaulting to 5.0 stars before any reviews existed, which
-- was misleading on the marketplace. Drop the default and clear any 5.0
-- rating on a teacher who has no completed sessions yet.

alter table public.teachers
  alter column rating drop default;

update public.teachers
   set rating = null
 where coalesce(total_sessions, 0) = 0;
