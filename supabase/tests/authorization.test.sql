-- =============================================================================
-- Authorization and grading test suite.
-- Every failure raises, so ON_ERROR_STOP makes the whole run fail loudly.
-- =============================================================================

\set ON_ERROR_STOP on
set client_min_messages = warning;

create or replace function assert_eq(actual anyelement, expected anyelement, label text)
returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL: % (got %, expected %)', label, actual, expected;
  end if;
  raise notice 'pass: %', label;
end; $$;

-- -----------------------------------------------------------------------------
-- Seed a small school
-- -----------------------------------------------------------------------------

-- auth users
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'), -- parent A
  ('22222222-2222-2222-2222-222222222222'), -- parent B
  ('33333333-3333-3333-3333-333333333333'), -- teacher of G7
  ('44444444-4444-4444-4444-444444444444'), -- teacher of G4 (unrelated)
  ('55555555-5555-5555-5555-555555555555'), -- admin, no release permission
  ('66666666-6666-6666-6666-666666666666'); -- headteacher, can release

insert into profiles (id, role, full_name, can_release_results) values
  ('11111111-1111-1111-1111-111111111111', 'parent',  'Parent A', false),
  ('22222222-2222-2222-2222-222222222222', 'parent',  'Parent B', false),
  ('33333333-3333-3333-3333-333333333333', 'teacher', 'Teacher G7', false),
  ('44444444-4444-4444-4444-444444444444', 'teacher', 'Teacher G4', false),
  ('55555555-5555-5555-5555-555555555555', 'admin',   'Bursar',    false),
  ('66666666-6666-6666-6666-666666666666', 'admin',   'Headteacher', true);

insert into academic_years (id, name, starts_on, ends_on, is_current) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '2026', '2026-01-05', '2026-11-27', true);

insert into terms (id, academic_year_id, name, term_number, starts_on, ends_on, is_current) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Term 1', 1, '2026-01-05', '2026-04-10', true);

insert into classes (id, academic_year_id, grade_code, stream, class_teacher_id) values
  ('cccccccc-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000001',
   'G7', null, '33333333-3333-3333-3333-333333333333'),
  ('cccccccc-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001',
   'G4', null, '44444444-4444-4444-4444-444444444444'),
  -- Lower primary, observation-based entry
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
   'G2', null, '44444444-4444-4444-4444-444444444444');

insert into subjects (id, code, name) values
  ('dddddddd-0000-0000-0000-000000000001', 'MATH', 'Mathematics');

insert into students (id, admission_no, first_name, last_name) values
  ('eeeeeeee-0000-0000-0000-00000000000a', 'GS001', 'Child', 'A'),
  ('eeeeeeee-0000-0000-0000-00000000000b', 'GS002', 'Child', 'B'),
  ('eeeeeeee-0000-0000-0000-00000000000c', 'GS003', 'Child', 'C'), -- G2 learner
  ('eeeeeeee-0000-0000-0000-00000000000d', 'GS004', 'Child', 'D'); -- second G7 learner

insert into guardian_students (guardian_id, student_id, relationship, is_primary) values
  ('11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-00000000000a', 'mother', true),
  ('22222222-2222-2222-2222-222222222222', 'eeeeeeee-0000-0000-0000-00000000000b', 'father', true);

insert into enrollments (student_id, class_id, academic_year_id) values
  ('eeeeeeee-0000-0000-0000-00000000000a', 'cccccccc-0000-0000-0000-000000000007',
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('eeeeeeee-0000-0000-0000-00000000000b', 'cccccccc-0000-0000-0000-000000000004',
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('eeeeeeee-0000-0000-0000-00000000000c', 'cccccccc-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('eeeeeeee-0000-0000-0000-00000000000d', 'cccccccc-0000-0000-0000-000000000007',
   'aaaaaaaa-0000-0000-0000-000000000001');

insert into staff_class_assignments (staff_id, class_id, subject_id) values
  ('33333333-3333-3333-3333-333333333333', 'cccccccc-0000-0000-0000-000000000007',
   'dddddddd-0000-0000-0000-000000000001');

insert into assessments (id, class_id, subject_id, term_id, name, type, max_score) values
  ('ffffffff-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000007',
   'dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   'End Term Maths', 'endterm', 100),
  ('ffffffff-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000002',
   'dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   'Number Work Observation', 'classwork', 100);

-- =============================================================================
-- 1. CBE level mapping, junior school eight-point scale
-- =============================================================================

select assert_eq(cbe_level(100, 'eight_point'), 'EE1', 'eight_point 100 -> EE1');
select assert_eq(cbe_level(90,  'eight_point'), 'EE1', 'eight_point 90 boundary -> EE1');
select assert_eq(cbe_level(89,  'eight_point'), 'EE2', 'eight_point 89 boundary -> EE2');
select assert_eq(cbe_level(75,  'eight_point'), 'EE2', 'eight_point 75 boundary -> EE2');
select assert_eq(cbe_level(74,  'eight_point'), 'ME1', 'eight_point 74 boundary -> ME1');
select assert_eq(cbe_level(58,  'eight_point'), 'ME1', 'eight_point 58 boundary -> ME1');
select assert_eq(cbe_level(57,  'eight_point'), 'ME2', 'eight_point 57 boundary -> ME2');
select assert_eq(cbe_level(41,  'eight_point'), 'ME2', 'eight_point 41 boundary -> ME2');
select assert_eq(cbe_level(40,  'eight_point'), 'AE1', 'eight_point 40 boundary -> AE1');
select assert_eq(cbe_level(31,  'eight_point'), 'AE1', 'eight_point 31 boundary -> AE1');
select assert_eq(cbe_level(30,  'eight_point'), 'AE2', 'eight_point 30 boundary -> AE2');
select assert_eq(cbe_level(21,  'eight_point'), 'AE2', 'eight_point 21 boundary -> AE2');
select assert_eq(cbe_level(20,  'eight_point'), 'BE1', 'eight_point 20 boundary -> BE1');
select assert_eq(cbe_level(11,  'eight_point'), 'BE1', 'eight_point 11 boundary -> BE1');
select assert_eq(cbe_level(10,  'eight_point'), 'BE2', 'eight_point 10 boundary -> BE2');
select assert_eq(cbe_level(1,   'eight_point'), 'BE2', 'eight_point 1 -> BE2');
select assert_eq(cbe_level(0,   'eight_point'), 'BE2', 'eight_point scored zero -> BE2 (not null)');

-- Fractional marks round half-up rather than falling into a gap
select assert_eq(cbe_level(74.5, 'eight_point'), 'EE2', 'eight_point 74.5 rounds up to EE2');
select assert_eq(cbe_level(74.4, 'eight_point'), 'ME1', 'eight_point 74.4 rounds down to ME1');

-- Not assessed is never a grade
select assert_eq(cbe_level(null, 'eight_point'), null::text, 'null percent -> null level, never BE2');

-- Four-point scale
select assert_eq(cbe_level(100, 'four_point'), 'EE', 'four_point 100 -> EE');
select assert_eq(cbe_level(75,  'four_point'), 'EE', 'four_point 75 boundary -> EE');
select assert_eq(cbe_level(74,  'four_point'), 'ME', 'four_point 74 boundary -> ME');
select assert_eq(cbe_level(41,  'four_point'), 'ME', 'four_point 41 boundary -> ME');
select assert_eq(cbe_level(40,  'four_point'), 'AE', 'four_point 40 boundary -> AE');
select assert_eq(cbe_level(21,  'four_point'), 'AE', 'four_point 21 boundary -> AE');
select assert_eq(cbe_level(20,  'four_point'), 'BE', 'four_point 20 boundary -> BE');
select assert_eq(cbe_level(0,   'four_point'), 'BE', 'four_point 0 -> BE');

-- Every whole percent 0..100 maps to exactly one level on both scales
do $$
declare p int; c int;
begin
  for p in 0..100 loop
    select count(*) into c from achievement_levels
      where scale = 'eight_point' and p between min_percent and max_percent;
    if c <> 1 then raise exception 'FAIL: eight_point percent % matches % bands', p, c; end if;
    select count(*) into c from achievement_levels
      where scale = 'four_point' and p between min_percent and max_percent;
    if c <> 1 then raise exception 'FAIL: four_point percent % matches % bands', p, c; end if;
  end loop;
  raise notice 'pass: all 0..100 map to exactly one band on both scales';
end; $$;

-- =============================================================================
-- 2. Score derivation trigger
-- =============================================================================

insert into scores (assessment_id, student_id, raw_score)
values ('ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-00000000000a', 82);

select assert_eq(
  (select level_code from scores where student_id = 'eeeeeeee-0000-0000-0000-00000000000a'),
  'EE2', 'score 82/100 derives EE2');
select assert_eq(
  (select percentage from scores where student_id = 'eeeeeeee-0000-0000-0000-00000000000a'),
  82.00::numeric, 'score 82/100 derives 82.00 percent');

-- Not assessed: null score yields no level at all (Child D, also in G7)
insert into scores (assessment_id, student_id, raw_score)
values ('ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-00000000000d', null);
select assert_eq(
  (select level_code from scores where student_id = 'eeeeeeee-0000-0000-0000-00000000000d'),
  null::text, 'null raw_score yields null level, not BE2');

-- A learner from another class must not be markable on this assessment
do $$
begin
  insert into scores (assessment_id, student_id, raw_score)
  values ('ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-00000000000b', 99);
  raise exception 'FAIL: scored a learner not enrolled in the assessment''s class';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  raise notice 'pass: cannot score a learner outside the assessment''s class';
end; $$;

-- Observation-based entry for lower primary
insert into scores (assessment_id, student_id, is_direct_level, level_code)
values ('ffffffff-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-00000000000c', true, 'ME');
select assert_eq(
  (select level_code from scores where student_id = 'eeeeeeee-0000-0000-0000-00000000000c'),
  'ME', 'direct level entry preserved for lower primary');
select assert_eq(
  (select percentage from scores where student_id = 'eeeeeeee-0000-0000-0000-00000000000c'),
  null::numeric, 'direct level entry has no percentage');

-- A level from the wrong scale must be rejected
do $$
begin
  insert into scores (assessment_id, student_id, is_direct_level, level_code)
  values ('ffffffff-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-00000000000a', true, 'EE1');
  raise exception 'FAIL: eight-point level accepted on a four-point class';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  raise notice 'pass: eight-point level rejected on a four-point class';
end; $$;

-- A mark above the maximum must be rejected
do $$
begin
  update scores set raw_score = 150
   where student_id = 'eeeeeeee-0000-0000-0000-00000000000a'
     and assessment_id = 'ffffffff-0000-0000-0000-000000000001';
  raise exception 'FAIL: score above max_score accepted';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  raise notice 'pass: score above max_score rejected';
end; $$;

-- =============================================================================
-- 3. Row Level Security
-- =============================================================================

create or replace function as_user(p_uid text)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid, false);
end; $$;

-- Draft report card for Child A
insert into report_cards (student_id, term_id, class_id, status)
values ('eeeeeeee-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-000000000001',
        'cccccccc-0000-0000-0000-000000000007', 'draft');

insert into fee_balances (student_id, balance_kes, as_of)
values ('eeeeeeee-0000-0000-0000-00000000000a', 4500, current_date);

-- ---- Parent A ----------------------------------------------------------------
set role authenticated;
select as_user('11111111-1111-1111-1111-111111111111');

select assert_eq((select count(*)::int from students), 1,
  'Parent A sees exactly one student');
select assert_eq((select admission_no from students), 'GS001',
  'Parent A sees only their own child');
select assert_eq(
  (select count(*)::int from students where id = 'eeeeeeee-0000-0000-0000-00000000000b'), 0,
  'Parent A cannot read another family''s child');

-- The release gate
select assert_eq((select count(*)::int from scores), 0,
  'Parent A cannot see marks while the report card is draft');
select assert_eq((select count(*)::int from report_cards), 0,
  'Parent A cannot see a draft report card');

select assert_eq((select count(*)::int from fee_balances), 1,
  'Parent A sees their own fee balance');

-- Privilege escalation attempt
do $$
begin
  update profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';
  raise exception 'FAIL: parent escalated themselves to admin';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  raise notice 'pass: parent cannot escalate their own role';
end; $$;

reset role;

-- ---- Release the results ----------------------------------------------------
set role authenticated;
select as_user('55555555-5555-5555-5555-555555555555');   -- admin WITHOUT permission
do $$
begin
  update report_cards set status = 'released'
   where student_id = 'eeeeeeee-0000-0000-0000-00000000000a';
  raise exception 'FAIL: admin without can_release_results published results';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  raise notice 'pass: admin without release permission cannot publish results';
end; $$;
reset role;

set role authenticated;
select as_user('66666666-6666-6666-6666-666666666666');   -- headteacher WITH permission
update report_cards set status = 'released'
 where student_id = 'eeeeeeee-0000-0000-0000-00000000000a';
select assert_eq(
  (select released_by from report_cards where student_id = 'eeeeeeee-0000-0000-0000-00000000000a'),
  '66666666-6666-6666-6666-666666666666'::uuid,
  'release stamps released_by automatically');
reset role;

-- A teacher must not be able to sidestep the gate by INSERTing a report card
-- that is already released. The guard covers insert as well as update.
set role authenticated;
select as_user('33333333-3333-3333-3333-333333333333');   -- G7 teacher, no release permission
do $$
begin
  insert into report_cards (student_id, term_id, class_id, status)
  values ('eeeeeeee-0000-0000-0000-00000000000d', 'bbbbbbbb-0000-0000-0000-000000000001',
          'cccccccc-0000-0000-0000-000000000007', 'released');
  raise exception 'FAIL: teacher published results by inserting an already-released card';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  raise notice 'pass: cannot publish results by inserting an already-released card';
end; $$;
reset role;

-- ---- Parent A after release --------------------------------------------------
set role authenticated;
select as_user('11111111-1111-1111-1111-111111111111');
select assert_eq((select count(*)::int from scores), 1,
  'Parent A sees marks once results are released');
select assert_eq((select count(*)::int from report_cards), 1,
  'Parent A sees the released report card');
reset role;

-- ---- Parent B ----------------------------------------------------------------
set role authenticated;
select as_user('22222222-2222-2222-2222-222222222222');
select assert_eq((select count(*)::int from scores), 0,
  'Parent B sees no marks belonging to another family after their release');
select assert_eq((select count(*)::int from fee_balances), 0,
  'Parent B cannot read another family''s fee balance');
select assert_eq((select count(*)::int from students), 1,
  'Parent B sees only their own child');
reset role;

-- ---- Teachers ----------------------------------------------------------------
set role authenticated;
select as_user('33333333-3333-3333-3333-333333333333');   -- teaches G7
select assert_eq((select count(*)::int from students), 2,
  'G7 teacher sees exactly the two learners in their own class');
select assert_eq((select count(*)::int from students where admission_no in ('GS001','GS004')), 2,
  'G7 teacher sees the right learners');
select assert_eq((select count(*)::int from scores), 2,
  'G7 teacher sees marks for their class regardless of release state');
select assert_eq((select count(*)::int from fee_balances), 0,
  'teachers cannot see family fee balances');
reset role;

set role authenticated;
select as_user('44444444-4444-4444-4444-444444444444');   -- teaches G4 and G2
select assert_eq(
  (select count(*)::int from students where admission_no = 'GS001'), 0,
  'G4 teacher cannot read a G7 learner');
select assert_eq((select count(*)::int from scores where student_id = 'eeeeeeee-0000-0000-0000-00000000000a'), 0,
  'G4 teacher cannot read G7 marks');
reset role;

-- ---- Admin -------------------------------------------------------------------
set role authenticated;
select as_user('55555555-5555-5555-5555-555555555555');
select assert_eq((select count(*)::int from students), 4, 'admin sees all learners');
select assert_eq((select count(*)::int from audit_log) > 0, true, 'admin can read the audit log');
reset role;

-- ---- Anonymous ---------------------------------------------------------------
set role authenticated;
select as_user('00000000-0000-0000-0000-000000000000');   -- no profile row
select assert_eq((select count(*)::int from students), 0, 'unknown user sees nothing');
select assert_eq((select count(*)::int from scores), 0, 'unknown user sees no marks');
reset role;
select as_user('');   -- clear the impersonation before the remaining fixtures

-- =============================================================================
-- 4. Audit trail
-- =============================================================================

select assert_eq(
  (select count(*)::int from audit_log where entity_type = 'scores' and action = 'insert') >= 1,
  true, 'score inserts are audited');
select assert_eq(
  (select count(*)::int from audit_log where entity_type = 'report_cards' and action = 'update') >= 1,
  true, 'report card release is audited');

-- =============================================================================
-- 5. Termly aggregation
-- =============================================================================

insert into assessments (id, class_id, subject_id, term_id, name, max_score, weight)
values ('ffffffff-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000007',
        'dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
        'Mid Term Maths', 100, 1);
insert into scores (assessment_id, student_id, raw_score)
values ('ffffffff-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-00000000000a', 60);

select assert_eq(
  (select percentage from termly_subject_results
    where student_id = 'eeeeeeee-0000-0000-0000-00000000000a'),
  71.00::numeric, 'termly average of 82 and 60 is 71.00');
select assert_eq(
  (select level_code from termly_subject_results
    where student_id = 'eeeeeeee-0000-0000-0000-00000000000a'),
  'ME1', 'termly average 71 maps to ME1');

-- Observation-based band aggregates by level, not by mark
select assert_eq(
  (select level_code from termly_subject_results
    where student_id = 'eeeeeeee-0000-0000-0000-00000000000c'),
  'ME', 'lower primary termly result aggregates observed levels');

-- =============================================================================
-- 6. Submission rules
-- =============================================================================

insert into assignments (id, class_id, subject_id, term_id, title, submission_expected, is_published)
values ('99999999-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000007',
        'dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
        'Build a model bridge', true, true);
insert into submissions (id, assignment_id, student_id)
values ('88888888-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001',
        'eeeeeeee-0000-0000-0000-00000000000a');

insert into submission_files (submission_id, storage_key, file_name, mime_type, size_bytes)
values ('88888888-0000-0000-0000-000000000001', 'k1', 'a.jpg', 'image/jpeg', 100),
       ('88888888-0000-0000-0000-000000000001', 'k2', 'b.jpg', 'image/jpeg', 100),
       ('88888888-0000-0000-0000-000000000001', 'k3', 'c.jpg', 'image/jpeg', 100);

select assert_eq(
  (select status::text from submissions where id = '88888888-0000-0000-0000-000000000001'),
  'submitted', 'first photo moves submission to submitted');

do $$
begin
  insert into submission_files (submission_id, storage_key, file_name, mime_type, size_bytes)
  values ('88888888-0000-0000-0000-000000000001', 'k4', 'd.jpg', 'image/jpeg', 100);
  raise exception 'FAIL: fourth photo accepted';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  raise notice 'pass: photo cap of 3 enforced in the database';
end; $$;

do $$
begin
  insert into submission_files (submission_id, storage_key, file_name, mime_type, size_bytes)
  values ('88888888-0000-0000-0000-000000000001', 'v1', 'clip.mp4', 'video/mp4', 100);
  raise exception 'FAIL: video accepted';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  raise notice 'pass: video mime types rejected';
end; $$;

-- Guardians may not grade their own child's work
set role authenticated;
select as_user('11111111-1111-1111-1111-111111111111');
do $$
begin
  insert into submission_grades (submission_id, percentage, comment)
  values ('88888888-0000-0000-0000-000000000001', 100, 'A+ from mum');
  raise exception 'FAIL: guardian graded their own child';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  raise notice 'pass: guardians cannot grade submissions';
end; $$;
reset role;

select 'ALL TESTS PASSED' as result;
