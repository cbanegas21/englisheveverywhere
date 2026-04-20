-- Atomic, SECURITY DEFINER RPC for admin-driven class credit additions.
--
-- Before: `src/app/[lang]/admin/actions.ts:addStudentClasses` did a
-- SELECT-then-UPDATE in application code:
--     const { data } = await admin.from('students').select('classes_remaining')
--     await admin.from('students').update({
--       classes_remaining: (data.classes_remaining || 0) + count,
--     })
-- Two concurrent admin calls (e.g., double-click, batch grant) would both
-- read the same old value and overwrite each other, losing increments.
--
-- The Tier 1.6 atomicity audit caught `cancelBookingWithRefund` with the
-- same pattern. Fix it at the source for every admin-facing counter write.
--
-- SECURITY DEFINER + search_path = public mirrors increment_classes
-- (migration 012) so RLS can't silently swallow the write.

CREATE OR REPLACE FUNCTION add_classes(p_student_id uuid, p_count integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE students
  SET classes_remaining = classes_remaining + p_count
  WHERE id = p_student_id;
END;
$$;
