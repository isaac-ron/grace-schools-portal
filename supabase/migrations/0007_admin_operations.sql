-- =============================================================================
-- 0007_admin_operations.sql
--
-- Multi-statement admin operations that must not half-apply.
--
-- These are SECURITY INVOKER (the default) on purpose: they run as the calling
-- user, so RLS still decides whether the caller may touch these rows. They exist
-- for atomicity, not to bypass anything. A function that needed SECURITY DEFINER
-- to work here would be a policy bug in disguise.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Switching the current academic year / term
--
-- `academic_years_one_current` is a partial unique index, so the old current
-- must be cleared before the new one is set. Doing that as two round trips from
-- the app can leave the school with no current year if the second call fails.
-- -----------------------------------------------------------------------------

create or replace function set_current_academic_year(p_year_id uuid)
returns void
language plpgsql
as $$
begin
  update academic_years set is_current = false where is_current;
  update academic_years set is_current = true where id = p_year_id;
  if not found then
    raise exception 'Academic year % not found', p_year_id;
  end if;
end;
$$;

create or replace function set_current_term(p_term_id uuid)
returns void
language plpgsql
as $$
begin
  update terms set is_current = false where is_current;
  update terms set is_current = true where id = p_term_id;
  if not found then
    raise exception 'Term % not found', p_term_id;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Year-end promotion
--
-- Rolls every active learner up one grade into the next academic year. This is
-- the operation most likely to be done by hand at 9pm in November and got wrong,
-- so it is one call with defined rules:
--
--   - Learners in the top grade (G9) are NOT promoted. They complete junior
--     school and are left for the office to archive or transfer deliberately.
--   - Stream is preserved when a class with the same stream exists in the target
--     year; otherwise the learner lands in that grade's first class.
--   - Learners already enrolled in the target year are skipped, so re-running is
--     safe and a partial promotion can be resumed.
--   - If a required destination class does not exist, the whole thing fails
--     rather than silently leaving a cohort behind.
--
-- Returns the number of learners moved.
-- -----------------------------------------------------------------------------

create or replace function promote_school(p_from_year uuid, p_to_year uuid)
returns integer
language plpgsql
as $$
declare
  v_moved integer := 0;
  r record;
  v_target_class uuid;
  v_next_grade text;
begin
  if p_from_year = p_to_year then
    raise exception 'Source and destination academic year must differ';
  end if;

  for r in
    select e.student_id, c.grade_code, c.stream, gl.sort_order
    from enrollments e
    join classes c on c.id = e.class_id
    join grade_levels gl on gl.code = c.grade_code
    join students s on s.id = e.student_id
    where e.academic_year_id = p_from_year
      and s.is_active
      -- skip anyone already placed in the destination year
      and not exists (
        select 1 from enrollments e2
        where e2.student_id = e.student_id
          and e2.academic_year_id = p_to_year
      )
  loop
    select code into v_next_grade
    from grade_levels
    where sort_order = r.sort_order + 1;

    -- Top of the school. Not promoted; left for deliberate handling.
    if v_next_grade is null then
      continue;
    end if;

    -- Prefer the same stream, fall back to the first class in that grade.
    select id into v_target_class
    from classes
    where academic_year_id = p_to_year
      and grade_code = v_next_grade
      and stream is not distinct from r.stream;

    if v_target_class is null then
      select id into v_target_class
      from classes
      where academic_year_id = p_to_year
        and grade_code = v_next_grade
      order by stream nulls first
      limit 1;
    end if;

    if v_target_class is null then
      raise exception
        'No class exists for % in the destination year. Create the classes first, then promote.',
        v_next_grade;
    end if;

    insert into enrollments (student_id, class_id, academic_year_id)
    values (r.student_id, v_target_class, p_to_year);

    v_moved := v_moved + 1;
  end loop;

  return v_moved;
end;
$$;

comment on function promote_school is
  'Rolls active learners up one grade into the destination year. Idempotent: already-enrolled learners are skipped.';
