import React, { useState, useEffect, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Applications from './pages/Applications';
import TargetCompanies from './pages/TargetCompanies';
import Pomodoro from './pages/Pomodoro';
import AITools from './pages/AITools';
import Tasks from './pages/Tasks';
import ResumePage from './pages/Resume';
import Account from './pages/Account';
import Navbar from './components/Navbar';
// import Snackbar from '@mui/material/Snackbar';
// import Alert from '@mui/material/Alert';
import { useDispatch, useSelector } from 'react-redux';
import { setUser, AppUser } from './store/authSlice';
import { AppDispatch, RootState } from './store';
import { supabase } from './lib/supabase';
import LoadingSpinner from '../src/components/LoadingSpinner';
import ResumeView from '../src/pages/ResumeView';

const theme = createTheme({
  // Your theme customizations
});

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user && location.pathname !== '/auth') {
      navigate('/auth', { replace: true });
    }
  }, [user, navigate, location]);

  if (!user && location.pathname !== '/auth') {
    return null;
  }

  return <>{children}</>;
};


function App() {
  const location = useLocation();
  const isAuthPage = location.pathname === '/auth';
  // --- New check for ResumeView page ---
  const isResumeViewPage = location.pathname.startsWith('/resume-view/');

  const dispatch = useDispatch<AppDispatch>();
  const [isAuthCheckComplete, setIsAuthCheckComplete] = useState(false);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && session.user) {
        const appUserPayload = { ...session.user, user_metadata: session.user.user_metadata || {} } as AppUser;
        dispatch(setUser({ user: appUserPayload, session: session }));
      } else {
        dispatch(setUser(null));
      }
      setIsAuthCheckComplete(true);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [dispatch]);

  if (!isAuthCheckComplete) {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <LoadingSpinner /> {/* Or your app-wide initial loading spinner */}
        </ThemeProvider>
    );
  }

  // Determine if Navbar should be shown
  const showNavbar = !isAuthPage && !isResumeViewPage;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <>
        {showNavbar && ( // --- Updated condition for Navbar ---
           <Suspense fallback={<div>Loading Nav...</div>}><Navbar /></Suspense>
        )}
        {/* --- Updated condition for main content margin --- */}
        <main className={`flex-grow w-full ${showNavbar ? 'mt-[var(--navbar-height,64px)]' : ''}`}>
             <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
                  <Route path="/applications" element={<AuthGuard><Applications /></AuthGuard>} />
                  <Route path="/target-companies" element={<AuthGuard><TargetCompanies /></AuthGuard>} />
                  <Route path="/pomodoro" element={<AuthGuard><Pomodoro /></AuthGuard>} />
                  <Route path="/ai-tools" element={<AuthGuard><AITools /></AuthGuard>} />
                  <Route path="/tasks" element={<AuthGuard><Tasks /></AuthGuard>} />
                  <Route path="/resume" element={<AuthGuard><ResumePage /></AuthGuard>} />
                  <Route path="/account" element={<AuthGuard><Account /></AuthGuard>} />
                  {/* ResumeView route remains the same, AuthGuard is correctly not applied */}
                  <Route path="/resume-view/:resumeId" element={<ResumeView />} />
                </Routes>
            </Suspense>
        </main>
      </>
    </ThemeProvider>
  );
}

export default App;