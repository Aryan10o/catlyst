export type Role = 'student' | 'admin';
export type Section = 'VARC' | 'DILR' | 'QA';
export type AttemptStatus = 'not_started' | 'in_progress' | 'paused' | 'submitted';
export type QuestionType = 'MCQ' | 'TITA';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type GradingScope = 'overall' | 'VARC' | 'DILR' | 'QA';
export type ViolationType = 'tab_switch' | 'fullscreen_exit' | 'right_click' | 'copy_paste' | 'other';

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  created_at: string;
}

export interface Mock {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
  section_duration_varc: number;
  section_duration_dilr: number;
  section_duration_qa: number;
  created_at: string;
  updated_at: string;
}

export interface MockAccess {
  id: string;
  mock_id: string;
  student_id: string;
  granted_at: string;
}

export interface QuestionSet {
  id: string;
  mock_id: string;
  section: Section;
  passage_text: string | null;
  passage_image_url: string | null;
  display_order: number;
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  mock_id: string;
  set_id: string | null;
  section: Section;
  display_order: number;
  question_type: QuestionType;
  question_text: string;
  image_url: string | null;
  options: QuestionOption[] | null;
  correct_answer: string;
  answer_tolerance: number;
  marks: number;
  negative_marks: number;
  difficulty: Difficulty | null;
  created_at: string;
  updated_at: string;
}

export interface GradingSheet {
  id: string;
  mock_id: string;
  scope: GradingScope;
  raw_marks: number;
  percentile: number | null;
  grade: string | null;
}

export interface Attempt {
  id: string;
  student_id: string;
  mock_id: string;
  status: AttemptStatus;
  current_section: Section | null;
  active_session_id: string | null;
  section_started_at: string | null;
  section_ends_at: string | null;
  paused_at: string | null;
  last_heartbeat_at: string | null;
  total_paused_seconds: number;
  submitted_at: string | null;
  created_at: string;
}

export interface Response {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_answer: string | null;
  is_marked_for_review: boolean;
  is_visited: boolean;
  time_spent_seconds: number;
  is_correct: boolean | null;
  marks_awarded: number | null;
  updated_at: string;
}

export interface Violation {
  id: string;
  attempt_id: string;
  type: ViolationType;
  section: string | null;
  occurred_at: string;
}

export interface AttemptResult {
  id: string;
  attempt_id: string;
  overall_raw_marks: number;
  overall_percentile: number | null;
  overall_grade: string | null;
  varc_raw_marks: number | null;
  varc_percentile: number | null;
  dilr_raw_marks: number | null;
  dilr_percentile: number | null;
  qa_raw_marks: number | null;
  qa_percentile: number | null;
  accuracy_overall: number | null;
  computed_at: string;
}

export const SECTION_ORDER: Section[] = ['VARC', 'DILR', 'QA'];

export const SECTION_LABELS: Record<Section, string> = {
  VARC: 'Verbal Ability & Reading Comprehension',
  DILR: 'Data Interpretation & Logical Reasoning',
  QA: 'Quantitative Ability',
};

export const SECTION_SHORT: Record<Section, string> = {
  VARC: 'VARC',
  DILR: 'DILR',
  QA: 'QA',
};
