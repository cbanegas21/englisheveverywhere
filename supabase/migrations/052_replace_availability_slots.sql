-- 052: atomic replace-all for a teacher's recurring availability (P3).
-- saveAvailabilitySlots did delete-then-insert in two statements — a transient
-- insert failure left the teacher with ZERO slots (their availability wiped). This
-- function does both in ONE transaction, so a failure rolls back and the old slots
-- survive. SECURITY DEFINER + EXECUTE revoked from client roles (service-role only,
-- mirrors the credit RPCs in migration 042).
create or replace function public.replace_availability_slots(p_teacher_id uuid, p_slots jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from availability_slots where teacher_id = p_teacher_id;
  if p_slots is not null and jsonb_array_length(p_slots) > 0 then
    insert into availability_slots (teacher_id, day_of_week, start_time, end_time)
    select p_teacher_id,
           (e->>'day_of_week')::int,
           (e->>'start_time')::time,
           (e->>'end_time')::time
    from jsonb_array_elements(p_slots) e;
  end if;
end;
$$;

revoke execute on function public.replace_availability_slots(uuid, jsonb) from public, anon, authenticated;
