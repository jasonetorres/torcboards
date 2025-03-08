import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useThemeStore } from './store/useThemeStore';
import { useAuthStore } from './store/useAuthStore';
import { supabase } from './lib/supabase';
import { Toaster } from 'sonner';
import Navbar from './components/Navbar';
import AuthGuard from './components/AuthGuard';
import Dashboard from './pages/Dashboard';
import Applications from './pages/Applications';
import TargetCompanies from './pages/TargetCompanies';
import Pomodoro from './pages/Pomodoro';
import AITools from './pages/AITools';
import Tasks from './pages/Tasks';
import Resume from './pages/Resume';
import Account from './pages/Account';
import Auth from './pages/Auth';

function App() {
  const theme = useThemeStore((state) => state.theme);
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    // Set up auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [setUser]);

  return (
    <Router>
      <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
            <Route path="/applications" element={<AuthGuard><Applications /></AuthGuard>} />
            <Route path="/target-companies" element={<AuthGuard><TargetCompanies /></AuthGuard>} />
            <Route path="/pomodoro" element={<AuthGuard><Pomodoro /></AuthGuard>} />
            <Route path="/ai-tools" element={<AuthGuard><AITools /></AuthGuard>} />
            <Route path="/tasks" element={<AuthGuard><Tasks /></AuthGuard>} />
            <Route path="/resume" element={<AuthGuard><Resume /></AuthGuard>} />
            <Route path="/account" element={<AuthGuard><Account /></AuthGuard>} />
          </Routes>
        </main>
        <Toaster position="top-right" theme={theme} />
      </div>
    </Router>
  );
}

export default App;