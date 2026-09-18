import { useEffect, useState, useRef, useCallback } from 'react';
import { Clock, AlertTriangle, Eye, Flag, ChevronLeft, ChevronRight, Maximize2, Minimize2, X, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { callEdgeFunction } from '@/lib/edgeFunctions';
import type { Question, QuestionSet, Response, Section } from '@/types';
import { SECTION_ORDER, SECTION_LABELS } from '@/types';
import type { Route } from '@/App';

interface TestInterfaceProps {
  mockId: string;
  onNavigate: (route: Route) => void;
}

interface StartSectionResponse {
  attempt_id: string;
  session_id: string;
  section_ends_at: string;
  current_section: Section;
}

interface GetQuestionsResponse {
  section: Section;
  question_sets: QuestionSet[];
  questions: Question[];
  responses: Response[];
  section_ends_at: string;
}

interface SubmitSectionResponse {
  advanced: boolean;
  next_section?: Section;
  section_ends_at?: string;
  submitted?: boolean;
  attempt_id?: string;
}

export function TestInterface({ mockId, onNavigate }: TestInterfaceProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentSection, setCurrentSection] = useState<Section | null>(null);
  const [sectionEndsAt, setSectionEndsAt] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [responses, setResponses] = useState<Map<string, Response>>(new Map());
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showSectionTransition, setShowSectionTransition] = useState<Section | null>(null);
  const [showResultsReady, setShowResultsReady] = useState(false);
  const [sessionConflict, setSessionConflict] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [showViolationWarning, setShowViolationWarning] = useState<string | null>(null);

  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionStartTimeRef = useRef<number>(Date.now());
  const pendingSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFullscreenRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const attemptIdRef = useRef<string | null>(null);
  const currentSectionRef = useRef<Section | null>(null);
  const violationLoggedRef = useRef(false);

  // Update refs when state changes
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { attemptIdRef.current = attemptId; }, [attemptId]);
  useEffect(() => { currentSectionRef.current = currentSection; }, [currentSection]);
  useEffect(() => { isFullscreenRef.current = isFullscreen; }, [isFullscreen]);

  // Initialize: check for existing attempt
  useEffect(() => {
    initializeAttempt();
  }, []);

  const initializeAttempt = async () => {
    try {
      const { data: existingAttempt } = await supabase
        .from('attempts')
        .select('*')
        .eq('student_id', profile!.id)
        .eq('mock_id', mockId)
        .maybeSingle();

      if (existingAttempt && existingAttempt.status === 'submitted') {
        setError('You have already submitted this test.');
        setLoading(false);
        return;
      }

      if (existingAttempt && existingAttempt.status === 'paused' && existingAttempt.current_section) {
        // Resume from pause
        const resumeResult = await callEdgeFunction<{ session_id: string; section_ends_at: string; current_section: Section }>('resume-section', {
          attempt_id: existingAttempt.id,
        });
        setAttemptId(existingAttempt.id);
        setSessionId(resumeResult.session_id);
        setCurrentSection(resumeResult.current_section);
        setSectionEndsAt(resumeResult.section_ends_at);
        setShowInstructions(false);
        await loadSectionQuestions(existingAttempt.id, resumeResult.session_id, resumeResult.current_section);
      } else if (existingAttempt && existingAttempt.status === 'in_progress' && existingAttempt.current_section) {
        // Already in progress — get questions for current section
        setAttemptId(existingAttempt.id);
        const newSession = crypto.randomUUID();
        // Re-issue session via start-section
        const startResult = await callEdgeFunction<StartSectionResponse>('start-section', {
          mock_id: mockId,
          section: existingAttempt.current_section,
        });
        setAttemptId(startResult.attempt_id);
        setSessionId(startResult.session_id);
        setCurrentSection(startResult.current_section);
        setSectionEndsAt(startResult.section_ends_at);
        setShowInstructions(false);
        await loadSectionQuestions(startResult.attempt_id, startResult.session_id, startResult.current_section);
      } else {
        // Fresh start — show instructions
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize test');
      setLoading(false);
    }
  };

  const loadSectionQuestions = async (aId: string, sId: string, section: Section) => {
    try {
      const result = await callEdgeFunction<GetQuestionsResponse>('get-section-questions', {
        attempt_id: aId,
        session_id: sId,
      });
      setQuestions(result.questions);
      setQuestionSets(result.question_sets);
      const responseMap = new Map<string, Response>();
      (result.responses || []).forEach((r) => responseMap.set(r.question_id, r));
      setResponses(responseMap);
      setCurrentQuestionIndex(0);
      setSectionEndsAt(result.section_ends_at);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questions');
      setLoading(false);
    }
  };

  // Start test from instructions
  const startTest = async () => {
    try {
      setLoading(true);
      const result = await callEdgeFunction<StartSectionResponse>('start-section', {
        mock_id: mockId,
        section: 'VARC',
      });
      setAttemptId(result.attempt_id);
      setSessionId(result.session_id);
      setCurrentSection(result.current_section);
      setSectionEndsAt(result.section_ends_at);
      setShowInstructions(false);
      await loadSectionQuestions(result.attempt_id, result.session_id, result.current_section);
      enterFullscreen();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start test');
      setLoading(false);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (!sectionEndsAt || showInstructions || loading) return;

    const updateTimer = () => {
      const now = Date.now();
      const ends = new Date(sectionEndsAt).getTime();
      const remaining = Math.max(0, Math.floor((ends - now) / 1000));
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        handleSubmitSection();
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sectionEndsAt, showInstructions, loading]);

  // Heartbeat
  useEffect(() => {
    if (!attemptId || !sessionId || showInstructions || loading) return;

    const sendHeartbeat = async () => {
      try {
        await callEdgeFunction('heartbeat', { attempt_id: attemptId, session_id: sessionId });
      } catch (err) {
        if (err instanceof Error && err.message.includes('Session conflict')) {
          setSessionConflict(true);
          if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        }
      }
    };

    sendHeartbeat();
    heartbeatRef.current = setInterval(sendHeartbeat, 10000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [attemptId, sessionId, showInstructions, loading]);

  // Track question time
  useEffect(() => {
    questionStartTimeRef.current = Date.now();
  }, [currentQuestionIndex]);

  // Proctoring: visibility change (tab switch)
  useEffect(() => {
    if (showInstructions || loading) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logViolation('tab_switch', 'Tab switch detected. Please stay on the test window.');
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreenRef.current) {
        setIsFullscreen(false);
        logViolation('fullscreen_exit', 'You exited fullscreen mode. Please return to fullscreen.');
      } else if (document.fullscreenElement) {
        setIsFullscreen(true);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logViolation('right_click', 'Right-click is disabled during the test.');
    };

    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      logViolation('copy_paste', 'Copy/paste is disabled during the test.');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('cut', handleCopyPaste);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('cut', handleCopyPaste);
    };
  }, [showInstructions, loading]);

  const logViolation = async (type: string, message: string) => {
    if (!attemptIdRef.current || !sessionIdRef.current || violationLoggedRef.current) return;
    try {
      await callEdgeFunction('log-violation', {
        attempt_id: attemptIdRef.current,
        session_id: sessionIdRef.current,
        type,
        section: currentSectionRef.current,
      });
      setViolationCount((c) => c + 1);
      setShowViolationWarning(message);
      setTimeout(() => setShowViolationWarning(null), 3000);
    } catch {
      // silent
    }
  };

  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } catch {
      // Fullscreen may not be available
    }
  };

  const exitFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Answer saving
  const saveAnswer = useCallback((questionId: string, selectedAnswer: string | null) => {
    if (!attemptId || !sessionId) return;

    if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);

    pendingSaveRef.current = setTimeout(async () => {
      try {
        await callEdgeFunction('save-response', {
          attempt_id: attemptId,
          session_id: sessionId,
          question_id: questionId,
          selected_answer: selectedAnswer,
        });
      } catch {
        // silent
      }
    }, 500);
  }, [attemptId, sessionId]);

  const toggleReview = async (questionId: string, currentReview: boolean) => {
    if (!attemptId || !sessionId) return;
    const newReview = !currentReview;
    setResponses((prev) => {
      const next = new Map(prev);
      const existing = next.get(questionId);
      if (existing) {
        next.set(questionId, { ...existing, is_marked_for_review: newReview });
      } else {
        next.set(questionId, {
          id: '',
          attempt_id: attemptId,
          question_id: questionId,
          selected_answer: null,
          is_marked_for_review: newReview,
          is_visited: true,
          time_spent_seconds: 0,
          is_correct: null,
          marks_awarded: null,
          updated_at: new Date().toISOString(),
        });
      }
      return next;
    });

    try {
      await callEdgeFunction('save-response', {
        attempt_id: attemptId,
        session_id: sessionId,
        question_id: questionId,
        is_marked_for_review: newReview,
      });
    } catch {
      // silent
    }
  };

  const selectAnswer = (questionId: string, answer: string) => {
    setResponses((prev) => {
      const next = new Map(prev);
      const existing = next.get(questionId);
      if (existing) {
        next.set(questionId, { ...existing, selected_answer: answer, is_visited: true });
      } else {
        next.set(questionId, {
          id: '',
          attempt_id: attemptId || '',
          question_id: questionId,
          selected_answer: answer,
          is_marked_for_review: false,
          is_visited: true,
          time_spent_seconds: 0,
          is_correct: null,
          marks_awarded: null,
          updated_at: new Date().toISOString(),
        });
      }
      return next;
    });
    saveAnswer(questionId, answer);
  };

  const navigateQuestion = (direction: 'prev' | 'next') => {
    // Save time spent on current question
    const timeSpent = Math.floor((Date.now() - questionStartTimeRef.current) / 1000);
    const currentQ = questions[currentQuestionIndex];
    if (currentQ && attemptId && sessionId && timeSpent > 0) {
      const existing = responses.get(currentQ.id);
      callEdgeFunction('save-response', {
        attempt_id: attemptId,
        session_id: sessionId,
        question_id: currentQ.id,
        time_spent_seconds: (existing?.time_spent_seconds || 0) + timeSpent,
        is_visited: true,
      }).catch(() => {});
    }

    if (direction === 'prev' && currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else if (direction === 'next' && currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleSubmitSection = async () => {
    if (!attemptId || !sessionId || !currentSection) return;

    try {
      setShowSubmitConfirm(false);
      setLoading(true);
      const result = await callEdgeFunction<SubmitSectionResponse>('submit-section', {
        attempt_id: attemptId,
        session_id: sessionId,
      });

      if (result.submitted) {
        setShowResultsReady(true);
        setLoading(false);
      } else if (result.advanced && result.next_section) {
        setShowSectionTransition(result.next_section);
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit section');
      setLoading(false);
    }
  };

  const continueToNextSection = async () => {
    if (!showSectionTransition) return;
    try {
      setLoading(true);
      const result = await callEdgeFunction<StartSectionResponse>('start-section', {
        mock_id: mockId,
        section: showSectionTransition,
      });
      setSessionId(result.session_id);
      setCurrentSection(result.current_section);
      setSectionEndsAt(result.section_ends_at);
      setShowSectionTransition(null);
      await loadSectionQuestions(attemptId!, result.session_id, result.current_section);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start next section');
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentQuestionIndex];
  const currentResponse = currentQuestion ? responses.get(currentQuestion.id) : null;
  const currentSet = currentQuestion?.set_id ? questionSets.find((s) => s.id === currentQuestion.set_id) : null;

  // Count answered/reviewed
  const answeredCount = Array.from(responses.values()).filter((r) => r.selected_answer && r.selected_answer !== '').length;
  const reviewedCount = Array.from(responses.values()).filter((r) => r.is_marked_for_review).length;
  const visitedCount = Array.from(responses.values()).filter((r) => r.is_visited).length;

  if (loading && !currentSection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-neutral-500 text-sm">Loading test...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
        <div className="card p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-error-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-neutral-800 mb-2">Something went wrong</h2>
          <p className="text-neutral-500 text-sm mb-6">{error}</p>
          <button onClick={() => onNavigate({ name: 'dashboard' })} className="btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (sessionConflict) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
        <div className="card p-8 max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-warning-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-neutral-800 mb-2">Test in progress elsewhere</h2>
          <p className="text-neutral-500 text-sm mb-6">
            This test is already open in another tab or device. You can only take the test in one place at a time.
          </p>
          <button onClick={() => onNavigate({ name: 'dashboard' })} className="btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (showResultsReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-success-50 to-primary-50/30 px-4">
        <div className="card p-8 max-w-md text-center animate-scale-in">
          <div className="w-16 h-16 rounded-full bg-success-100 text-success-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Test Submitted!</h2>
          <p className="text-neutral-500 text-sm mb-6">
            Your test has been submitted successfully. Your results are ready to view.
          </p>
          <button onClick={() => attemptId && onNavigate({ name: 'results', attemptId })} className="btn-primary w-full">
            View Results
          </button>
        </div>
      </div>
    );
  }

  if (showInstructions) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
        <div className="card p-8 max-w-2xl w-full">
          <h2 className="text-2xl font-bold text-neutral-900 mb-4">Test Instructions</h2>
          <div className="space-y-3 text-sm text-neutral-600 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
              <p>The test has 3 sections: VARC, DILR, and QA. Each section is timed separately.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
              <p>Once a section starts, you cannot pause it. The timer will continue even if you close the browser.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
              <p>Switching tabs, exiting fullscreen, right-clicking, or copy/pasting will be logged as violations.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold flex-shrink-0">4</div>
              <p>When the timer runs out, the section will be submitted automatically.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold flex-shrink-0">5</div>
              <p>You can attempt this test only once. Make sure you have a stable internet connection.</p>
            </div>
          </div>
          <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-warning-800 font-medium">Click "Start Test" to begin. The test will open in fullscreen mode.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => onNavigate({ name: 'dashboard' })} className="btn-secondary flex-1">
              Cancel
            </button>
            <button onClick={startTest} className="btn-primary flex-1">
              Start Test
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showSectionTransition) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
        <div className="card p-8 max-w-md text-center animate-scale-in">
          <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Section Complete!</h2>
          <p className="text-neutral-500 text-sm mb-6">
            You've completed the {SECTION_LABELS[currentSection!]} section. Next up: {SECTION_LABELS[showSectionTransition]}.
          </p>
          <button onClick={continueToNextSection} className="btn-primary w-full">
            Start Next Section
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 exam-mode">
      {/* Top bar */}
      <div className="bg-white border-b border-neutral-200 sticky top-0 z-20">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-lg bg-primary-50 text-primary-700 text-sm font-medium">
              {currentSection}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs text-neutral-400">{SECTION_LABELS[currentSection!]}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-mono font-semibold text-sm ${
              remainingSeconds < 60 ? 'bg-error-100 text-error-700 animate-pulse-soft' :
              remainingSeconds < 300 ? 'bg-warning-100 text-warning-700' :
              'bg-neutral-100 text-neutral-700'
            }`}>
              <Clock className="w-4 h-4" />
              {formatTime(remainingSeconds)}
            </div>
            {violationCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-error-50 text-error-600 text-xs font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                {violationCount}
              </div>
            )}
            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="btn-danger text-xs px-3 py-1.5"
            >
              Submit
            </button>
            <button
              onClick={() => isFullscreen ? exitFullscreen() : enterFullscreen()}
              className="btn-ghost p-1.5"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row max-w-7xl mx-auto">
        {/* Question area */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          {currentSet && (currentSet.passage_text || currentSet.passage_image_url) && (
            <div className="card p-5 mb-6 bg-primary-50/30 border-primary-100">
              <p className="text-xs font-semibold text-primary-600 mb-2 uppercase tracking-wide">Passage / Data Set</p>
              {currentSet.passage_text && (
                <div className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                  {currentSet.passage_text}
                </div>
              )}
              {currentSet.passage_image_url && (
                <img src={currentSet.passage_image_url} alt="Passage" className="mt-3 rounded-lg max-w-full" />
              )}
            </div>
          )}

          {currentQuestion && (
            <div className="card p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-500">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </span>
                  <span className={`badge ${
                    currentQuestion.question_type === 'MCQ' ? 'badge-primary' : 'badge-neutral'
                  }`}>
                    {currentQuestion.question_type}
                  </span>
                  {currentQuestion.difficulty && (
                    <span className={`badge ${
                      currentQuestion.difficulty === 'easy' ? 'badge-success' :
                      currentQuestion.difficulty === 'medium' ? 'badge-warning' : 'badge-error'
                    }`}>
                      {currentQuestion.difficulty}
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-400">
                  +{currentQuestion.marks} / -{currentQuestion.negative_marks}
                </div>
              </div>

              <div className="mb-6">
                <p className="text-neutral-900 text-base leading-relaxed whitespace-pre-wrap">
                  {currentQuestion.question_text}
                </p>
                {currentQuestion.image_url && (
                  <img src={currentQuestion.image_url} alt="Question" className="mt-4 rounded-lg max-w-full" />
                )}
              </div>

              {currentQuestion.question_type === 'MCQ' && currentQuestion.options && (
                <div className="space-y-2">
                  {currentQuestion.options.map((opt) => {
                    const isSelected = currentResponse?.selected_answer === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => selectAnswer(currentQuestion.id, opt.id)}
                        className={`w-full text-left p-3.5 rounded-lg border-2 transition-all duration-150 flex items-center gap-3 ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          isSelected ? 'border-primary-500 bg-primary-500 text-white' : 'border-neutral-300 text-neutral-500'
                        }`}>
                          {opt.id.toUpperCase()}
                        </div>
                        <span className={`text-sm ${isSelected ? 'text-primary-900' : 'text-neutral-700'}`}>
                          {opt.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQuestion.question_type === 'TITA' && (
                <div>
                  <input
                    type="text"
                    value={currentResponse?.selected_answer || ''}
                    onChange={(e) => selectAnswer(currentQuestion.id, e.target.value)}
                    placeholder="Type your answer here..."
                    className="input max-w-xs"
                  />
                  <p className="text-xs text-neutral-400 mt-2">Type in a numeric or text answer. No options provided.</p>
                </div>
              )}

              <div className="flex items-center justify-between mt-6 pt-4 border-t border-neutral-100">
                <button
                  onClick={() => toggleReview(currentQuestion.id, currentResponse?.is_marked_for_review || false)}
                  className={`btn text-xs ${currentResponse?.is_marked_for_review ? 'btn-warning' : 'btn-secondary'}`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  {currentResponse?.is_marked_for_review ? 'Marked for Review' : 'Mark for Review'}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigateQuestion('prev')}
                    disabled={currentQuestionIndex === 0}
                    className="btn-secondary"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <button
                    onClick={() => navigateQuestion('next')}
                    disabled={currentQuestionIndex === questions.length - 1}
                    className="btn-primary"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Question palette */}
        <div className="lg:w-72 p-4 sm:p-6 lg:p-8 lg:pl-0">
          <div className="card p-4 sticky top-16">
            <h3 className="text-sm font-semibold text-neutral-700 mb-3">Question Palette</h3>
            <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-success-500"></div>
                <span className="text-neutral-500">Answered ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-error-500"></div>
                <span className="text-neutral-500">Review ({reviewedCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded border-2 border-neutral-300 bg-white"></div>
                <span className="text-neutral-500">Not visited</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-primary-100 border-2 border-primary-300"></div>
                <span className="text-neutral-500">Visited ({visitedCount})</span>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-1.5 max-h-64 overflow-y-auto">
              {questions.map((q, idx) => {
                const resp = responses.get(q.id);
                const isAnswered = resp && resp.selected_answer && resp.selected_answer !== '';
                const isReviewed = resp?.is_marked_for_review;
                const isVisited = resp?.is_visited;
                const isCurrent = idx === currentQuestionIndex;

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`aspect-square rounded-lg text-xs font-medium transition-all relative ${
                      isCurrent ? 'ring-2 ring-primary-500 ring-offset-1' : ''
                    } ${
                      isAnswered && isReviewed ? 'bg-error-500 text-white' :
                      isAnswered ? 'bg-success-500 text-white' :
                      isReviewed ? 'bg-error-100 text-error-700 border border-error-300' :
                      isVisited ? 'bg-primary-100 text-primary-700 border border-primary-300' :
                      'bg-white text-neutral-500 border border-neutral-300'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-neutral-100">
              <div className="flex justify-between text-xs text-neutral-500 mb-2">
                <span>Answered: {answeredCount}/{questions.length}</span>
              </div>
              <button
                onClick={() => setShowSubmitConfirm(true)}
                className="btn-danger w-full text-xs"
              >
                Submit Section
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Violation warning toast */}
      {showViolationWarning && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="bg-error-600 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 max-w-md">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{showViolationWarning}</p>
          </div>
        </div>
      )}

      {/* Submit confirmation modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 animate-fade-in">
          <div className="card p-6 max-w-md w-full animate-scale-in">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-warning-100 text-warning-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900">Submit Section?</h3>
                <p className="text-sm text-neutral-500 mt-1">
                  You have answered {answeredCount} out of {questions.length} questions.
                  {answeredCount < questions.length && ' Unanswered questions will get 0 marks.'}
                  {' '}You cannot return to this section after submitting.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowSubmitConfirm(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={handleSubmitSection} className="btn-primary flex-1">
                Submit Section
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
