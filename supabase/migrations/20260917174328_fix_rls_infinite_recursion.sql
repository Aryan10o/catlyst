/*
# Fix infinite recursion in RLS policies

## Problem
All admin policies across every table use `EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')`.
When RLS evaluates a SELECT on `profiles`, it triggers the admin policy which itself queries `profiles`,
causing infinite recursion: "infinite recursion detected in policy for relation profiles".
This breaks signup, login, and every database query.

## Fix
1. Create a SECURITY DEFINER function `is_admin()` that reads the profiles table BYPASSING RLS
   (SECURITY DEFINER runs as the function owner, which bypasses RLS).
2. Replace every `EXISTS (SELECT 1 FROM profiles p WHERE ...)` admin check with `is_admin()`.
3. Drop and recreate all affected policies on all 10 tables.
*/

-- ═══════════════════════════════════════════
-- HELPER FUNCTION
-- ═══════════════════════════════════════════
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ═══════════════════════════════════════════
-- PROFILES — fix recursion
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
DROP POLICY IF EXISTS "admin_select_all_profiles" ON profiles;

CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR is_admin());

CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ═══════════════════════════════════════════
-- MOCKS
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "student_select_published_mocks" ON mocks;
DROP POLICY IF EXISTS "admin_insert_mocks" ON mocks;
DROP POLICY IF EXISTS "admin_update_mocks" ON mocks;
DROP POLICY IF EXISTS "admin_delete_mocks" ON mocks;

CREATE POLICY "student_select_published_mocks" ON mocks FOR SELECT
  TO authenticated USING (is_published = true OR is_admin());

CREATE POLICY "admin_insert_mocks" ON mocks FOR INSERT
  TO authenticated WITH CHECK (is_admin());

CREATE POLICY "admin_update_mocks" ON mocks FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admin_delete_mocks" ON mocks FOR DELETE
  TO authenticated USING (is_admin());

-- ═══════════════════════════════════════════
-- MOCK ACCESS
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "student_select_own_mock_access" ON mock_access;
DROP POLICY IF EXISTS "admin_select_all_mock_access" ON mock_access;
DROP POLICY IF EXISTS "admin_insert_mock_access" ON mock_access;
DROP POLICY IF EXISTS "admin_delete_mock_access" ON mock_access;

CREATE POLICY "student_select_own_mock_access" ON mock_access FOR SELECT
  TO authenticated USING (auth.uid() = student_id);

CREATE POLICY "admin_select_all_mock_access" ON mock_access FOR SELECT
  TO authenticated USING (is_admin());

CREATE POLICY "admin_insert_mock_access" ON mock_access FOR INSERT
  TO authenticated WITH CHECK (is_admin());

CREATE POLICY "admin_delete_mock_access" ON mock_access FOR DELETE
  TO authenticated USING (is_admin());

-- ═══════════════════════════════════════════
-- QUESTION SETS
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "student_select_unlocked_question_sets" ON question_sets;
DROP POLICY IF EXISTS "admin_select_all_question_sets" ON question_sets;
DROP POLICY IF EXISTS "admin_insert_question_sets" ON question_sets;
DROP POLICY IF EXISTS "admin_update_question_sets" ON question_sets;
DROP POLICY IF EXISTS "admin_delete_question_sets" ON question_sets;

CREATE POLICY "student_select_unlocked_question_sets" ON question_sets FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM attempts a
      WHERE a.mock_id = question_sets.mock_id
        AND a.student_id = auth.uid()
        AND a.status IN ('in_progress','paused','submitted')
        AND (a.status = 'submitted' OR question_sets.section = a.current_section)
    ) OR is_admin()
  );

CREATE POLICY "admin_select_all_question_sets" ON question_sets FOR SELECT
  TO authenticated USING (is_admin());

CREATE POLICY "admin_insert_question_sets" ON question_sets FOR INSERT
  TO authenticated WITH CHECK (is_admin());

CREATE POLICY "admin_update_question_sets" ON question_sets FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admin_delete_question_sets" ON question_sets FOR DELETE
  TO authenticated USING (is_admin());

-- ═══════════════════════════════════════════
-- QUESTIONS
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "student_select_unlocked_questions" ON questions;
DROP POLICY IF EXISTS "admin_select_all_questions" ON questions;
DROP POLICY IF EXISTS "admin_insert_questions" ON questions;
DROP POLICY IF EXISTS "admin_update_questions" ON questions;
DROP POLICY IF EXISTS "admin_delete_questions" ON questions;

CREATE POLICY "student_select_unlocked_questions" ON questions FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM attempts a
      WHERE a.mock_id = questions.mock_id
        AND a.student_id = auth.uid()
        AND a.status IN ('in_progress','paused','submitted')
        AND (a.status = 'submitted' OR questions.section = a.current_section)
    ) OR is_admin()
  );

CREATE POLICY "admin_select_all_questions" ON questions FOR SELECT
  TO authenticated USING (is_admin());

CREATE POLICY "admin_insert_questions" ON questions FOR INSERT
  TO authenticated WITH CHECK (is_admin());

CREATE POLICY "admin_update_questions" ON questions FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admin_delete_questions" ON questions FOR DELETE
  TO authenticated USING (is_admin());

-- ═══════════════════════════════════════════
-- GRADING SHEETS
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "admin_select_grading_sheets" ON grading_sheets;
DROP POLICY IF EXISTS "admin_insert_grading_sheets" ON grading_sheets;
DROP POLICY IF EXISTS "admin_update_grading_sheets" ON grading_sheets;
DROP POLICY IF EXISTS "admin_delete_grading_sheets" ON grading_sheets;

CREATE POLICY "admin_select_grading_sheets" ON grading_sheets FOR SELECT
  TO authenticated USING (is_admin());

CREATE POLICY "admin_insert_grading_sheets" ON grading_sheets FOR INSERT
  TO authenticated WITH CHECK (is_admin());

CREATE POLICY "admin_update_grading_sheets" ON grading_sheets FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admin_delete_grading_sheets" ON grading_sheets FOR DELETE
  TO authenticated USING (is_admin());

-- ═══════════════════════════════════════════
-- ATTEMPTS
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "student_select_own_attempts" ON attempts;
DROP POLICY IF EXISTS "student_insert_own_attempts" ON attempts;
DROP POLICY IF EXISTS "admin_select_all_attempts" ON attempts;

CREATE POLICY "student_select_own_attempts" ON attempts FOR SELECT
  TO authenticated USING (auth.uid() = student_id);

CREATE POLICY "student_insert_own_attempts" ON attempts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = student_id);

CREATE POLICY "admin_select_all_attempts" ON attempts FOR SELECT
  TO authenticated USING (is_admin());

-- ═══════════════════════════════════════════
-- RESPONSES
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "student_select_own_responses" ON responses;
DROP POLICY IF EXISTS "student_insert_own_responses" ON responses;
DROP POLICY IF EXISTS "student_update_own_responses" ON responses;
DROP POLICY IF EXISTS "admin_select_all_responses" ON responses;

CREATE POLICY "student_select_own_responses" ON responses FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM attempts a WHERE a.id = responses.attempt_id AND a.student_id = auth.uid())
  );

CREATE POLICY "student_insert_own_responses" ON responses FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM attempts a WHERE a.id = responses.attempt_id AND a.student_id = auth.uid())
  );

CREATE POLICY "student_update_own_responses" ON responses FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM attempts a WHERE a.id = responses.attempt_id AND a.student_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM attempts a WHERE a.id = responses.attempt_id AND a.student_id = auth.uid())
  );

CREATE POLICY "admin_select_all_responses" ON responses FOR SELECT
  TO authenticated USING (is_admin());

-- ═══════════════════════════════════════════
-- VIOLATIONS
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "student_insert_own_violations" ON violations;
DROP POLICY IF EXISTS "admin_select_all_violations" ON violations;

CREATE POLICY "student_insert_own_violations" ON violations FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM attempts a WHERE a.id = violations.attempt_id AND a.student_id = auth.uid())
  );

CREATE POLICY "admin_select_all_violations" ON violations FOR SELECT
  TO authenticated USING (is_admin());

-- ═══════════════════════════════════════════
-- ATTEMPT RESULTS
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "student_select_own_results" ON attempt_results;
DROP POLICY IF EXISTS "admin_select_all_results" ON attempt_results;

CREATE POLICY "student_select_own_results" ON attempt_results FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM attempts a WHERE a.id = attempt_results.attempt_id AND a.student_id = auth.uid())
  );

CREATE POLICY "admin_select_all_results" ON attempt_results FOR SELECT
  TO authenticated USING (is_admin());

-- ═══════════════════════════════════════════
-- RESTRICT is_admin() EXECUTE to authenticated only
-- ═══════════════════════════════════════════
REVOKE EXECUTE ON FUNCTION is_admin() FROM anon, public;