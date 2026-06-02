-- 028_teacher_accepting_students.sql
-- Decouple "accepting new students" from is_active (audit EK-011).
--
-- is_active is ADMIN-controlled approval — it gates teacher dashboard access
-- (the /maestro/pending redirect). The teacher-facing "Accepting students"
-- toggle was wrongly writing is_active, so a teacher toggling it off locked
-- themselves out of their own dashboard.
--
-- accepting_students is a TEACHER-controlled preference that never affects
-- access. Defaults to true so existing teachers keep accepting. Admin
-- assignment UI can later prefer teachers with accepting_students = true.

alter table teachers
  add column if not exists accepting_students boolean not null default true;
