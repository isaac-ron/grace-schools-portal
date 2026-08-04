-- =============================================================================
-- 0004_security.sql
-- Row Level Security. This is the authorization boundary for the whole system.
--
-- The UI hides things. These policies are what actually stop one family reading
-- another family's child's records, regardless of any bug in application code.
--
-- Every table below is deny-by-default: enabling RLS with no matching policy
-- returns nothing rather than everything.
--
-- NOTE ON THE SERVICE ROLE: Supabase's service_role key bypasses RLS entirely.
-- It is used only for account provisioning and the backup job, never to serve a
-- user request. See src/lib/supabase/README.md.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper functions
--
-- SECURITY DEFINER so that a policy on, say, students can consult profiles
-- without re-entering RLS and recursing. search_path is pinned on every one of
-- them: a SECURITY DEFINER function with a mutable search_path is a privilege
-- escalation waiting to happen.
-- -----------------------------------------------------------------------------

create or replace function auth_role()
returns user_role
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select role from profiles where id = auth.uid() and is_active;
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(auth_role() = 'admin', false);
$$;

create or replace function is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(auth_role() = 'teacher', false);
$$;

create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(auth_role() in ('teacher', 'admin'), false);
$$;

create or replace function can_release_results()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    (select can_release_results from profiles where id = auth.uid() and is_active),
    false);
$$;

create or replace function is_guardian_of(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from guardian_students gs
    where gs.guardian_id = auth.uid()
      and gs.student_id = p_student_id
  );
$$;

create or replace function teaches_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from staff_class_assignments sca
    where sca.staff_id = auth.uid()
      and sca.class_id = p_class_id
  ) or exists (
    select 1 from classes c
    where c.id = p_class_id
      and c.class_teacher_id = auth.uid()
  );
$$;

create or replace function teaches_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from enrollments e
    where e.student_id = p_student_id
      and teaches_class(e.class_id)
  );
$$;

-- A parent may only see marks once the report card for that term is released.
-- This is the release gate (requirement 7) expressed at the data layer, so an
-- unreleased mark is unreachable even if a page forgets to filter.
create or replace function results_released_for(p_student_id uuid, p_term_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from report_cards rc
    where rc.student_id = p_student_id
      and rc.term_id = p_term_id
      and rc.status = 'released'
  );
$$;

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'grade_levels', 'achievement_levels', 'academic_years', 'terms', 'profiles',
    'students', 'guardian_students', 'classes', 'subjects', 'subject_grade_levels',
    'enrollments', 'staff_class_assignments', 'assessments', 'scores',
    'report_cards', 'attendance_sessions', 'attendance_records', 'assignments',
    'assignment_files', 'submissions', 'submission_files', 'submission_grades',
    'notices', 'fee_balances', 'audit_log'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Reference data: readable by any signed-in user, written only by admins
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'grade_levels', 'achievement_levels', 'academic_years', 'terms',
    'subjects', 'subject_grade_levels'
  ]
  loop
    execute format(
      'create policy %I_read on %I for select to authenticated using (true)', t, t);
    execute format(
      'create policy %I_write on %I for all to authenticated
         using (is_admin()) with check (is_admin())', t, t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------

-- Own row, always.
create policy profiles_read_self on profiles
  for select to authenticated
  using (id = auth.uid());

-- Staff names are visible in-school so "graded by" and "marked by" resolve.
-- Parent profiles are never exposed to other parents.
create policy profiles_read_staff on profiles
  for select to authenticated
  using (role in ('teacher', 'admin'));

create policy profiles_read_all_admin on profiles
  for select to authenticated
  using (is_admin());

create policy profiles_update_self on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_admin_write on profiles
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- A user must not be able to promote themselves. Role and permission changes
-- are admin-only and enforced here because RLS cannot restrict columns.
create or replace function profiles_guard_privilege_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if (new.role is distinct from old.role
      or new.can_release_results is distinct from old.can_release_results
      or new.is_active is distinct from old.is_active)
     and not is_admin() then
    raise exception 'Only an administrator may change role, permissions or active status';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_privilege before update on profiles
  for each row execute function profiles_guard_privilege_change();

-- -----------------------------------------------------------------------------
-- students and their links
-- -----------------------------------------------------------------------------

create policy students_read on students
  for select to authenticated
  using (
    is_admin()
    or is_guardian_of(id)
    or teaches_student(id)
  );

create policy students_admin_write on students
  for all to authenticated
  using (is_admin()) with check (is_admin());

create policy guardian_students_read on guardian_students
  for select to authenticated
  using (
    is_admin()
    or guardian_id = auth.uid()
    or teaches_student(student_id)
  );

create policy guardian_students_admin_write on guardian_students
  for all to authenticated
  using (is_admin()) with check (is_admin());

create policy enrollments_read on enrollments
  for select to authenticated
  using (
    is_admin()
    or is_guardian_of(student_id)
    or teaches_class(class_id)
  );

create policy enrollments_admin_write on enrollments
  for all to authenticated
  using (is_admin()) with check (is_admin());

-- -----------------------------------------------------------------------------
-- classes and staff assignment
-- -----------------------------------------------------------------------------

create policy classes_read on classes
  for select to authenticated
  using (
    is_staff()
    or exists (
      select 1 from enrollments e
      where e.class_id = classes.id and is_guardian_of(e.student_id)
    )
  );

create policy classes_admin_write on classes
  for all to authenticated
  using (is_admin()) with check (is_admin());

create policy staff_class_assignments_read on staff_class_assignments
  for select to authenticated
  using (is_admin() or staff_id = auth.uid());

create policy staff_class_assignments_admin_write on staff_class_assignments
  for all to authenticated
  using (is_admin()) with check (is_admin());

-- -----------------------------------------------------------------------------
-- assessments and scores
-- -----------------------------------------------------------------------------

create policy assessments_read on assessments
  for select to authenticated
  using (
    is_admin()
    or teaches_class(class_id)
    or exists (
      select 1 from enrollments e
      where e.class_id = assessments.class_id and is_guardian_of(e.student_id)
    )
  );

create policy assessments_teacher_write on assessments
  for all to authenticated
  using (is_admin() or teaches_class(class_id))
  with check (is_admin() or teaches_class(class_id));

-- The single most security-sensitive policy in the system.
create policy scores_read on scores
  for select to authenticated
  using (
    is_admin()
    or teaches_student(student_id)
    or (
      is_guardian_of(student_id)
      and exists (
        select 1 from assessments a
        where a.id = scores.assessment_id
          and results_released_for(scores.student_id, a.term_id)
      )
    )
  );

create policy scores_teacher_write on scores
  for all to authenticated
  using (
    is_admin()
    or exists (
      select 1 from assessments a
      where a.id = scores.assessment_id and teaches_class(a.class_id)
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from assessments a
      where a.id = scores.assessment_id and teaches_class(a.class_id)
    )
  );

-- -----------------------------------------------------------------------------
-- report cards
-- -----------------------------------------------------------------------------

create policy report_cards_read on report_cards
  for select to authenticated
  using (
    is_admin()
    or teaches_class(class_id)
    or (is_guardian_of(student_id) and status = 'released')
  );

create policy report_cards_staff_write on report_cards
  for all to authenticated
  using (is_admin() or teaches_class(class_id))
  with check (is_admin() or teaches_class(class_id));

-- Releasing is a separate privilege from editing remarks. A class teacher may
-- write a comment; only a holder of can_release_results may publish.
create or replace function report_cards_guard_release()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.status is distinct from old.status and not can_release_results() then
    raise exception 'Only a user with results release permission may publish or withdraw results';
  end if;

  if new.status = 'released' and old.status = 'draft' then
    new.released_by := auth.uid();
    new.released_at := now();
  elsif new.status = 'draft' then
    new.released_by := null;
    new.released_at := null;
  end if;

  return new;
end;
$$;

create trigger report_cards_guard_release_before_update
  before update on report_cards
  for each row execute function report_cards_guard_release();

-- -----------------------------------------------------------------------------
-- attendance (visible to parents immediately, no release gate)
-- -----------------------------------------------------------------------------

create policy attendance_sessions_read on attendance_sessions
  for select to authenticated
  using (
    is_admin()
    or teaches_class(class_id)
    or exists (
      select 1 from enrollments e
      where e.class_id = attendance_sessions.class_id and is_guardian_of(e.student_id)
    )
  );

create policy attendance_sessions_teacher_write on attendance_sessions
  for all to authenticated
  using (is_admin() or teaches_class(class_id))
  with check (is_admin() or teaches_class(class_id));

create policy attendance_records_read on attendance_records
  for select to authenticated
  using (
    is_admin()
    or is_guardian_of(student_id)
    or teaches_student(student_id)
  );

create policy attendance_records_teacher_write on attendance_records
  for all to authenticated
  using (
    is_admin()
    or exists (
      select 1 from attendance_sessions s
      where s.id = attendance_records.session_id and teaches_class(s.class_id)
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from attendance_sessions s
      where s.id = attendance_records.session_id and teaches_class(s.class_id)
    )
  );

-- -----------------------------------------------------------------------------
-- assignments, materials and submissions
-- -----------------------------------------------------------------------------

create policy assignments_read on assignments
  for select to authenticated
  using (
    is_admin()
    or teaches_class(class_id)
    or (
      is_published
      and exists (
        select 1 from enrollments e
        where e.class_id = assignments.class_id and is_guardian_of(e.student_id)
      )
    )
  );

create policy assignments_teacher_write on assignments
  for all to authenticated
  using (is_admin() or teaches_class(class_id))
  with check (is_admin() or teaches_class(class_id));

create policy assignment_files_read on assignment_files
  for select to authenticated
  using (
    exists (
      select 1 from assignments a
      where a.id = assignment_files.assignment_id
        and (
          is_admin()
          or teaches_class(a.class_id)
          or (a.is_published and exists (
            select 1 from enrollments e
            where e.class_id = a.class_id and is_guardian_of(e.student_id)
          ))
        )
    )
  );

create policy assignment_files_teacher_write on assignment_files
  for all to authenticated
  using (
    exists (select 1 from assignments a
            where a.id = assignment_files.assignment_id
              and (is_admin() or teaches_class(a.class_id)))
  )
  with check (
    exists (select 1 from assignments a
            where a.id = assignment_files.assignment_id
              and (is_admin() or teaches_class(a.class_id)))
  );

create policy submissions_read on submissions
  for select to authenticated
  using (
    is_admin()
    or is_guardian_of(student_id)
    or teaches_student(student_id)
  );

-- A guardian may create and update their own child's submission. Teachers and
-- admins may too, so a teacher can record work handed in on paper.
create policy submissions_write on submissions
  for all to authenticated
  using (
    is_admin()
    or is_guardian_of(student_id)
    or teaches_student(student_id)
  )
  with check (
    is_admin()
    or is_guardian_of(student_id)
    or teaches_student(student_id)
  );

create policy submission_files_read on submission_files
  for select to authenticated
  using (
    exists (
      select 1 from submissions s
      where s.id = submission_files.submission_id
        and (is_admin() or is_guardian_of(s.student_id) or teaches_student(s.student_id))
    )
  );

create policy submission_files_write on submission_files
  for all to authenticated
  using (
    exists (
      select 1 from submissions s
      where s.id = submission_files.submission_id
        and (is_admin() or is_guardian_of(s.student_id) or teaches_student(s.student_id))
    )
  )
  with check (
    exists (
      select 1 from submissions s
      where s.id = submission_files.submission_id
        and (is_admin() or is_guardian_of(s.student_id) or teaches_student(s.student_id))
    )
  );

create policy submission_grades_read on submission_grades
  for select to authenticated
  using (
    exists (
      select 1 from submissions s
      where s.id = submission_grades.submission_id
        and (is_admin() or is_guardian_of(s.student_id) or teaches_student(s.student_id))
    )
  );

-- Only staff grade. A guardian can read the grade but never write one.
create policy submission_grades_teacher_write on submission_grades
  for all to authenticated
  using (
    exists (
      select 1 from submissions s
      where s.id = submission_grades.submission_id
        and (is_admin() or teaches_student(s.student_id))
    )
  )
  with check (
    exists (
      select 1 from submissions s
      where s.id = submission_grades.submission_id
        and (is_admin() or teaches_student(s.student_id))
    )
  );

-- -----------------------------------------------------------------------------
-- notices and fees
-- -----------------------------------------------------------------------------

create policy notices_read on notices
  for select to authenticated
  using (
    is_admin()
    or (
      published_at is not null
      and (
        (audience = 'all_parents' and auth_role() = 'parent')
        or (audience = 'all_staff' and is_staff())
        or (audience = 'single_class' and (
              teaches_class(class_id)
              or exists (
                select 1 from enrollments e
                where e.class_id = notices.class_id and is_guardian_of(e.student_id)
              )
           ))
      )
    )
  );

create policy notices_admin_write on notices
  for all to authenticated
  using (is_admin()) with check (is_admin());

-- Teachers have no business seeing family fee balances.
create policy fee_balances_read on fee_balances
  for select to authenticated
  using (is_admin() or is_guardian_of(student_id));

create policy fee_balances_admin_write on fee_balances
  for all to authenticated
  using (is_admin()) with check (is_admin());

-- -----------------------------------------------------------------------------
-- audit log: readable by admins, written only by SECURITY DEFINER triggers
-- -----------------------------------------------------------------------------

create policy audit_log_admin_read on audit_log
  for select to authenticated
  using (is_admin());

-- Deliberately no insert/update/delete policy. Nothing may write to the audit
-- log through the API; only the triggers in 0005 can, and nothing may amend it.

-- -----------------------------------------------------------------------------
-- Grants
--
-- RLS filters rows, but a role still needs the underlying table privilege to
-- reach the policy at all. A hosted Supabase project usually grants these to
-- authenticated via default privileges; stating them here keeps the schema
-- self-contained and reproducible on any Postgres.
--
-- `anon` is granted nothing. There is no anonymous surface in this portal:
-- every route requires a session.
-- -----------------------------------------------------------------------------

grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;

-- The audit log is append-only from the application's point of view. RLS already
-- denies writes, and revoking the table privilege makes that a second,
-- independent barrier rather than a single policy standing between a bug and a
-- rewritten grade history.
revoke insert, update, delete on audit_log from authenticated;
