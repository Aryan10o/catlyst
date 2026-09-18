import { useEffect, useState } from 'react';
import { ArrowLeft, Trophy, TrendingUp, Target, CheckCircle2, XCircle, MinusCircle, AlertTriangle, Award, BarChart3, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AttemptResult, Question, Response, Violation, Mock, Section } from '@/types';
import { SECTION_LABELS } from '@/types';
import type { Route } from '@/App';

export function ResultsPage({ attemptId, onNavigate }: { attemptId: string; onNavigate: (route: Route) => void }) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [mock, setMock] = useState<Mock | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [allResults, setAllResults] = useState<AttemptResult[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'section' | 'review' | 'trend'>('overview');

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      const { data: resultData } = await supabase
        .from('attempt_results')
        .select('*')
        .eq('attempt_id', attemptId)
        .maybeSingle();

      if (!resultData) {
        setLoading(false);
        return;
      }
      setResult(resultData as AttemptResult);

      const { data: attemptData } = await supabase
        .from('attempts')
        .select('*')
        .eq('id', attemptId)
        .maybeSingle();

      if (attemptData) {
        const { data: mockData } = await supabase
          .from('mocks')
          .select('*')
          .eq('id', attemptData.mock_id)
          .maybeSingle();
        setMock(mockData as Mock);

        // Fetch all questions for this mock (submitted attempts can see all sections)
        const { data: questionData } = await supabase
          .from('questions')
          .select('*')
          .eq('mock_id', attemptData.mock_id)
          .order('section', { ascending: true })
          .order('display_order', { ascending: true });
        setQuestions(questionData as Question[] || []);

        const { data: responseData } = await supabase
          .from('responses')
          .select('*')
          .eq('attempt_id', attemptId);
        setResponses(responseData as Response[] || []);

        const { data: violationData } = await supabase
          .from('violations')
          .select('*')
          .eq('attempt_id', attemptId)
          .order('occurred_at', { ascending: true });
        setViolations(violationData as Violation[] || []);

        // Fetch all results for trend chart
        const { data: allAttemptIds } = await supabase
          .from('attempts')
          .select('id')
          .eq('student_id', attemptData.student_id)
          .eq('status', 'submitted');

        if (allAttemptIds && allAttemptIds.length > 0) {
          const ids = allAttemptIds.map((a) => a.id);
          const { data: allResultsData } = await supabase
            .from('attempt_results')
            .select('*, attempts!inner(mock_id, submitted_at, mock_id)')
            .in('attempt_id', ids)
            .order('computed_at', { ascending: true });
          setAllResults(allResultsData as AttemptResult[] || []);
        }
      }

      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
        <div className="card p-8 max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-warning-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-neutral-800 mb-2">Results not available</h2>
          <p className="text-neutral-500 text-sm mb-6">Your results are not ready yet. Please check back later.</p>
          <button onClick={() => onNavigate({ name: 'dashboard' })} className="btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const sections: { key: Section; marks: number | null; percentile: number | null; label: string }[] = [
    { key: 'VARC', marks: result.varc_raw_marks, percentile: result.varc_percentile, label: 'VARC' },
    { key: 'DILR', marks: result.dilr_raw_marks, percentile: result.dilr_percentile, label: 'DILR' },
    { key: 'QA', marks: result.qa_raw_marks, percentile: result.qa_percentile, label: 'QA' },
  ];

  const responseMap = new Map<string, Response>();
  responses.forEach((r) => responseMap.set(r.question_id, r));

  const correctCount = responses.filter((r) => r.is_correct === true).length;
  const wrongCount = responses.filter((r) => r.is_correct === false && r.selected_answer).length;
  const skippedCount = responses.filter((r) => !r.selected_answer || r.selected_answer === '').length;

  const maxPercentile = 100;
  const trendData = allResults.map((r, i) => ({
    x: i + 1,
    percentile: r.overall_percentile || 0,
    marks: r.overall_raw_marks,
  }));

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button onClick={() => onNavigate({ name: 'dashboard' })} className="btn-ghost">
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </button>
          <h1 className="text-lg font-bold text-neutral-900">{mock?.title || 'Test Results'}</h1>
          <div className="w-20"></div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero score card */}
        <div className="card p-8 mb-6 bg-gradient-to-br from-primary-600 to-primary-800 text-white border-0">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-primary-200 text-sm font-medium mb-1">Overall Score</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold">{result.overall_raw_marks.toFixed(1)}</span>
                <span className="text-primary-300 text-lg">marks</span>
              </div>
              {result.overall_grade && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-sm font-medium">
                  <Award className="w-4 h-4" />
                  Grade: {result.overall_grade}
                </div>
              )}
            </div>
            <div className="text-center">
              <p className="text-primary-200 text-sm font-medium mb-1">Percentile</p>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold">
                  {result.overall_percentile !== null ? result.overall_percentile.toFixed(1) : '—'}
                </span>
                {result.overall_percentile !== null && <span className="text-primary-300 text-lg">%</span>}
              </div>
              <p className="text-primary-300 text-xs mt-1">
                {result.overall_percentile !== null ? 'Estimated percentile' : 'Not available'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-primary-200 text-sm font-medium mb-1">Accuracy</p>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold">{result.accuracy_overall?.toFixed(0) || '0'}</span>
                <span className="text-primary-300 text-lg">%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-neutral-100 rounded-lg mb-6 w-fit">
          {[
            { key: 'overview', label: 'Overview', icon: BarChart3 },
            { key: 'section', label: 'Section-wise', icon: Target },
            { key: 'review', label: 'Answer Review', icon: CheckCircle2 },
            { key: 'trend', label: 'Performance Trend', icon: TrendingUp },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.key ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-success-100 text-success-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="text-sm text-neutral-500">Correct</span>
              </div>
              <p className="text-2xl font-bold text-neutral-900">{correctCount}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-error-100 text-error-600 flex items-center justify-center">
                  <XCircle className="w-4 h-4" />
                </div>
                <span className="text-sm text-neutral-500">Incorrect</span>
              </div>
              <p className="text-2xl font-bold text-neutral-900">{wrongCount}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-500 flex items-center justify-center">
                  <MinusCircle className="w-4 h-4" />
                </div>
                <span className="text-sm text-neutral-500">Skipped</span>
              </div>
              <p className="text-2xl font-bold text-neutral-900">{skippedCount}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-warning-100 text-warning-600 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <span className="text-sm text-neutral-500">Violations</span>
              </div>
              <p className="text-2xl font-bold text-neutral-900">{violations.length}</p>
            </div>
          </div>
        )}

        {/* Section-wise tab */}
        {activeTab === 'section' && (
          <div className="space-y-4 animate-fade-in">
            {sections.map((sec) => (
              <div key={sec.key} className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-neutral-900">{sec.label}</h3>
                    <p className="text-xs text-neutral-500">{SECTION_LABELS[sec.key]}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-neutral-900">{sec.marks?.toFixed(1) || '0.0'}</p>
                    <p className="text-xs text-neutral-500">
                      {sec.percentile !== null ? `${sec.percentile.toFixed(1)} percentile` : 'No percentile data'}
                    </p>
                  </div>
                </div>
                <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full transition-all duration-500"
                    style={{ width: `${sec.percentile || 0}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Answer review tab */}
        {activeTab === 'review' && (
          <div className="space-y-3 animate-fade-in">
            {questions.map((q, idx) => {
              const resp = responseMap.get(q.id);
              const isCorrect = resp?.is_correct === true;
              const isWrong = resp?.is_correct === false && resp?.selected_answer;
              const isSkipped = !resp?.selected_answer || resp?.selected_answer === '';

              return (
                <div key={q.id} className="card p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isCorrect ? 'bg-success-100 text-success-600' :
                      isWrong ? 'bg-error-100 text-error-600' :
                      'bg-neutral-100 text-neutral-400'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`badge ${q.question_type === 'MCQ' ? 'badge-primary' : 'badge-neutral'}`}>{q.question_type}</span>
                        <span className="badge-neutral">{q.section}</span>
                        {isCorrect && <span className="badge-success"><CheckCircle2 className="w-3 h-3 mr-0.5" />Correct</span>}
                        {isWrong && <span className="badge-error"><XCircle className="w-3 h-3 mr-0.5" />Wrong</span>}
                        {isSkipped && <span className="badge-neutral"><MinusCircle className="w-3 h-3 mr-0.5" />Skipped</span>}
                      </div>
                      <p className="text-sm text-neutral-700 mb-2 line-clamp-2">{q.question_text}</p>
                      <div className="text-xs text-neutral-500 space-y-0.5">
                        <p>Your answer: <span className="font-medium text-neutral-700">{resp?.selected_answer || '—'}</span></p>
                        <p>Correct answer: <span className="font-medium text-success-600">{q.correct_answer}</span></p>
                        <p>Marks awarded: <span className={`font-medium ${isCorrect ? 'text-success-600' : isWrong ? 'text-error-600' : 'text-neutral-500'}`}>
                          {resp?.marks_awarded !== null && resp?.marks_awarded !== undefined ? resp.marks_awarded.toFixed(1) : '0.0'}
                        </span></p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Trend tab */}
        {activeTab === 'trend' && (
          <div className="card p-6 animate-fade-in">
            <h3 className="font-semibold text-neutral-900 mb-4">Percentile Trend Across Mocks</h3>
            {trendData.length > 0 ? (
              <div>
                <div className="relative h-64 flex items-end justify-around gap-4 pb-8">
                  {trendData.map((d, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 flex-1">
                      <div className="text-xs font-medium text-neutral-600">{d.percentile.toFixed(1)}%</div>
                      <div
                        className="w-full max-w-16 bg-gradient-to-t from-primary-600 to-primary-400 rounded-t-lg transition-all duration-500 hover:from-primary-700 hover:to-primary-500"
                        style={{ height: `${(d.percentile / maxPercentile) * 200}px` }}
                      >
                        <div className="text-xs text-white text-center pt-2 font-medium">{d.marks.toFixed(0)}</div>
                      </div>
                      <div className="text-xs text-neutral-400">Mock {d.x}</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-4 text-xs text-neutral-500 mt-4 pt-4 border-t border-neutral-100">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-primary-500"></div>
                    <span>Percentile (top label) / Marks (inside bar)</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-500 text-center py-8">Only one test taken. Take more mocks to see your trend.</p>
            )}
          </div>
        )}

        {/* Violations summary */}
        {violations.length > 0 && (
          <div className="card p-5 mt-6 border-warning-200 bg-warning-50/50">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-warning-600" />
              <h3 className="font-semibold text-neutral-800 text-sm">Proctoring Violations ({violations.length})</h3>
            </div>
            <div className="space-y-1.5">
              {violations.slice(0, 5).map((v) => (
                <div key={v.id} className="flex items-center justify-between text-xs">
                  <span className="text-neutral-600 capitalize">{v.type.replace('_', ' ')}</span>
                  <span className="text-neutral-400">{new Date(v.occurred_at).toLocaleString()}</span>
                </div>
              ))}
              {violations.length > 5 && (
                <p className="text-xs text-neutral-400">...and {violations.length - 5} more</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
