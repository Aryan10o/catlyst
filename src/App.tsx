import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AuthPage } from '@/pages/AuthPage';
import { StudentDashboard } from '@/pages/StudentDashboard';
import { TestInterface } from '@/pages/TestInterface';
import { ResultsPage } from '@/pages/ResultsPage';
import { AdminPanel } from '@/pages/AdminPanel';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useState, useEffect } from 'react';

type Route =
  | { name: 'dashboard' }
  | { name: 'test'; mockId: string }
  | { name: 'results'; attemptId: string }
  | { name: 'admin' };

function parseHash(): Route {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith('test/')) {
    return { name: 'test', mockId: hash.slice(5) };
  }
  if (hash.startsWith('results/')) {
    return { name: 'results', attemptId: hash.slice(8) };
  }
  if (hash === 'admin') {
    return { name: 'admin' };
  }
  return { name: 'dashboard' };
}

function navigate(route: Route) {
  if (route.name === 'test') {
    window.location.hash = `test/${route.mockId}`;
  } else if (route.name === 'results') {
    window.location.hash = `results/${route.attemptId}`;
  } else if (route.name === 'admin') {
    window.location.hash = 'admin';
  } else {
    window.location.hash = '';
  }
}

function AppRoutes() {
  const { session, profile, loading } = useAuth();
  const [route, setRoute] = useState<Route>(parseHash());

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!session || !profile) {
    return <AuthPage />;
  }

  if (route.name === 'test') {
    return <TestInterface mockId={route.mockId} onNavigate={navigate} />;
  }

  if (route.name === 'results') {
    return <ResultsPage attemptId={route.attemptId} onNavigate={navigate} />;
  }

  if (route.name === 'admin' && profile.role === 'admin') {
    return <AdminPanel onNavigate={navigate} />;
  }

  return <StudentDashboard onNavigate={navigate} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export { navigate };
export type { Route };
