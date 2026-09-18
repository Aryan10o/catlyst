import { useEffect, useState, useCallback } from 'react';
import {
  GraduationCap, LogOut, BookOpen, Users, FileText, Settings, Plus, Edit2, Trash2,
  X, Check, AlertCircle, Upload, ChevronDown, ChevronRight, Clock, Award, BarChart3,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Mock, Profile, Question, QuestionSet, GradingSheet, MockAccess, Section, QuestionType, Difficulty, GradingScope } from '@/types';
import { SECTION_ORDER, SECTION_LABELS } from '@/types';
import type { Route } from '@/App';

type AdminTab = 'mocks' | 'questions' | 'grading' | 'access' | 'students';

export function AdminPanel({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('mocks');
  const [mocks, setMocks] = useState<Mock[]>([]);
  const [selectedMock, setSelectedMock] = useState<Mock | null>(null);
  const [loadingMocks, setLoadingMocks] = useState(true);

  const fetchMocks = useCallback(async () => {
    setLoadingMocks(true);
    const { data } = await supabase.from('mocks').select('*').order('created_at', { ascending: false });
    setMocks((data as Mock[]) || []);
    setLoadingMocks(false);
  }, []);

  useEffect(() => {
    fetchMocks();
  }, [fetchMocks]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-600 text-white flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-neutral-900">Admin Panel</h1>
              <p className="text-xs text-neutral-500">CAT Mock Test Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => onNavigate({ name: 'dashboard' })} className="btn-secondary text-sm">
              Student View
            </button>
            <button onClick={signOut} className="btn-ghost p-2" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <aside className="lg:w-56 flex-shrink-0">
          <div className="card p-2 sticky top-20">
            {[
              { key: 'mocks', label: 'Mock Tests', icon: BookOpen },
              { key: 'questions', label: 'Questions', icon: FileText },
              { key: 'grading', label: 'Grading Sheets', icon: Award },
              { key: 'access', label: 'Student Access', icon: Users },
              { key: 'students', label: 'All Students', icon: BarChart3 },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as AdminTab)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.key
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {activeTab === 'mocks' && (
            <MocksTab
              mocks={mocks}
              loading={loadingMocks}
              selectedMock={selectedMock}
              setSelectedMock={setSelectedMock}
              refresh={fetchMocks}
            />
          )}
          {activeTab === 'questions' && (
            <QuestionsTab mocks={mocks} selectedMock={selectedMock} setSelectedMock={setSelectedMock} />
          )}
          {activeTab === 'grading' && (
            <GradingTab mocks={mocks} selectedMock={selectedMock} setSelectedMock={setSelectedMock} />
          )}
          {activeTab === 'access' && (
            <AccessTab mocks={mocks} selectedMock={selectedMock} setSelectedMock={setSelectedMock} />
          )}
          {activeTab === 'students' && <StudentsTab />}
        </main>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// MOCKS TAB
// ═══════════════════════════════════════════
function MocksTab({
  mocks, loading, selectedMock, setSelectedMock, refresh,
}: {
  mocks: Mock[];
  loading: boolean;
  selectedMock: Mock | null;
  setSelectedMock: (m: Mock | null) => void;
  refresh: () => void;
}) {
  const [showEditor, setShowEditor] = useState(false);
  const [editingMock, setEditingMock] = useState<Mock | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Mock | null>(null);

  const openEditor = (mock: Mock | null) => {
    setEditingMock(mock);
    setShowEditor(true);
  };

  if (showEditor) {
    return (
      <MockEditor
        mock={editingMock}
        onClose={() => { setShowEditor(false); setEditingMock(null); }}
        onSaved={() => { setShowEditor(false); setEditingMock(null); refresh(); }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-neutral-900">Mock Tests</h2>
        <button onClick={() => openEditor(null)} className="btn-primary">
          <Plus className="w-4 h-4" />
          New Mock
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-5 bg-neutral-200 rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-neutral-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : mocks.length === 0 ? (
        <div className="card p-12 text-center">
          <BookOpen className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500">No mock tests yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mocks.map((mock) => (
            <div
              key={mock.id}
              className={`card p-5 cursor-pointer transition-all ${selectedMock?.id === mock.id ? 'ring-2 ring-primary-500' : 'hover:shadow-md'}`}
              onClick={() => setSelectedMock(mock)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-neutral-900">{mock.title}</h3>
                    {mock.is_published ? (
                      <span className="badge-success">Published</span>
                    ) : (
                      <span className="badge-neutral">Draft</span>
                    )}
                  </div>
                  {mock.description && (
                    <p className="text-sm text-neutral-500 line-clamp-1">{mock.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-neutral-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      VARC {Math.round(mock.section_duration_varc / 60)}m
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      DILR {Math.round(mock.section_duration_dilr / 60)}m
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      QA {Math.round(mock.section_duration_qa / 60)}m
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => openEditor(mock)} className="btn-ghost p-2" title="Edit">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteConfirm(mock)} className="btn-ghost p-2 text-error-500" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteConfirm && (
        <DeleteConfirmModal
          title="Delete Mock Test"
          message={`Are you sure you want to delete "${deleteConfirm.title}"? This will also delete all questions, grading sheets, and access for this mock. This cannot be undone.`}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={async () => {
            await supabase.from('mocks').delete().eq('id', deleteConfirm.id);
            setDeleteConfirm(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function MockEditor({ mock, onClose, onSaved }: { mock: Mock | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(mock?.title || '');
  const [description, setDescription] = useState(mock?.description || '');
  const [varcDuration, setVarcDuration] = useState(mock ? Math.round(mock.section_duration_varc / 60) : 40);
  const [dilrDuration, setDilrDuration] = useState(mock ? Math.round(mock.section_duration_dilr / 60) : 40);
  const [qaDuration, setQaDuration] = useState(mock ? Math.round(mock.section_duration_qa / 60) : 40);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const data = {
        title,
        description: description || null,
        section_duration_varc: varcDuration * 60,
        section_duration_dilr: dilrDuration * 60,
        section_duration_qa: qaDuration * 60,
      };

      if (mock) {
        const { error } = await supabase.from('mocks').update(data).eq('id', mock.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('mocks').insert(data);
        if (error) throw error;
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-neutral-900">{mock ? 'Edit Mock' : 'New Mock'}</h2>
        <button onClick={onClose} className="btn-ghost p-2">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="card p-6 max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="Mock Test 1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Description (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input min-h-[80px]" placeholder="A brief description of this mock test" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">VARC (min)</label>
              <input type="number" value={varcDuration} onChange={(e) => setVarcDuration(Number(e.target.value))} className="input" min="1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">DILR (min)</label>
              <input type="number" value={dilrDuration} onChange={(e) => setDilrDuration(Number(e.target.value))} className="input" min="1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">QA (min)</label>
              <input type="number" value={qaDuration} onChange={(e) => setQaDuration(Number(e.target.value))} className="input" min="1" />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-error-50 border border-error-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-error-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-error-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} disabled={saving || !title} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// QUESTIONS TAB
// ═══════════════════════════════════════════
function QuestionsTab({
  mocks, selectedMock, setSelectedMock,
}: {
  mocks: Mock[];
  selectedMock: Mock | null;
  setSelectedMock: (m: Mock | null) => void;
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [activeSection, setActiveSection] = useState<Section>('VARC');
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());

  const fetchQuestions = useCallback(async () => {
    if (!selectedMock) return;
    setLoading(true);
    const { data: qData } = await supabase
      .from('questions')
      .select('*')
      .eq('mock_id', selectedMock.id)
      .order('section', { ascending: true })
      .order('display_order', { ascending: true });
    setQuestions((qData as Question[]) || []);

    const { data: setData } = await supabase
      .from('question_sets')
      .select('*')
      .eq('mock_id', selectedMock.id)
      .order('display_order', { ascending: true });
    setQuestionSets((setData as QuestionSet[]) || []);
    setLoading(false);
  }, [selectedMock]);

  useEffect(() => {
    if (selectedMock) fetchQuestions();
  }, [selectedMock, fetchQuestions]);

  const sectionQuestions = questions.filter((q) => q.section === activeSection);
  const sectionSets = questionSets.filter((s) => s.section === activeSection);
  const standaloneQuestions = sectionQuestions.filter((q) => !q.set_id);

  const toggleSet = (setId: string) => {
    setExpandedSets((prev) => {
      const next = new Set(prev);
      if (next.has(setId)) next.delete(setId);
      else next.add(setId);
      return next;
    });
  };

  if (!selectedMock && mocks.length > 0) {
    return (
      <div className="card p-12 text-center">
        <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
        <p className="text-neutral-500 mb-4">Select a mock test from the Mock Tests tab to manage questions.</p>
      </div>
    );
  }

  if (mocks.length === 0) {
    return (
      <div className="card p-12 text-center">
        <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
        <p className="text-neutral-500">Create a mock test first before adding questions.</p>
      </div>
    );
  }

  if (showEditor) {
    return (
      <QuestionEditor
        mock={selectedMock!}
        question={editingQuestion}
        questionSets={questionSets}
        onClose={() => { setShowEditor(false); setEditingQuestion(null); }}
        onSaved={() => { setShowEditor(false); setEditingQuestion(null); fetchQuestions(); }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">Questions</h2>
          {selectedMock && <p className="text-sm text-neutral-500 mt-0.5">{selectedMock.title}</p>}
        </div>
        <button onClick={() => { setEditingQuestion(null); setShowEditor(true); }} disabled={!selectedMock} className="btn-primary">
          <Plus className="w-4 h-4" />
          Add Question
        </button>
      </div>

      {selectedMock && (
        <>
          {/* Section selector */}
          <div className="flex gap-1 p-1 bg-neutral-100 rounded-lg mb-4 w-fit">
            {SECTION_ORDER.map((sec) => (
              <button
                key={sec}
                onClick={() => setActiveSection(sec)}
                className={`py-1.5 px-4 rounded-md text-sm font-medium transition-all ${
                  activeSection === sec ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {sec}
                <span className="ml-1.5 text-xs text-neutral-400">
                  ({questions.filter((q) => q.section === sec).length})
                </span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card p-4 animate-pulse">
                  <div className="h-4 bg-neutral-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-neutral-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : sectionQuestions.length === 0 && sectionSets.length === 0 ? (
            <div className="card p-12 text-center">
              <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500">No questions in {activeSection} yet. Click "Add Question" to create one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Grouped by sets */}
              {sectionSets.map((set) => {
                const setQuestions = sectionQuestions.filter((q) => q.set_id === set.id);
                const isExpanded = expandedSets.has(set.id);
                return (
                  <div key={set.id} className="card overflow-hidden">
                    <div
                      className="p-4 cursor-pointer hover:bg-neutral-50 flex items-center gap-3"
                      onClick={() => toggleSet(set.id)}
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-neutral-400" /> : <ChevronRight className="w-4 h-4 text-neutral-400" />}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-700">
                          Set {set.display_order + 1} — {set.passage_text?.slice(0, 80) || 'No passage'}{set.passage_text && set.passage_text.length > 80 ? '...' : ''}
                        </p>
                        <p className="text-xs text-neutral-400">{setQuestions.length} questions</p>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-neutral-100">
                        {setQuestions.map((q, idx) => (
                          <QuestionRow key={q.id} question={q} index={idx} onEdit={() => { setEditingQuestion(q); setShowEditor(true); }} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Standalone questions */}
              {standaloneQuestions.map((q, idx) => (
                <div key={q.id} className="card">
                  <QuestionRow question={q} index={idx} onEdit={() => { setEditingQuestion(q); setShowEditor(true); }} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function QuestionRow({ question, index, onEdit }: { question: Question; index: number; onEdit: () => void }) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  if (deleteConfirm) {
    return (
      <div className="p-4 bg-error-50 flex items-center justify-between">
        <p className="text-sm text-error-700">Delete this question?</p>
        <div className="flex gap-2">
          <button onClick={() => setDeleteConfirm(false)} className="btn-secondary text-xs">Cancel</button>
          <button onClick={async () => {
            await supabase.from('questions').delete().eq('id', question.id);
            setDeleteConfirm(false);
            window.location.reload();
          }} className="btn-danger text-xs">Delete</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-neutral-400">Q{index + 1}</span>
          <span className={`badge ${question.question_type === 'MCQ' ? 'badge-primary' : 'badge-neutral'}`}>{question.question_type}</span>
          {question.difficulty && (
            <span className={`badge ${
              question.difficulty === 'easy' ? 'badge-success' :
              question.difficulty === 'medium' ? 'badge-warning' : 'badge-error'
            }`}>{question.difficulty}</span>
          )}
          <span className="text-xs text-neutral-400">+{question.marks}/-{question.negative_marks}</span>
        </div>
        <p className="text-sm text-neutral-700 line-clamp-2">{question.question_text}</p>
        <p className="text-xs text-neutral-400 mt-1">Correct: {question.correct_answer}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onEdit} className="btn-ghost p-2" title="Edit">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setDeleteConfirm(true)} className="btn-ghost p-2 text-error-500" title="Delete">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function QuestionEditor({
  mock, question, questionSets, onClose, onSaved,
}: {
  mock: Mock;
  question: Question | null;
  questionSets: QuestionSet[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [section, setSection] = useState<Section>(question?.section || 'VARC');
  const [questionType, setQuestionType] = useState<QuestionType>(question?.question_type || 'MCQ');
  const [questionText, setQuestionText] = useState(question?.question_text || '');
  const [imageUrl, setImageUrl] = useState(question?.image_url || '');
  const [correctAnswer, setCorrectAnswer] = useState(question?.correct_answer || '');
  const [answerTolerance, setAnswerTolerance] = useState(question?.answer_tolerance || 0);
  const [marks, setMarks] = useState(question?.marks || 3);
  const [negativeMarks, setNegativeMarks] = useState(question?.negative_marks || 1);
  const [difficulty, setDifficulty] = useState<Difficulty | ''>(question?.difficulty || '');
  const [displayOrder, setDisplayOrder] = useState(question?.display_order || 0);
  const [setId, setSetId] = useState<string | ''>(question?.set_id || '');
  const [options, setOptions] = useState<{ id: string; text: string }[]>(
    question?.options || [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }]
  );
  const [passageText, setPassageText] = useState('');
  const [passageImageUrl, setPassageImageUrl] = useState('');
  const [showNewSet, setShowNewSet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sectionSets = questionSets.filter((s) => s.section === section);

  const updateOption = (idx: number, text: string) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, text } : o)));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      let finalSetId = setId || null;

      // Create new question set if needed
      if (showNewSet && passageText) {
        const { data: newSet, error: setErr } = await supabase
          .from('question_sets')
          .insert({
            mock_id: mock.id,
            section,
            passage_text: passageText,
            passage_image_url: passageImageUrl || null,
            display_order: sectionSets.length,
          })
          .select()
          .single();
        if (setErr) throw setErr;
        finalSetId = newSet.id;
      }

      const data = {
        mock_id: mock.id,
        set_id: finalSetId,
        section,
        display_order: displayOrder,
        question_type: questionType,
        question_text: questionText,
        image_url: imageUrl || null,
        options: questionType === 'MCQ' ? options : null,
        correct_answer: correctAnswer,
        answer_tolerance: answerTolerance,
        marks,
        negative_marks: negativeMarks,
        difficulty: difficulty || null,
      };

      if (question) {
        const { error } = await supabase.from('questions').update(data).eq('id', question.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('questions').insert(data);
        if (error) throw error;
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-neutral-900">{question ? 'Edit Question' : 'New Question'}</h2>
        <button onClick={onClose} className="btn-ghost p-2">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="card p-6 max-w-3xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Section</label>
            <select value={section} onChange={(e) => { setSection(e.target.value as Section); setSetId(''); setShowNewSet(false); }} className="input">
              {SECTION_ORDER.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Question Type</label>
            <select value={questionType} onChange={(e) => setQuestionType(e.target.value as QuestionType)} className="input">
              <option value="MCQ">MCQ (Multiple Choice)</option>
              <option value="TITA">TITA (Type in the Answer)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Question Set (optional)</label>
          <div className="flex gap-2">
            <select value={setId} onChange={(e) => { setSetId(e.target.value); setShowNewSet(false); }} className="input flex-1">
              <option value="">No set (standalone)</option>
              {sectionSets.map((s) => (
                <option key={s.id} value={s.id}>Set {s.display_order + 1}: {s.passage_text?.slice(0, 50) || 'No passage'}...</option>
              ))}
            </select>
            <button onClick={() => setShowNewSet(!showNewSet)} className="btn-secondary">
              {showNewSet ? 'Cancel' : 'New Set'}
            </button>
          </div>
          {showNewSet && (
            <div className="mt-3 p-4 bg-neutral-50 rounded-lg space-y-3 animate-fade-in">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Passage Text</label>
                <textarea value={passageText} onChange={(e) => setPassageText(e.target.value)} className="input min-h-[80px]" placeholder="Paste the reading comprehension passage or DILR data set here..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Passage Image URL (optional)</label>
                <input type="text" value={passageImageUrl} onChange={(e) => setPassageImageUrl(e.target.value)} className="input" placeholder="https://..." />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Question Text</label>
          <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} className="input min-h-[100px]" placeholder="Enter the question..." />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Image URL (optional)</label>
          <input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="input" placeholder="https://..." />
        </div>

        {questionType === 'MCQ' && (
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Options</label>
            <p className="text-xs text-neutral-400 mb-2">Enter the correct answer's option ID (a, b, c, or d) in the "Correct Answer" field below.</p>
            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {opt.id.toUpperCase()}
                  </div>
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => updateOption(idx, e.target.value)}
                    className="input"
                    placeholder={`Option ${opt.id.toUpperCase()}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Correct Answer</label>
            <input
              type="text"
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
              className="input"
              placeholder={questionType === 'MCQ' ? 'e.g., a' : 'e.g., 42.5'}
            />
          </div>
          {questionType === 'TITA' && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Answer Tolerance</label>
              <input
                type="number"
                value={answerTolerance}
                onChange={(e) => setAnswerTolerance(Number(e.target.value))}
                className="input"
                step="0.01"
                placeholder="0"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Marks</label>
            <input type="number" value={marks} onChange={(e) => setMarks(Number(e.target.value))} className="input" step="0.5" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Negative Marks</label>
            <input type="number" value={negativeMarks} onChange={(e) => setNegativeMarks(Number(e.target.value))} className="input" step="0.5" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty | '')} className="input">
              <option value="">None</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Display Order</label>
          <input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value))} className="input w-32" />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-error-50 border border-error-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-error-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-error-700">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving || !questionText || !correctAnswer} className="btn-primary flex-1">
            {saving ? 'Saving...' : 'Save Question'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// GRADING TAB
// ═══════════════════════════════════════════
function GradingTab({
  mocks, selectedMock, setSelectedMock,
}: {
  mocks: Mock[];
  selectedMock: Mock | null;
  setSelectedMock: (m: Mock | null) => void;
}) {
  const [sheets, setSheets] = useState<GradingSheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [activeScope, setActiveScope] = useState<GradingScope>('overall');

  const fetchSheets = useCallback(async () => {
    if (!selectedMock) return;
    setLoading(true);
    const { data } = await supabase
      .from('grading_sheets')
      .select('*')
      .eq('mock_id', selectedMock.id)
      .order('scope', { ascending: true })
      .order('raw_marks', { ascending: false });
    setSheets((data as GradingSheet[]) || []);
    setLoading(false);
  }, [selectedMock]);

  useEffect(() => {
    if (selectedMock) fetchSheets();
  }, [selectedMock, fetchSheets]);

  const scopeSheets = sheets.filter((s) => s.scope === activeScope);
  const scopes: GradingScope[] = ['overall', 'VARC', 'DILR', 'QA'];

  if (mocks.length === 0) {
    return <div className="card p-12 text-center"><Award className="w-12 h-12 text-neutral-300 mx-auto mb-3" /><p className="text-neutral-500">Create a mock test first.</p></div>;
  }

  if (!selectedMock) {
    return <div className="card p-12 text-center"><Award className="w-12 h-12 text-neutral-300 mx-auto mb-3" /><p className="text-neutral-500">Select a mock test from the Mock Tests tab.</p></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">Grading Sheets</h2>
          <p className="text-sm text-neutral-500 mt-0.5">{selectedMock.title}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          Add Entry
        </button>
      </div>

      <div className="flex gap-1 p-1 bg-neutral-100 rounded-lg mb-4 w-fit">
        {scopes.map((scope) => (
          <button
            key={scope}
            onClick={() => setActiveScope(scope)}
            className={`py-1.5 px-3 rounded-md text-sm font-medium transition-all capitalize ${
              activeScope === scope ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {scope}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-8 text-center text-neutral-400">Loading...</div>
      ) : scopeSheets.length === 0 ? (
        <div className="card p-12 text-center">
          <Award className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500 mb-2">No grading entries for {activeScope}.</p>
          <p className="text-xs text-neutral-400">Add entries mapping raw marks to percentiles. The mock cannot be published without at least one overall entry.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Raw Marks</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Percentile</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Grade</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {scopeSheets.map((sheet) => (
                <tr key={sheet.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-3 text-sm font-medium text-neutral-900">{sheet.raw_marks}</td>
                  <td className="px-4 py-3 text-sm text-neutral-700">{sheet.percentile !== null ? `${sheet.percentile}%` : '—'}</td>
                  <td className="px-4 py-3 text-sm text-neutral-700">{sheet.grade || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={async () => {
                        await supabase.from('grading_sheets').delete().eq('id', sheet.id);
                        fetchSheets();
                      }}
                      className="btn-ghost p-1.5 text-error-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Publish toggle */}
      <div className="mt-6 card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-neutral-800 text-sm">Publish Status</h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              {selectedMock.is_published ? 'This mock is visible to students.' : 'This mock is a draft and not visible to students.'}
            </p>
          </div>
          <button
            onClick={async () => {
              await supabase.from('mocks').update({ is_published: !selectedMock.is_published }).eq('id', selectedMock.id);
              window.location.reload();
            }}
            className={selectedMock.is_published ? 'btn-danger' : 'btn-success'}
          >
            {selectedMock.is_published ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      {showAdd && (
        <GradingEntryModal
          mockId={selectedMock.id}
          scope={activeScope}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); fetchSheets(); }}
        />
      )}
    </div>
  );
}

function GradingEntryModal({
  mockId, scope, onClose, onSaved,
}: {
  mockId: string;
  scope: GradingScope;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rawMarks, setRawMarks] = useState(0);
  const [percentile, setPercentile] = useState<number | ''>('');
  const [grade, setGrade] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase.from('grading_sheets').insert({
        mock_id: mockId,
        scope,
        raw_marks: rawMarks,
        percentile: percentile === '' ? null : percentile,
        grade: grade || null,
      });
      if (error) throw error;
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 animate-fade-in">
      <div className="card p-6 max-w-md w-full animate-scale-in">
        <h3 className="font-semibold text-neutral-900 mb-4">Add Grading Entry ({scope})</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Raw Marks</label>
            <input type="number" value={rawMarks} onChange={(e) => setRawMarks(Number(e.target.value))} className="input" step="0.5" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Percentile (optional)</label>
            <input type="number" value={percentile} onChange={(e) => setPercentile(e.target.value === '' ? '' : Number(e.target.value))} className="input" step="0.1" placeholder="e.g., 95.5" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Grade (optional)</label>
            <input type="text" value={grade} onChange={(e) => setGrade(e.target.value)} className="input" placeholder="e.g., A+" />
          </div>
          {error && (
            <div className="flex items-start gap-2 p-3 bg-error-50 border border-error-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-error-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-error-700">{error}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Add'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// ACCESS TAB
// ═══════════════════════════════════════════
function AccessTab({
  mocks, selectedMock, setSelectedMock,
}: {
  mocks: Mock[];
  selectedMock: Mock | null;
  setSelectedMock: (m: Mock | null) => void;
}) {
  const [accessList, setAccessList] = useState<{ id: string; student: Profile }[]>([]);
  const [allStudents, setAllStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  const fetchAccess = useCallback(async () => {
    if (!selectedMock) return;
    setLoading(true);
    const { data: accessData } = await supabase
      .from('mock_access')
      .select('id, student_id')
      .eq('mock_id', selectedMock.id);
    
    if (accessData && accessData.length > 0) {
      const studentIds = (accessData as MockAccess[]).map((a) => a.student_id);
      const { data: students } = await supabase
        .from('profiles')
        .select('*')
        .in('id', studentIds)
        .eq('role', 'student');
      const studentMap = new Map<string, Profile>();
      (students as Profile[] || []).forEach((s) => studentMap.set(s.id, s));
      const list = (accessData as MockAccess[]).map((a) => ({
        id: a.id,
        student: studentMap.get(a.student_id)!,
      })).filter((item) => item.student);
      setAccessList(list);
    } else {
      setAccessList([]);
    }

    const { data: allStudentsData } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('created_at', { ascending: false });
    setAllStudents((allStudentsData as Profile[]) || []);
    setLoading(false);
  }, [selectedMock]);

  useEffect(() => {
    if (selectedMock) fetchAccess();
  }, [selectedMock, fetchAccess]);

  if (mocks.length === 0) {
    return <div className="card p-12 text-center"><Users className="w-12 h-12 text-neutral-300 mx-auto mb-3" /><p className="text-neutral-500">Create a mock test first.</p></div>;
  }

  if (!selectedMock) {
    return <div className="card p-12 text-center"><Users className="w-12 h-12 text-neutral-300 mx-auto mb-3" /><p className="text-neutral-500">Select a mock test from the Mock Tests tab.</p></div>;
  }

  const assignedIds = new Set(accessList.map((a) => a.student.id));
  const availableStudents = allStudents.filter((s) => !assignedIds.has(s.id));
  const filteredAvailable = search
    ? availableStudents.filter((s) => s.email.toLowerCase().includes(search.toLowerCase()) || (s.name && s.name.toLowerCase().includes(search.toLowerCase())))
    : availableStudents;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">Student Access</h2>
          <p className="text-sm text-neutral-500 mt-0.5">{selectedMock.title}</p>
        </div>
        <button onClick={() => setShowAdd(true)} disabled={availableStudents.length === 0} className="btn-primary">
          <Plus className="w-4 h-4" />
          Grant Access
        </button>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-neutral-400">Loading...</div>
      ) : accessList.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500">No students have access to this mock yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {accessList.map((item) => (
            <div key={item.id} className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-medium">
                  {item.student.name?.[0]?.toUpperCase() || item.student.email[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-900">{item.student.name || 'Unnamed'}</p>
                  <p className="text-xs text-neutral-500">{item.student.email}</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  await supabase.from('mock_access').delete().eq('id', item.id);
                  fetchAccess();
                }}
                className="btn-ghost p-2 text-error-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 animate-fade-in">
          <div className="card p-6 max-w-md w-full max-h-[80vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-neutral-900">Grant Access</h3>
              <button onClick={() => setShowAdd(false)} className="btn-ghost p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="input mb-3"
            />
            <div className="space-y-2">
              {filteredAvailable.length === 0 ? (
                <p className="text-sm text-neutral-400 text-center py-4">No students found.</p>
              ) : (
                filteredStudents(filteredAvailable, selectedMock.id, fetchAccess, setShowAdd)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function filteredStudents(students: Profile[], mockId: string, refresh: () => void, close: (v: boolean) => void) {
  return students.map((student) => (
    <div key={student.id} className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50">
      <div>
        <p className="text-sm font-medium text-neutral-900">{student.name || 'Unnamed'}</p>
        <p className="text-xs text-neutral-500">{student.email}</p>
      </div>
      <button
        onClick={async () => {
          await supabase.from('mock_access').insert({ mock_id: mockId, student_id: student.id });
          refresh();
          close(false);
        }}
        className="btn-primary text-xs px-3 py-1.5"
      >
        <Plus className="w-3 h-3" />
        Add
      </button>
    </div>
  ));
}

// ═══════════════════════════════════════════
// STUDENTS TAB
// ═══════════════════════════════════════════
function StudentsTab() {
  const [students, setStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false });
      setStudents((data as Profile[]) || []);
      setLoading(false);
    };
    fetchStudents();
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold text-neutral-900 mb-4">All Students</h2>
      {loading ? (
        <div className="card p-8 text-center text-neutral-400">Loading...</div>
      ) : students.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500">No students have registered yet.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Joined</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-3 text-sm font-medium text-neutral-900">{student.name || 'Unnamed'}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{student.email}</td>
                  <td className="px-4 py-3 text-sm text-neutral-400">{new Date(student.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════
function DeleteConfirmModal({
  title, message, onCancel, onConfirm,
}: {
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 animate-fade-in">
      <div className="card p-6 max-w-md w-full animate-scale-in">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-error-100 text-error-600 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900">{title}</h3>
            <p className="text-sm text-neutral-500 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
          <button onClick={onConfirm} className="btn-danger flex-1">Delete</button>
        </div>
      </div>
    </div>
  );
}
