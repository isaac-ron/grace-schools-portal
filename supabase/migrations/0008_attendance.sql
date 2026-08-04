-- =============================================================================
-- 0008_attendance.sql
--
-- Saving a register in one call, and reading attendance back per term.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- save_register
--
-- The whole register goes in one statement. Two reasons, both about Chepilat
-- rather than about elegance:
--
--   1. A class of forty learners over forty round trips on a weak connection
--      will fail part way through, leaving half a register saved and no way for
--      the teacher to tell which half.
--   2. The client retries after a dropped connection, so saving must be
--      idempotent. Both writes upsert, meaning a retry of a partially applied
--      save converges on the same result rather than duplicating rows.
--
-- SECURITY INVOKER (the default): the caller must pass `teaches_class` in the
-- RLS policies on both tables, and the enrollment trigger from 0003 still
-- rejects any learner who is not in this class.
-- -----------------------------------------------------------------------------

create or replace function save_register(
  p_class_id uuid,
  p_date     date,
  p_records  jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_session_id uuid;
begin
  if p_date > current_date then
    raise exception 'A register cannot be taken for a future date';
  end if;

  insert into attendance_sessions (class_id, session_date, taken_by, taken_at)
  values (p_class_id, p_date, auth.uid(), now())
  on conflict (class_id, session_date)
    do update set taken_by = auth.uid(), taken_at = now()
  returning id into v_session_id;

  insert into attendance_records (session_id, student_id, status, reason)
  select
    v_session_id,
    (r ->> 'student_id')::uuid,
    (r ->> 'status')::attendance_status,
    nullif(r ->> 'reason', '')::absence_reason
  from jsonb_array_elements(p_records) as r
  on conflict (session_id, student_id)
    do update set
      status = excluded.status,
      reason = excluded.reason;

  return v_session_id;
end;
$$;

comment on function save_register is
  'Upserts a whole day''s register in one transaction. Idempotent, so a retry after a dropped connection is safe.';

-- -----------------------------------------------------------------------------
-- Attendance per learner per term
--
-- Sessions carry a date, terms carry a range, so the join is by date. A learner
-- only appears for terms in which a register was actually taken for their class.
--
-- security_invoker again: without it this view would run as its owner and hand
-- one family another family's attendance.
-- -----------------------------------------------------------------------------

create or replace view attendance_term_summary
with (security_invoker = true) as
select
  ar.student_id,
  t.id   as term_id,
  t.name as term_name,
  t.academic_year_id,
  s.class_id,
  count(*)::int                                                   as days_recorded,
  count(*) filter (where ar.status = 'present')::int              as days_present,
  count(*) filter (where ar.status = 'late')::int                 as days_late,
  count(*) filter (where ar.status = 'absent')::int               as days_absent,
  count(*) filter (where ar.status = 'absent'
                     and ar.reason = 'unexplained')::int          as days_unexplained,
  -- Late still counts as attending. A learner who arrived is present in the way
  -- that matters for an attendance rate.
  round(
    100.0 * count(*) filter (where ar.status in ('present', 'late')) / nullif(count(*), 0),
    1
  ) as attendance_rate
from attendance_records ar
join attendance_sessions s on s.id = ar.session_id
join terms t
  on s.session_date between t.starts_on and t.ends_on
group by ar.student_id, t.id, t.name, t.academic_year_id, s.class_id;

comment on view attendance_term_summary is
  'Attendance totals per learner per term. Late counts toward the attendance rate; only absence reduces it.';
