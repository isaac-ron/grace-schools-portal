-- =============================================================================
-- 0003_grading.sql
-- CBE derivation, termly aggregation, and submission integrity rules.
--
-- The rule this file exists to enforce: the raw mark is the source of truth and
-- the achievement level is always derived from it. Nothing writes a level and a
-- percentage independently, so a report card can always be recomputed.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Which CBE scale applies, resolved from the learner's class
-- -----------------------------------------------------------------------------

create or replace function scale_for_class(p_class_id uuid)
returns grading_scale
language sql
stable
as $$
  select gl.scale
  from classes c
  join grade_levels gl on gl.code = c.grade_code
  where c.id = p_class_id;
$$;

create or replace function scale_for_assessment(p_assessment_id uuid)
returns grading_scale
language sql
stable
as $$
  select gl.scale
  from assessments a
  join classes c on c.id = a.class_id
  join grade_levels gl on gl.code = c.grade_code
  where a.id = p_assessment_id;
$$;

-- -----------------------------------------------------------------------------
-- Derive percentage and level on every score write
-- -----------------------------------------------------------------------------

create or replace function scores_derive()
returns trigger
language plpgsql
as $$
declare
  v_scale     grading_scale;
  v_max       numeric(6,2);
  v_valid     boolean;
begin
  -- A mark may only be recorded against a learner actually enrolled in the class
  -- the assessment belongs to. Without this, a teacher could attach a score to
  -- any student in the school via one of their own assessments, writing into a
  -- record they have no business touching. RLS restricts which assessments a
  -- teacher can write to, not which student_id they can name.
  if not exists (
    select 1
    from assessments a
    join enrollments e on e.class_id = a.class_id
    where a.id = new.assessment_id
      and e.student_id = new.student_id
  ) then
    raise exception 'Learner % is not enrolled in the class this assessment belongs to',
      new.student_id;
  end if;

  select scale_for_assessment(new.assessment_id) into v_scale;
  if v_scale is null then
    raise exception 'Cannot resolve grading scale for assessment %', new.assessment_id;
  end if;

  if new.is_direct_level then
    -- PP1..Grade 3: the teacher records an observed level, there is no mark.
    if new.level_code is null then
      raise exception 'A direct-level score requires level_code';
    end if;
    select exists (
      select 1 from achievement_levels
      where scale = v_scale and code = new.level_code
    ) into v_valid;
    if not v_valid then
      raise exception 'Level % is not valid on the % scale', new.level_code, v_scale;
    end if;
    new.percentage := null;

  elsif new.raw_score is not null then
    select max_score into v_max from assessments where id = new.assessment_id;
    if new.raw_score > v_max then
      raise exception 'Score % exceeds the maximum of % for this assessment',
        new.raw_score, v_max;
    end if;
    new.percentage := round((new.raw_score / v_max) * 100, 2);
    new.level_code := cbe_level(new.percentage, v_scale);

  else
    -- Not assessed. Deliberately NOT the bottom grade: a learner who missed an
    -- assessment must not be recorded as Below Expectation on a permanent record.
    new.percentage := null;
    new.level_code := null;
  end if;

  return new;
end;
$$;

create trigger scores_derive_before_write
  before insert or update of raw_score, level_code, is_direct_level, assessment_id
  on scores
  for each row execute function scores_derive();

-- -----------------------------------------------------------------------------
-- Derive the level on a graded submission
-- -----------------------------------------------------------------------------

create or replace function submission_grades_derive()
returns trigger
language plpgsql
as $$
declare
  v_scale grading_scale;
begin
  select scale_for_class(a.class_id) into v_scale
  from submissions s
  join assignments a on a.id = s.assignment_id
  where s.id = new.submission_id;

  if new.percentage is not null and v_scale is not null then
    new.level_code := cbe_level(new.percentage, v_scale);
  end if;

  return new;
end;
$$;

create trigger submission_grades_derive_before_write
  before insert or update of percentage on submission_grades
  for each row execute function submission_grades_derive();

-- -----------------------------------------------------------------------------
-- Termly subject result
--
-- Percentage-based bands (Grade 4 and up) take a weight-weighted mean of the
-- assessment percentages. Observation-based bands (PP1..Grade 3) have no marks
-- to average, so the levels themselves are averaged by their ordinal position
-- and mapped back, which is the only meaningful aggregation available.
--
-- security_invoker is essential. Without it the view would run as its owner and
-- silently bypass every RLS policy in 0004.
-- -----------------------------------------------------------------------------

create or replace view termly_subject_results
with (security_invoker = true) as
with graded as (
  select
    sc.student_id,
    a.term_id,
    a.class_id,
    a.subject_id,
    sc.percentage,
    sc.level_code,
    sc.is_direct_level,
    a.weight,
    al.sort_order as level_rank
  from scores sc
  join assessments a on a.id = sc.assessment_id
  left join achievement_levels al
    on al.code = sc.level_code
   and al.scale = scale_for_class(a.class_id)
  where sc.level_code is not null      -- not-assessed rows never affect a result
)
select
  g.student_id,
  g.term_id,
  g.class_id,
  g.subject_id,
  count(*)::int as assessment_count,
  -- Mark-based average, null for observation-only bands
  case
    when sum(g.weight) filter (where not g.is_direct_level) > 0
    then round(
      sum(g.percentage * g.weight) filter (where not g.is_direct_level)
      / sum(g.weight) filter (where not g.is_direct_level), 2)
  end as percentage,
  coalesce(
    -- Preferred: derive from the weighted mark average
    cbe_level(
      case
        when sum(g.weight) filter (where not g.is_direct_level) > 0
        then sum(g.percentage * g.weight) filter (where not g.is_direct_level)
           / sum(g.weight) filter (where not g.is_direct_level)
      end,
      scale_for_class(g.class_id)
    ),
    -- Fallback: average the observed levels by ordinal position
    (
      select al2.code
      from achievement_levels al2
      where al2.scale = scale_for_class(g.class_id)
        and al2.sort_order = round(avg(g.level_rank))::int
      limit 1
    )
  ) as level_code
from graded g
group by g.student_id, g.term_id, g.class_id, g.subject_id;

comment on view termly_subject_results is
  'One CBE result per student, subject and term. Recomputed on read so a corrected mark is reflected immediately.';

-- -----------------------------------------------------------------------------
-- Enrollment integrity for attendance and submissions
--
-- Same class of bug as the scores check above: RLS controls which class a user
-- may write to, but not which student_id they may name inside that write. These
-- triggers close that gap so a record can never be attached to a learner who is
-- not in the class it belongs to.
-- -----------------------------------------------------------------------------

create or replace function attendance_records_check_enrollment()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from attendance_sessions s
    join enrollments e on e.class_id = s.class_id
    where s.id = new.session_id
      and e.student_id = new.student_id
  ) then
    raise exception 'Learner % is not enrolled in the class for this register',
      new.student_id;
  end if;
  return new;
end;
$$;

create trigger attendance_records_check_enrollment_before_write
  before insert or update of student_id, session_id on attendance_records
  for each row execute function attendance_records_check_enrollment();

create or replace function submissions_check_enrollment()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from assignments a
    join enrollments e on e.class_id = a.class_id
    where a.id = new.assignment_id
      and e.student_id = new.student_id
  ) then
    raise exception 'Learner % is not enrolled in the class this assignment belongs to',
      new.student_id;
  end if;
  return new;
end;
$$;

create trigger submissions_check_enrollment_before_write
  before insert or update of student_id, assignment_id on submissions
  for each row execute function submissions_check_enrollment();

-- -----------------------------------------------------------------------------
-- Submission integrity
-- -----------------------------------------------------------------------------

-- Maximum three photos per submission, enforced at the database rather than
-- only in the browser, so the cap survives a direct API call.
create or replace function submission_files_enforce_cap()
returns trigger
language plpgsql
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from submission_files
  where submission_id = new.submission_id;

  if v_count >= 3 then
    raise exception 'A submission may contain at most 3 photos';
  end if;

  return new;
end;
$$;

create trigger submission_files_cap_before_insert
  before insert on submission_files
  for each row execute function submission_files_enforce_cap();

-- Adding the first photo moves a submission from pending to submitted.
create or replace function submissions_mark_submitted()
returns trigger
language plpgsql
as $$
begin
  update submissions
     set status = 'submitted',
         submitted_at = coalesce(submitted_at, now())
   where id = new.submission_id
     and status = 'pending';
  return new;
end;
$$;

create trigger submission_files_mark_submitted_after_insert
  after insert on submission_files
  for each row execute function submissions_mark_submitted();

-- Grading moves it to graded; returning it moves it to returned.
create or replace function submissions_sync_grade_status()
returns trigger
language plpgsql
as $$
begin
  update submissions
     set status = case when new.returned_at is not null then 'returned' else 'graded' end
   where id = new.submission_id;
  return new;
end;
$$;

create trigger submission_grades_sync_status_after_write
  after insert or update on submission_grades
  for each row execute function submissions_sync_grade_status();
