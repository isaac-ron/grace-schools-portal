-- =============================================================================
-- 0002_core.sql
-- Core schema: people, structure, academics, attendance, assignments.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Academic calendar
-- -----------------------------------------------------------------------------

create table academic_years (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,          -- e.g. '2026'
  starts_on  date not null,
  ends_on    date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_years_dates check (ends_on > starts_on)
);

-- Exactly one current year at a time.
create unique index academic_years_one_current
  on academic_years ((is_current)) where is_current;

create table terms (
  id               uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  name             text not null,           -- e.g. 'Term 1'
  term_number      smallint not null check (term_number between 1 and 3),
  starts_on        date not null,
  ends_on          date not null,
  is_current       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (academic_year_id, term_number),
  constraint terms_dates check (ends_on > starts_on)
);

create unique index terms_one_current on terms ((is_current)) where is_current;

-- -----------------------------------------------------------------------------
-- People
--
-- profiles extends auth.users. Accounts are always admin-provisioned: there is
-- no self-registration path, because it would let anyone claim to be the parent
-- of any child.
-- -----------------------------------------------------------------------------

create table profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  role                 user_role not null,
  full_name            text not null,
  phone                text,
  email                text,
  -- The results release gate (requirement 7). A permission, not a role.
  -- Only meaningful on admins; enforced by a check below.
  can_release_results  boolean not null default false,
  is_active            boolean not null default true,
  must_change_password boolean not null default true,
  last_seen_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint profiles_release_requires_admin
    check (not can_release_results or role = 'admin')
);

create index profiles_role_idx on profiles (role) where is_active;

create table students (
  id           uuid primary key default gen_random_uuid(),
  admission_no text not null unique,
  first_name   text not null,
  middle_name  text,
  last_name    text not null,
  date_of_birth date,
  gender       text check (gender in ('male', 'female')),
  photo_key    text,                        -- object key in R2, never a public URL
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index students_active_idx on students (last_name, first_name) where is_active;

-- Many-to-many so siblings resolve from one family account, and so a learner
-- can have more than one contactable guardian.
create table guardian_students (
  guardian_id  uuid not null references profiles(id) on delete cascade,
  student_id   uuid not null references students(id) on delete cascade,
  relationship guardian_relationship not null default 'guardian',
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  primary key (guardian_id, student_id)
);

create index guardian_students_student_idx on guardian_students (student_id);

-- -----------------------------------------------------------------------------
-- Classes and subjects
-- -----------------------------------------------------------------------------

create table classes (
  id               uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  grade_code       text not null references grade_levels(code),
  stream           text,                     -- 'East', 'West', or null for a single stream
  class_teacher_id uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (academic_year_id, grade_code, stream)
);

create index classes_year_idx on classes (academic_year_id);

create table subjects (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  sort_order smallint not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Which learning areas apply to which grade. CBE subject lists differ by band,
-- so this is a join rather than a column on subjects.
create table subject_grade_levels (
  subject_id uuid not null references subjects(id) on delete cascade,
  grade_code text not null references grade_levels(code) on delete cascade,
  primary key (subject_id, grade_code)
);

create table enrollments (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references students(id) on delete cascade,
  class_id         uuid not null references classes(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  enrolled_on      date not null default current_date,
  created_at       timestamptz not null default now(),
  -- A learner sits in exactly one class per academic year.
  unique (student_id, academic_year_id)
);

create index enrollments_class_idx on enrollments (class_id);

-- A teacher's reach. Every teacher-facing policy resolves through this table,
-- so a teacher can only ever see the classes they are actually assigned to.
create table staff_class_assignments (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references profiles(id) on delete cascade,
  class_id   uuid not null references classes(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (staff_id, class_id, subject_id)
);

create index staff_class_assignments_staff_idx on staff_class_assignments (staff_id);
create index staff_class_assignments_class_idx on staff_class_assignments (class_id);

-- -----------------------------------------------------------------------------
-- Academics
-- -----------------------------------------------------------------------------

create table assessments (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references classes(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  term_id    uuid not null references terms(id) on delete cascade,
  name       text not null,
  type       assessment_type not null default 'classwork',
  max_score  numeric(6,2) not null default 100 check (max_score > 0),
  -- Weight toward the termly subject result. Assessments in a subject/term
  -- are averaged by weight; equal weights give a simple mean.
  weight     numeric(5,2) not null default 1 check (weight >= 0),
  taken_on   date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assessments_class_term_idx on assessments (class_id, term_id);

create table scores (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  student_id    uuid not null references students(id) on delete cascade,
  -- NULL means not assessed. Distinct from a stored 0, which means attempted
  -- and scored nothing. See the note in 0001 on why this distinction matters.
  raw_score     numeric(6,2) check (raw_score >= 0),
  -- Both derived by trigger in 0003. Stored so report cards stay reproducible
  -- even if a band is ever revised.
  percentage    numeric(5,2),
  level_code    text,
  -- Set directly by the teacher for PP1..Grade 3, where CBE intends observation
  -- rather than marks. Mutually exclusive with raw_score.
  is_direct_level boolean not null default false,
  comment       text,
  entered_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (assessment_id, student_id),
  constraint scores_entry_mode_exclusive
    check (not (is_direct_level and raw_score is not null))
);

create index scores_student_idx on scores (student_id);

create table report_cards (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references students(id) on delete cascade,
  term_id             uuid not null references terms(id) on delete cascade,
  class_id            uuid not null references classes(id) on delete cascade,
  status              report_status not null default 'draft',
  class_teacher_remark text,
  head_remark         text,
  released_by         uuid references profiles(id) on delete set null,
  released_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (student_id, term_id),
  constraint report_cards_release_fields
    check ((status = 'released') = (released_at is not null))
);

create index report_cards_term_status_idx on report_cards (term_id, status);

-- -----------------------------------------------------------------------------
-- Attendance
-- -----------------------------------------------------------------------------

create table attendance_sessions (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references classes(id) on delete cascade,
  session_date date not null,
  taken_by     uuid references profiles(id) on delete set null,
  taken_at     timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (class_id, session_date)
);

create index attendance_sessions_date_idx on attendance_sessions (session_date);

create table attendance_records (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references attendance_sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  status     attendance_status not null default 'present',
  reason     absence_reason,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id),
  -- A reason only makes sense for an absence.
  constraint attendance_reason_only_when_absent
    check (reason is null or status = 'absent')
);

create index attendance_records_student_idx on attendance_records (student_id);

-- -----------------------------------------------------------------------------
-- Assignments, materials and submissions
--
-- An assignment with submission_expected = false IS a material (requirement 3).
-- Same table, same plumbing, one boolean.
-- -----------------------------------------------------------------------------

create table assignments (
  id                 uuid primary key default gen_random_uuid(),
  class_id           uuid not null references classes(id) on delete cascade,
  subject_id         uuid references subjects(id) on delete set null,
  term_id            uuid not null references terms(id) on delete cascade,
  title              text not null,
  instructions       text,
  -- Materials are pinned to the day they are for; assignments use due_at.
  posted_for         date not null default current_date,
  due_at             timestamptz,
  submission_expected boolean not null default true,
  is_published       boolean not null default false,
  created_by         uuid references profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint assignments_due_only_when_expected
    check (due_at is null or submission_expected)
);

create index assignments_class_posted_idx on assignments (class_id, posted_for desc);

-- Teacher-attached reference files (worksheets, notes).
create table assignment_files (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  storage_key   text not null unique,
  file_name     text not null,
  mime_type     text not null,
  size_bytes    integer not null check (size_bytes > 0),
  uploaded_by   uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  student_id    uuid not null references students(id) on delete cascade,
  status        submission_status not null default 'pending',
  submitted_at  timestamptz,
  -- The guardian account that performed the upload, for accountability.
  submitted_by  uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create index submissions_assignment_idx on submissions (assignment_id);
create index submissions_student_idx on submissions (student_id);

-- Photos only. Video is not supported anywhere in this system: not capped,
-- not configurable, not a feature flag. See PORTAL_SCOPE.md section 6.
create table submission_files (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  storage_key   text not null unique,
  file_name     text not null,
  mime_type     text not null,
  size_bytes    integer not null check (size_bytes > 0),
  width         integer,
  height        integer,
  caption       text,
  -- Set when the two-term retention job purges the object from R2. The row is
  -- kept so the graded record still shows a photo existed and was removed by
  -- policy, rather than silently vanishing.
  purged_at     timestamptz,
  created_at    timestamptz not null default now(),
  constraint submission_files_images_only
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp'))
);

create index submission_files_submission_idx on submission_files (submission_id);
create index submission_files_retention_idx on submission_files (created_at) where purged_at is null;

create table submission_grades (
  submission_id uuid primary key references submissions(id) on delete cascade,
  percentage    numeric(5,2) check (percentage >= 0 and percentage <= 100),
  level_code    text,
  comment       text,
  graded_by     uuid references profiles(id) on delete set null,
  graded_at     timestamptz not null default now(),
  returned_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Notices, fees, audit
-- -----------------------------------------------------------------------------

create table notices (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text not null,
  audience     notice_audience not null default 'all_parents',
  class_id     uuid references classes(id) on delete cascade,
  published_at timestamptz,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint notices_class_required_for_single_class
    check ((audience = 'single_class') = (class_id is not null))
);

create index notices_published_idx on notices (published_at desc) where published_at is not null;

-- Display only. A snapshot uploaded by the bursar from whatever system they
-- already use, shown to parents with as_of so a stale figure is never mistaken
-- for a live one.
create table fee_balances (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  balance_kes numeric(12,2) not null,
  as_of       date not null,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (student_id, as_of)
);

create index fee_balances_student_idx on fee_balances (student_id, as_of desc);

-- Deliberately no foreign key on actor_id.
--
-- Two reasons. An audit insert must never be able to block the operation it is
-- recording, which an FK violation would do. And attribution must survive the
-- actor: `on delete set null` would quietly erase who changed a mark the moment
-- their account was removed, which is exactly when the record matters most.
create table audit_log (
  id          bigserial primary key,
  actor_id    uuid,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_entity_idx on audit_log (entity_type, entity_id, created_at desc);
create index audit_log_actor_idx on audit_log (actor_id, created_at desc);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'academic_years', 'terms', 'profiles', 'students', 'classes', 'subjects',
    'assessments', 'scores', 'report_cards', 'attendance_sessions',
    'attendance_records', 'assignments', 'submissions', 'submission_grades',
    'notices'
  ]
  loop
    execute format(
      'create trigger %I_set_updated_at before update on %I
         for each row execute function set_updated_at()',
      t, t
    );
  end loop;
end;
$$;
