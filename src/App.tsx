import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useThemeStore } from './store/useThemeStore';
import { useAuthStore } from './store/useAuthStore';
import { supabase } from './lib/supabase';
import { Toaster } from 'sonner';
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

// Conditionally import Navbar
const Navbar = React.lazy(() => import('./components/Navbar'));

// Create a layout component that conditionally renders the Navbar
function AppLayout() {
  const location = useLocation();
  const theme = useThemeStore((state) => state.theme);
  
  // Check if current route is auth page
  const isAuthPage = location.pathname === '/auth';
  
  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {!isAuthPage && <React.Suspense fallback={<div></div>}><Navbar /></React.Suspense>}
      <main className={isAuthPage ? '' : 'container mx-auto px-4 py-8'}>
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
  );
}

function App() {
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
      <AppLayout />
    </Router>
  );
}

export default App;