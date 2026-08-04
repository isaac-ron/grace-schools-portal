-- =============================================================================
-- 0009_fix_classes_visibility.sql
--
-- Tightens who can read the class list.
--
-- 0004 granted `classes_read` to any staff member via is_staff(), so every
-- teacher could enumerate every class in the school. The learner rows, marks and
-- registers inside those classes were always protected by teaches_class, so this
-- was not a data leak, but it was wrong on two counts:
--
--   1. A teacher has no business seeing the school's full class structure.
--   2. It broke the register: the class picker listed classes the teacher does
--      not teach, and defaulted to the first one, which had no learners in it.
--
-- Admins still see everything. Teachers see the classes they teach or are class
-- teacher of. Parents see the classes their children are enrolled in.
-- =============================================================================

drop policy if exists classes_read on classes;

create policy classes_read on classes
  for select to authenticated
  using (
    is_admin()
    or teaches_class(id)
    or exists (
      select 1 from enrollments e
      where e.class_id = classes.id and is_guardian_of(e.student_id)
    )
  );
