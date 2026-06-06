-- Smart intake: additive fields on students that prep the free discovery class.
-- All nullable; CHECK allows NULL or the enumerated option values. Idempotent.

alter table public.students add column if not exists self_rated_level text;
alter table public.students add column if not exists motivation text;
alter table public.students add column if not exists availability text;
alter table public.students add column if not exists speaking_comfort text;

alter table public.students drop constraint if exists students_self_rated_level_check;
alter table public.students add constraint students_self_rated_level_check
  check (self_rated_level is null or self_rated_level = any (array['just_starting','getting_by','conversational','advanced','not_sure']));

alter table public.students drop constraint if exists students_motivation_check;
alter table public.students add constraint students_motivation_check
  check (motivation is null or motivation = any (array['work','travel','study','personal','just_me']));

alter table public.students drop constraint if exists students_availability_check;
alter table public.students add constraint students_availability_check
  check (availability is null or availability = any (array['mornings','afternoons','evenings','late_night','varies']));

alter table public.students drop constraint if exists students_speaking_comfort_check;
alter table public.students add constraint students_speaking_comfort_check
  check (speaking_comfort is null or speaking_comfort = any (array['nervous','depends','comfortable']));
