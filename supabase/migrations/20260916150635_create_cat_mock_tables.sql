/*
# CAT Mock Test Platform — Tables Only

Creates all 10 tables for the CAT mock test platform.
Policies and triggers are applied in a follow-up migration.

## New Tables
1. profiles — extends auth.users with role (student/admin)
2. mocks — test definitions with per-section durations
3. mock_access — admin-assigned student access
4. question_sets — RC passages / DILR data sets
5. questions — MCQ/TITA questions with correct answers
6. grading_sheets — raw marks → percentile/grade lookup
7. attempts — one per student per mock, timer/session state
8. responses — student answers per question
9. violations — proctoring log
10. attempt_results — frozen snapshot at submission
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS mocks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  is_published boolean not null default false,
  section_duration_varc integer not null default 2400,
  section_duration_dilr integer not null default 2400,
  section_duration_qa integer not null default 2400,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS mock_access (
  id uuid primary key default gen_random_uuid(),
  mock_id uuid not null references mocks(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  granted_at timestamptz not null default now(),
  unique (mock_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_mock_access_student ON mock_access(student_id);

CREATE TABLE IF NOT EXISTS question_sets (
  id uuid primary key default gen_random_uuid(),
  mock_id uuid not null references mocks(id) on delete cascade,
  section text not null check (section in ('VARC','DILR','QA')),
  passage_text text,
  passage_image_url text,
  display_order integer not null default 0
);

CREATE TABLE IF NOT EXISTS questions (
  id uuid primary key default gen_random_uuid(),
  mock_id uuid not null references mocks(id) on delete cascade,
  set_id uuid references question_sets(id) on delete set null,
  section text not null check (section in ('VARC','DILR','QA')),
  display_order integer not null,
  question_type text not null check (question_type in ('MCQ','TITA')),
  question_text text not null,
  image_url text,
  options jsonb,
  correct_answer text not null,
  answer_tolerance numeric not null default 0,
  marks numeric not null default 3,
  negative_marks numeric not null default 1,
  difficulty text check (difficulty in ('easy','medium','hard')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_questions_mock_section ON questions(mock_id, section, display_order);

CREATE TABLE IF NOT EXISTS grading_sheets (
  id uuid primary key default gen_random_uuid(),
  mock_id uuid not null references mocks(id) on delete cascade,
  scope text not null check (scope in ('overall','VARC','DILR','QA')),
  raw_marks numeric not null,
  percentile numeric,
  grade text,
  unique (mock_id, scope, raw_marks)
);

CREATE INDEX IF NOT EXISTS idx_grading_sheets_lookup ON grading_sheets(mock_id, scope, raw_marks);

CREATE TABLE IF NOT EXISTS attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  mock_id uuid not null references mocks(id) on delete cascade,
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','paused','submitted')),
  current_section text check (current_section in ('VARC','DILR','QA')),
  active_session_id uuid,
  section_started_at timestamptz,
  section_ends_at timestamptz,
  paused_at timestamptz,
  last_heartbeat_at timestamptz,
  total_paused_seconds integer not null default 0,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, mock_id)
);

CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_deadline ON attempts(status, section_ends_at, last_heartbeat_at);

CREATE TABLE IF NOT EXISTS responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references attempts(id) on delete cascade,
  question_id uuid not null references questions(id),
  selected_answer text,
  is_marked_for_review boolean not null default false,
  is_visited boolean not null default false,
  time_spent_seconds integer not null default 0,
  is_correct boolean,
  marks_awarded numeric,
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_responses_attempt ON responses(attempt_id);

CREATE TABLE IF NOT EXISTS violations (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references attempts(id) on delete cascade,
  type text not null check (type in ('tab_switch','fullscreen_exit','right_click','copy_paste','other')),
  section text,
  occurred_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_violations_attempt ON violations(attempt_id);

CREATE TABLE IF NOT EXISTS attempt_results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references attempts(id) on delete cascade,
  overall_raw_marks numeric not null,
  overall_percentile numeric,
  overall_grade text,
  varc_raw_marks numeric, varc_percentile numeric,
  dilr_raw_marks numeric, dilr_percentile numeric,
  qa_raw_marks numeric, qa_percentile numeric,
  accuracy_overall numeric,
  computed_at timestamptz not null default now()
);