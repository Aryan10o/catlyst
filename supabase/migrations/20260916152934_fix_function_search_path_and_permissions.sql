/*
# Fix SECURITY DEFINER functions — set explicit search_path

## Problem
The handle_new_user trigger function (which auto-creates a profile row on signup)
has a mutable search_path, causing "Database error saving new user" on signup.
Supabase requires SECURITY DEFINER functions to have an explicit search_path.

## Changes
1. handle_new_user: add `SET search_path = public`
2. get_percentile: add `SET search_path = public`
3. update_updated_at_column: add `SET search_path = public`
4. Revoke EXECUTE from anon/authenticated on handle_new_user (trigger-only function)
5. Revoke EXECUTE from anon on get_percentile (should only be called server-side)
*/

-- Fix handle_new_user: add search_path
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email) VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix get_percentile: add search_path
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix update_updated_at_column: add search_path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Rebuild the trigger (drop and recreate to pick up the new function)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Revoke EXECUTE on handle_new_user from anon and authenticated (trigger-only, not callable via API)
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM anon, authenticated;

-- Revoke EXECUTE on get_percentile from anon (only edge functions with service role should call it)
REVOKE EXECUTE ON FUNCTION get_percentile(uuid, text, numeric) FROM anon;