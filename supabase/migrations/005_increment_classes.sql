-- Restores one class to a student when a booking is declined/cancelled by their teacher.
-- Mirrors the existing decrement_classes(p_student_id) function.

CREATE OR REPLACE FUNCTION increment_classes(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE students
  SET classes_remaining = classes_remaining + 1
  WHERE id = p_student_id;
END;
$$;
