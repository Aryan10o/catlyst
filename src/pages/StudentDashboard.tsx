import { useEffect, useState } from 'react';
import { GraduationCap, LogOut, Clock, FileText, Trophy, Play, RefreshCw, Eye, ChevronRight, Shield, BookOpen, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Mock, Attempt, MockAccess } from '@/types';
import type { Route } from '@/App';

interface DashboardMock {
  mock: Mock;
  attempt: Attempt | null;
}

export function StudentDashboard({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { profile, signOut } = useAuth();
  const [mocks, setMocks] = useState<DashboardMock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    const { data: accessRows } = await supabase
      .from('mock_access')
      .select('mock_id')
      .eq('student_id', profile!.id);

    if (!accessRows || accessRows.length === 0) {
      setMocks([]);
      setLoading(false);
      return;
    }

    const mockIds = (accessRows as MockAccess[]).map((a) => a.mock_id);
    const { data: mockRows } = await supabase
      .from('mocks')
      .select('*')
      .in('id', mockIds)
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (!mockRows) {
      setMocks([]);
      setLoading(false);
      return;
    }

    const { data: attemptRows } = await supabase
      .from('attempts')
      .select('*')
      .eq('student_id', profile!.id)
      .in('mock_id', mockIds);

    const attemptMap = new Map<string, Attempt>();
    (attemptRows || []).forEach((a: Attempt) => attemptMap.set(a.mock_id, a));

    const dashboardMocks: DashboardMock[] = (mockRows as Mock[]).map((mock) => ({
      mock,
      attempt: attemptMap.get(mock.id) || null,
    }));

    setMocks(dashboardMocks);
    setLoading(false);
  };

  const getButtonState = (attempt: Attempt | null) => {
    if (!attempt || attempt.status === 'not_started') return 'start';
    if (attempt.status === 'in_progress' || attempt.status === 'paused') return 'resume';
    return 'results';
  };

  const totalDuration = (mock: Mock) => {
    return Math.round((mock.section_duration_varc + mock.section_duration_dilr + mock.section_duration_qa) / 60);
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-600 text-white flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-neutral-900">CAT Mock Test</h1>
              <p className="text-xs text-neutral-500">Student Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {profile?.role === 'admin' && (
              <button onClick={() => onNavigate({ name: 'admin' })} className="btn-secondary text-sm">
                <Settings className="w-4 h-4" />
                Admin Panel
              </button>
            )}
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-neutral-700">{profile?.name || profile?.email}</p>
              <p className="text-xs text-neutral-400">{profile?.role === 'admin' ? 'Admin' : 'Student'}</p>
            </div>
            <button onClick={signOut} className="btn-ghost p-2" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-neutral-900">Welcome back, {profile?.name?.split(' ')[0] || 'Student'}</h2>
          <p className="text-neutral-500 mt-1">Your assigned mock tests are ready below.</p>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-6 animate-pulse">
                <div className="h-5 bg-neutral-200 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-neutral-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-neutral-200 rounded w-2/3 mb-6"></div>
                <div className="h-10 bg-neutral-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : mocks.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neutral-100 mb-4">
              <BookOpen className="w-8 h-8 text-neutral-400" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-700 mb-2">No tests assigned yet</h3>
            <p className="text-sm text-neutral-500">Your instructor will assign mock tests to you. Check back later.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mocks.map(({ mock, attempt }) => {
              const btnState = getButtonState(attempt);
              return (
                <div key={mock.id} className="card p-6 hover:shadow-md transition-shadow duration-200 flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-neutral-900 text-lg leading-tight">{mock.title}</h3>
                    {btnState === 'results' && (
                      <span className="badge-success">Completed</span>
                    )}
                    {btnState === 'resume' && (
                      <span className="badge-warning">In Progress</span>
                    )}
                    {btnState === 'start' && (
                      <span className="badge-primary">New</span>
                    )}
                  </div>

                  {mock.description && (
                    <p className="text-sm text-neutral-500 mb-4 line-clamp-2">{mock.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-neutral-500 mb-4">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{totalDuration(mock)} min total</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      <span>3 sections</span>
                    </div>
                  </div>

                  <div className="mt-auto">
                    {btnState === 'start' && (
                      <button
                        onClick={() => onNavigate({ name: 'test', mockId: mock.id })}
                        className="btn-primary w-full"
                      >
                        <Play className="w-4 h-4" />
                        Start Test
                      </button>
                    )}
                    {btnState === 'resume' && (
                      <button
                        onClick={() => onNavigate({ name: 'test', mockId: mock.id })}
                        className="btn-primary w-full"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Resume Test
                      </button>
                    )}
                    {btnState === 'results' && attempt && (
                      <button
                        onClick={() => onNavigate({ name: 'results', attemptId: attempt.id })}
                        className="btn-secondary w-full"
                      >
                        <Trophy className="w-4 h-4" />
                        View Result
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-12 card p-6 bg-gradient-to-br from-primary-50 to-secondary-50/50 border-primary-100">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-800 mb-1">Test Guidelines</h3>
              <ul className="text-sm text-neutral-600 space-y-1">
                <li>Each test has 3 timed sections: VARC, DILR, and QA</li>
                <li>Once a section starts, you cannot pause or revisit it after time expires</li>
                <li>Switching tabs or exiting fullscreen will be logged as violations</li>
                <li>You can attempt each mock test only once</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
