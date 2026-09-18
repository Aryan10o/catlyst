/*
# CAT Mock Test Platform — RLS Policies, Triggers, and Functions

## Security
Enables RLS on all 10 tables and creates ownership-scoped policies.
Students see only their own data; admins see all.
Question access is gated by attempt status and current unlocked section.

## Triggers
- on_auth_user_created: auto-creates profile row on signup (role='student')
- mocks_updated_at / questions_updated_at: auto-updates updated_at

## Functions
- handle_new_user: trigger function for profile creation
- update_updated_at_column: trigger function for updated_at
- get_percentile: interpolates percentile from grading_sheets
*/

-- ═══════════════════════════════════════════
-- ENABLE RLS ON ALL TABLES
-- ═══════════════════════════════════════════
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempt_results ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════
-- PROFILES POLICIES
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "admin_select_all_profiles" ON profiles;
CREATE POLICY "admin_select_all_profiles" ON profiles FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ═══════════════════════════════════════════
-- MOCKS POLICIES
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "student_select_published_mocks" ON mocks;
CREATE POLICY "student_select_published_mocks" ON mocks FOR SELECT
  TO authenticated USING (
    is_published = true
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_insert_mocks" ON mocks;
CREATE POLICY "admin_insert_mocks" ON mocks FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_update_mocks" ON mocks;
CREATE POLICY "admin_update_mocks" ON mocks FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_delete_mocks" ON mocks;
CREATE POLICY "admin_delete_mocks" ON mocks FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ═══════════════════════════════════════════
-- MOCK ACCESS POLICIES
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "student_select_own_mock_access" ON mock_access;
CREATE POLICY "student_select_own_mock_access" ON mock_access FOR SELECT
  TO authenticated USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "admin_select_all_mock_access" ON mock_access;
CREATE POLICY "admin_select_all_mock_access" ON mock_access FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_insert_mock_access" ON mock_access;
CREATE POLICY "admin_insert_mock_access" ON mock_access FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_delete_mock_access" ON mock_access;
CREATE POLICY "admin_delete_mock_access" ON mock_access FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ═══════════════════════════════════════════
-- QUESTION SETS POLICIES
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "student_select_unlocked_question_sets" ON question_sets;
CREATE POLICY "student_select_unlocked_question_sets" ON question_sets FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM attempts a
      WHERE a.mock_id = question_sets.mock_id
        AND a.student_id = auth.uid()
        AND a.status IN ('in_progress','paused','submitted')
        AND (
          a.status = 'submitted'
          OR question_sets.section = a.current_section
        )
    )
  );

DROP POLICY IF EXISTS "admin_select_all_question_sets" ON question_sets;
CREATE POLICY "admin_select_all_question_sets" ON question_sets FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_insert_question_sets" ON question_sets;
CREATE POLICY "admin_insert_question_sets" ON question_sets FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_update_question_sets" ON question_sets;
CREATE POLICY "admin_update_question_sets" ON question_sets FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_delete_question_sets" ON question_sets;
CREATE POLICY "admin_delete_question_sets" ON question_sets FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ═══════════════════════════════════════════
-- QUESTIONS POLICIES
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "student_select_unlocked_questions" ON questions;
CREATE POLICY "student_select_unlocked_questions" ON questions FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM attempts a
      WHERE a.mock_id = questions.mock_id
        AND a.student_id = auth.uid()
        AND a.status IN ('in_progress','paused','submitted')
        AND (
          a.status = 'submitted'
          OR questions.section = a.current_section
        )
    )
  );

DROP POLICY IF EXISTS "admin_select_all_questions" ON questions;
CREATE POLICY "admin_select_all_questions" ON questions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_insert_questions" ON questions;
CREATE POLICY "admin_insert_questions" ON questions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_update_questions" ON questions;
CREATE POLICY "admin_update_questions" ON questions FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_delete_questions" ON questions;
CREATE POLICY "admin_delete_questions" ON questions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ═══════════════════════════════════════════
-- GRADING SHEETS POLICIES
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "admin_select_grading_sheets" ON grading_sheets;
CREATE POLICY "admin_select_grading_sheets" ON grading_sheets FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_insert_grading_sheets" ON grading_sheets;
CREATE POLICY "admin_insert_grading_sheets" ON grading_sheets FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_update_grading_sheets" ON grading_sheets;
CREATE POLICY "admin_update_grading_sheets" ON grading_sheets FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_delete_grading_sheets" ON grading_sheets;
CREATE POLICY "admin_delete_grading_sheets" ON grading_sheets FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ═══════════════════════════════════════════
-- ATTEMPTS POLICIES
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "student_select_own_attempts" ON attempts;
CREATE POLICY "student_select_own_attempts" ON attempts FOR SELECT
  TO authenticated USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "student_insert_own_attempts" ON attempts;
CREATE POLICY "student_insert_own_attempts" ON attempts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "admin_select_all_attempts" ON attempts;
CREATE POLICY "admin_select_all_attempts" ON attempts FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ═══════════════════════════════════════════
-- RESPONSES POLICIES
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "student_select_own_responses" ON responses;
CREATE POLICY "student_select_own_responses" ON responses FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM attempts a WHERE a.id = responses.attempt_id AND a.student_id = auth.uid())
  );

DROP POLICY IF EXISTS "student_insert_own_responses" ON responses;
CREATE POLICY "student_insert_own_responses" ON responses FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM attempts a WHERE a.id = responses.attempt_id AND a.student_id = auth.uid())
  );

DROP POLICY IF EXISTS "student_update_own_responses" ON responses;
CREATE POLICY "student_update_own_responses" ON responses FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM attempts a WHERE a.id = responses.attempt_id AND a.student_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM attempts a WHERE a.id = responses.attempt_id AND a.student_id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_select_all_responses" ON responses;
CREATE POLICY "admin_select_all_responses" ON responses FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ═══════════════════════════════════════════
-- VIOLATIONS POLICIES
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "student_insert_own_violations" ON violations;
CREATE POLICY "student_insert_own_violations" ON violations FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM attempts a WHERE a.id = violations.attempt_id AND a.student_id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_select_all_violations" ON violations;
CREATE POLICY "admin_select_all_violations" ON violations FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ═══════════════════════════════════════════
-- ATTEMPT RESULTS POLICIES
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "student_select_own_results" ON attempt_results;
CREATE POLICY "student_select_own_results" ON attempt_results FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM attempts a WHERE a.id = attempt_results.attempt_id AND a.student_id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_select_all_results" ON attempt_results;
CREATE POLICY "admin_select_all_results" ON attempt_results FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ═══════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email) VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mocks_updated_at ON mocks;
CREATE TRIGGER mocks_updated_at BEFORE UPDATE ON mocks
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS questions_updated_at ON questions;
CREATE TRIGGER questions_updated_at BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ═══════════════════════════════════════════
-- PERCENTILE FUNCTION
-- ═══════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_percentile(p_mock_id uuid, p_scope text, p_raw_marks numeric)
RETURNS numeric AS $$
DECLARE
  v_lower_percentile numeric;
  v_upper_percentile numeric;
  v_lower_marks numeric;
  v_upper_marks numeric;
  v_result numeric;
  v_count integer;
BEGIN
  SELECT percentile INTO v_result
  FROM grading_sheets
  WHERE mock_id = p_mock_id AND scope = p_scope AND raw_marks = p_raw_marks
  LIMIT 1;

  IF v_result IS NOT NULL THEN
    RETURN v_result;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM grading_sheets
  WHERE mock_id = p_mock_id AND scope = p_scope;

  IF v_count = 0 THEN
    RETURN NULL;
  END IF;

  SELECT raw_marks, percentile INTO v_upper_marks, v_upper_percentile
  FROM grading_sheets
  WHERE mock_id = p_mock_id AND scope = p_scope AND raw_marks >= p_raw_marks
  ORDER BY raw_marks ASC LIMIT 1;

  SELECT raw_marks, percentile INTO v_lower_marks, v_lower_percentile
  FROM grading_sheets
  WHERE mock_id = p_mock_id AND scope = p_scope AND raw_marks < p_raw_marks
  ORDER BY raw_marks DESC LIMIT 1;

  IF v_upper_marks IS NULL AND v_lower_marks IS NOT NULL THEN
    RETURN v_lower_percentile;
  END IF;
  IF v_lower_marks IS NULL AND v_upper_marks IS NOT NULL THEN
    RETURN v_upper_percentile;
  END IF;
  IF v_lower_marks IS NULL AND v_upper_marks IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_lower_percentile + (v_upper_percentile - v_lower_percentile)
    * (p_raw_marks - v_lower_marks) / (v_upper_marks - v_lower_marks);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;