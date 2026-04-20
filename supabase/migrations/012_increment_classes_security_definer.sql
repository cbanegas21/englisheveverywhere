-- Fix: increment_classes was SECURITY INVOKER (default). When a teacher declines
-- a student's booking, declineBooking calls this RPC as the teacher — but RLS
-- on the students table blocks the teacher from updating the student row.
-- The UPDATE silently failed and the student never got their class credit back.
--
-- Mirror decrement_classes (which is already SECURITY DEFINER) so the refund
-- runs with the owner's privileges and bypasses the RLS policy on students.

CREATE OR REPLACE FUNCTION increment_classes(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE students
  SET classes_remaining = classes_remaining + 1
  WHERE id = p_student_id;
END;
$$;
