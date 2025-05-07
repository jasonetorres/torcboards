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
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { useDispatch, useSelector } from 'react-redux';
import { setUser } from './store/authSlice';
import { supabase } from './lib/supabase';
import type { RootState } from './store';
import LoadingSpinner from '../src/components/LoadingSpinner'; 

const theme = createTheme({
  // Your theme customizations
});

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // This logic is now safe because App waits for auth check
    if (!user && location.pathname !== '/auth') {
      console.log('AuthGuard: No user found, redirecting to /auth');
      navigate('/auth', { replace: true });
    }
    // Optional: Redirect logged-in users away from /auth
    // else if (user && location.pathname === '/auth') {
    //   console.log('AuthGuard: User found, redirecting from /auth to /');
    //   navigate('/', { replace: true });
    // }
  }, [user, navigate, location]);

  // If checks are still running higher up, this might not even render yet.
  // If redirecting, return null to prevent rendering children briefly.
  if (!user && location.pathname !== '/auth') {
     return null;
  }

  return <>{children}</>; // Render protected content
};


function App() {
  const location = useLocation();
  const isAuthPage = location.pathname === '/auth';
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning' | undefined>(undefined);
  const dispatch = useDispatch();

  // --- State to track if initial auth check is complete ---
  const [isAuthCheckComplete, setIsAuthCheckComplete] = useState(false);
  // ---------------------------------------------------------

  useEffect(() => {
    // No need to manually call getSession() here,
    // onAuthStateChange handles the initial check automatically.

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {

      dispatch(setUser(session?.user ?? null));

      // --- Mark the initial auth check as complete ---
      // This runs once when the listener is first attached and Supabase
      // has checked localStorage/confirmed the initial state.
      // It also runs on subsequent SIGNED_IN/SIGNED_OUT events.
      setIsAuthCheckComplete(true);
      // -------------------------------------------------

      // Example snackbar logic based on events:
      // if (event === 'SIGNED_IN') showSnackbar('Logged in successfully!', 'success');
      // if (event === 'SIGNED_OUT') showSnackbar('Logged out.', 'info');
    });

    // Cleanup the listener when the component unmounts
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [dispatch]); // Dependency array includes dispatch

  // App-level Snackbar handler
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  // --- Render loading indicator until initial auth check is done ---
  if (!isAuthCheckComplete) {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <LoadingSpinner /> {/* Display loading state */}
        </ThemeProvider>
    );
  }
  // ---------------------------------------------------------------

  // --- Render the main app once auth check is complete ---
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <>
        {!isAuthPage && (
           <Suspense fallback={<div>Loading Nav...</div>}><Navbar /></Suspense>
        )}
        {/* Adjusted padding - consider structure if Navbar has fixed height */}
        <main className={`flex-grow w-full ${isAuthPage ? '' : 'mt-[var(--navbar-height,64px)]'}`}> {/* Example assuming Navbar height variable */}
             <Suspense fallback={<LoadingSpinner />}> {/* Use LoadingSpinner here too */}
                <Routes>
                  {/* Auth route doesn't need the guard */}
                  <Route path="/auth" element={<Auth />} />

                  {/* Protected routes wrapped by AuthGuard */}
                  <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
                  <Route path="/applications" element={<AuthGuard><Applications /></AuthGuard>} />
                  <Route path="/target-companies" element={<AuthGuard><TargetCompanies /></AuthGuard>} />
                  <Route path="/pomodoro" element={<AuthGuard><Pomodoro /></AuthGuard>} />
                  <Route path="/ai-tools" element={<AuthGuard><AITools /></AuthGuard>} />
                  <Route path="/tasks" element={<AuthGuard><Tasks /></AuthGuard>} />
                  <Route path="/resume" element={<AuthGuard><ResumePage /></AuthGuard>} />
                  <Route path="/account" element={<AuthGuard><Account /></AuthGuard>} />

                  {/* Decide if ResumeView needs auth */}
                  {/* <Route path="/resume-view/:resumeId" element={<AuthGuard><ResumeView /></AuthGuard>} /> */}
                  {/* Or if it's public: */}
                  {/* <Route path="/resume-view/:resumeId" element={<ResumeView />} /> */}

                  {/* Catch-all 404 */}
                  {/* <Route path="*" element={<NotFoundPage />} /> */}
                </Routes>
            </Suspense>
        </main>

        {snackbarMessage && (
           <Snackbar
              open={snackbarOpen}
              autoHideDuration={6000}
              onClose={handleSnackbarClose}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
           >
              <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }} variant="filled">
                {snackbarMessage}
              </Alert>
           </Snackbar>
        )}

        {/* {!isAuthPage && <Footer />} */}
      </>
    </ThemeProvider>
  );
}

export default App;

// --- Simple Loading Spinner Example (components/LoadingSpinner.tsx) ---
// Create this file if you don't have one
/*
import React from 'react';

const LoadingSpinner = () => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div style={{
        border: '4px solid rgba(0, 0, 0, 0.1)',
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        borderLeftColor: '#09f', // Or your primary color
        animation: 'spin 1s ease infinite',
      }}></div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;
*/
// ---------------------------------------------------------------------