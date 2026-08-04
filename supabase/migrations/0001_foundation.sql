-- =============================================================================
-- 0001_foundation.sql
-- Extensions, enums, shared utilities, and the CBE grade-level reference data.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

-- Four roles. "Headteacher" is not a role: it is an admin holding the
-- can_release_results permission (see profiles). The scope document rejects
-- modelling the results gate as a separate person-shaped role.
create type user_role as enum ('parent', 'teacher', 'admin');

create type guardian_relationship as enum ('mother', 'father', 'guardian', 'other');

create type attendance_status as enum ('present', 'absent', 'late');

-- Absence reason is only meaningful when status = 'absent'.
create type absence_reason as enum ('sick', 'permission', 'unexplained');

create type assessment_type as enum ('classwork', 'project', 'midterm', 'endterm');

create type report_status as enum ('draft', 'released');

create type submission_status as enum ('pending', 'submitted', 'graded', 'returned');

create type notice_audience as enum ('all_parents', 'single_class', 'all_staff');

-- How a teacher records achievement for a grade band.
--   'level'      -> teacher picks EE/ME/AE/BE directly from observation (CBE intent)
--   'percentage' -> teacher enters a mark, the level is derived
create type entry_mode as enum ('level', 'percentage');

-- Which CBE scale applies.
--   'four_point'  -> EE / ME / AE / BE            (PP1 .. Grade 6)
--   'eight_point' -> EE1..BE2, achievement levels 8..1 (Grade 7 .. 9, per KNEC)
create type grading_scale as enum ('four_point', 'eight_point');

-- -----------------------------------------------------------------------------
-- Shared utilities
-- -----------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grade levels
--
-- Reference data, not user-managed. Drives which CBE scale and which mark-entry
-- mode applies, so the correct grading behaviour is selected automatically from
-- the learner's class rather than configured per teacher.
-- -----------------------------------------------------------------------------

create table grade_levels (
  code               text primary key,
  label              text        not null,
  sort_order         smallint    not null unique,
  band               text        not null,
  scale              grading_scale not null,
  default_entry_mode entry_mode  not null
);

comment on table grade_levels is
  'Reference data for PP1..Grade 9. Determines CBE scale and mark entry mode per band.';

insert into grade_levels (code, label, sort_order, band, scale, default_entry_mode) values
  ('PP1', 'Pre-Primary 1', 1,  'pre_primary',   'four_point',  'level'),
  ('PP2', 'Pre-Primary 2', 2,  'pre_primary',   'four_point',  'level'),
  ('G1',  'Grade 1',       3,  'lower_primary', 'four_point',  'level'),
  ('G2',  'Grade 2',       4,  'lower_primary', 'four_point',  'level'),
  ('G3',  'Grade 3',       5,  'lower_primary', 'four_point',  'level'),
  ('G4',  'Grade 4',       6,  'upper_primary', 'four_point',  'percentage'),
  ('G5',  'Grade 5',       7,  'upper_primary', 'four_point',  'percentage'),
  ('G6',  'Grade 6',       8,  'upper_primary', 'four_point',  'percentage'),
  ('G7',  'Grade 7',       9,  'junior_school', 'eight_point', 'percentage'),
  ('G8',  'Grade 8',       10, 'junior_school', 'eight_point', 'percentage'),
  ('G9',  'Grade 9',       11, 'junior_school', 'eight_point', 'percentage');

-- -----------------------------------------------------------------------------
-- CBE achievement levels
--
-- Percentage bands are the published KNEC scale. Sources are recorded in
-- PORTAL_SCOPE.md. Bands are contiguous, so mapping is a simple lookup.
--
-- Two deliberate decisions encoded here:
--
--   1. BE2 is stored as 0..10 although KNEC publishes 1..10. A genuine scored
--      zero has to map somewhere, and "Minimal" is the correct place for it.
--      The published table starts at 1 because it assumes a non-zero attempt.
--
--   2. "Not assessed" is NOT a level. A learner absent from an assessment has
--      a NULL score and therefore no level at all. Recording them as BE2 would
--      permanently misrepresent them on a document parents keep. This is why
--      scores.raw_score is nullable and distinct from a stored zero.
-- -----------------------------------------------------------------------------

create table achievement_levels (
  scale       grading_scale not null,
  code        text          not null,
  label       text          not null,
  descriptor  text          not null,
  points      smallint,               -- null on the four-point scale, which is unpointed
  min_percent smallint      not null,
  max_percent smallint      not null,
  sort_order  smallint      not null,
  primary key (scale, code),
  constraint achievement_levels_band_valid check (min_percent <= max_percent)
);

insert into achievement_levels
  (scale, code, label, descriptor, points, min_percent, max_percent, sort_order) values
  -- Junior School, Grades 7 to 9
  ('eight_point', 'EE1', 'Exceeding Expectations 1',   'Exceptional',          8, 90, 100, 8),
  ('eight_point', 'EE2', 'Exceeding Expectations 2',   'Very Good',            7, 75,  89, 7),
  ('eight_point', 'ME1', 'Meeting Expectations 1',     'Good',                 6, 58,  74, 6),
  ('eight_point', 'ME2', 'Meeting Expectations 2',     'Fair',                 5, 41,  57, 5),
  ('eight_point', 'AE1', 'Approaching Expectations 1', 'Needs Improvement',    4, 31,  40, 4),
  ('eight_point', 'AE2', 'Approaching Expectations 2', 'Below Average',        3, 21,  30, 3),
  ('eight_point', 'BE1', 'Below Expectations 1',       'Well Below Average',   2, 11,  20, 2),
  ('eight_point', 'BE2', 'Below Expectations 2',       'Minimal',              1,  0,  10, 1),
  -- Pre-Primary through Grade 6
  ('four_point',  'EE',  'Exceeding Expectations',     'Exceeding Expectations',  null, 75, 100, 4),
  ('four_point',  'ME',  'Meeting Expectations',       'Meeting Expectations',    null, 41,  74, 3),
  ('four_point',  'AE',  'Approaching Expectations',   'Approaching Expectations',null, 21,  40, 2),
  ('four_point',  'BE',  'Below Expectations',         'Below Expectations',      null,  0,  20, 1);

-- -----------------------------------------------------------------------------
-- Percentage to achievement level
--
-- Rounds half-up to a whole percent before banding, so a 74.5 resolves
-- predictably rather than falling between the published 58-74 and 75-89 bands.
-- Returns NULL for a NULL input, which is the "not assessed" case.
-- -----------------------------------------------------------------------------

create or replace function cbe_level(p_percent numeric, p_scale grading_scale)
returns text
language sql
immutable
as $$
  select l.code
  from achievement_levels l
  where l.scale = p_scale
    and p_percent is not null
    and round(p_percent)::int between l.min_percent and l.max_percent
  limit 1;
$$;

comment on function cbe_level is
  'Maps a percentage to a CBE achievement level code for the given scale. NULL percent means not assessed and yields NULL, never the bottom grade.';
