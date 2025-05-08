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
// import Snackbar from '@mui/material/Snackbar'; // Commented out as related state is
// import Alert from '@mui/material/Alert';     // Commented out as related state is
import { useDispatch, useSelector } from 'react-redux';
import { setUser, AppUser } from './store/authSlice';
import { AppDispatch, RootState } from './store'; // Verify this path is correct for your store file
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
      // Intentionally leaving this log in case the redirect issue persists,
      // but if you want all logs from App.tsx context gone, remove this too.
      // console.log('AuthGuard: No user found, redirecting to /auth.');
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
  // --- Snackbar state and handler commented out as it's currently unused in App.tsx ---
  // const [snackbarOpen, setSnackbarOpen] = useState(false);
  // const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  // const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning' | undefined>(undefined);
  const dispatch = useDispatch<AppDispatch>();

  const [isAuthCheckComplete, setIsAuthCheckComplete] = useState(false);
  // const userFromReduxForAppRender = useSelector((state: RootState) => state.auth.user); // No longer needed for logging

  useEffect(() => {
    // console.log('[App.tsx] Setting up onAuthStateChange listener (Effect runs).');
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      // console.log(
      //   `[App.tsx onAuthStateChange CALLBACK] Event: ${_event}, HasSession: ${!!session}, UserEmail: ${session?.user?.email}`,
      //   `FullSessionObject: ${JSON.stringify(session)}`
      // );

      if (session && session.user) {
        const appUserPayload = { ...session.user, user_metadata: session.user.user_metadata || {} } as AppUser;
        dispatch(setUser({ user: appUserPayload, session: session }));
        // console.log('[App.tsx onAuthStateChange CALLBACK] Dispatched setUser with VALID USER data.');
      } else {
        dispatch(setUser(null));
        // console.log('[App.tsx onAuthStateChange CALLBACK] Dispatched setUser with NULL.');
      }

      setIsAuthCheckComplete(prevIsAuthCheckComplete => {
        if (!prevIsAuthCheckComplete) {
          // console.log('[App.tsx onAuthStateChange CALLBACK] Initial auth determination complete. isAuthCheckComplete set to true.');
          return true;
        }
        return prevIsAuthCheckComplete;
      });
    });

    return () => {
      // console.log('[App.tsx] Unsubscribing from onAuthStateChange listener (Effect cleanup).');
      authListener?.subscription.unsubscribe();
    };
  }, [dispatch]);

  // --- Snackbar handler commented out as it's currently unused in App.tsx ---
  // const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
  //   setSnackbarMessage(message);
  //   setSnackbarSeverity(severity);
  //   setSnackbarOpen(true);
  // };

  // const handleSnackbarClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
  //   if (reason === 'clickaway') {
  //     return;
  //   }
  //   // setSnackbarOpen(false);
  // };

  if (!isAuthCheckComplete) {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <LoadingSpinner />
        </ThemeProvider>
    );
  }

  // console.log(
  //   '[App.tsx] Rendering main app. isAuthCheckComplete is true. User from Redux for AuthGuard:',
  //   JSON.stringify(userFromReduxForAppRender, null, 2)
  // );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <>
        {!isAuthPage && (
           <Suspense fallback={<div>Loading Nav...</div>}><Navbar /></Suspense>
        )}
        <main className={`flex-grow w-full ${isAuthPage ? '' : 'mt-[var(--navbar-height,64px)]'}`}>
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
                  <Route path="/resume-view/:resumeId" element={<ResumeView />} />
                </Routes>
            </Suspense>
        </main>

        {/* Snackbar commented out as its state and handler are currently commented out */}
        {/* {snackbarMessage && (
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
        )} */}
      </>
    </ThemeProvider>
  );
}

export default App;