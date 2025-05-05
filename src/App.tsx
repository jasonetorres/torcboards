import React, { useState, useEffect, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles'; // Import ThemeProvider and createTheme
import CssBaseline from '@mui/material/CssBaseline'; // Optional: for baseline styling normalization
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Applications from './pages/Applications';
import TargetCompanies from './pages/TargetCompanies';
import Pomodoro from './pages/Pomodoro';
import AITools from './pages/AITools';
import Tasks from './pages/Tasks';
import ResumePage from './pages/Resume';
import Account from './pages/Account';
import ResumeView from './pages/Resume'; // Assuming ResumeView is correct, maybe alias ResumePage?
import Navbar from './components/Navbar';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { useDispatch, useSelector } from 'react-redux';
import { setUser } from './store/authSlice';
import { supabase } from './lib/supabase';
import type { RootState } from './store'; // Import RootState for typed useSelector

// Define a basic theme (you can customize this later)
const theme = createTheme({
  // Example customization:
  // palette: {
  //   mode: 'light', // or 'dark'
  // },
});

// AuthGuard remains the same
const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  // Use RootState type for useSelector
  const user = useSelector((state: RootState) => state.auth.user);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // No change needed here, but ensure '/auth' logic is exactly as intended
    if (!user && location.pathname !== '/auth') {
      // Redirect to '/auth' if not authenticated and not already on '/auth'
      navigate('/auth', { replace: true }); // Using replace: true is often good practice here
    }
    // If user IS authenticated and tries to access '/auth', you might want to redirect them away
    // else if (user && location.pathname === '/auth') {
    //   navigate('/', { replace: true }); // Redirect to dashboard or home
    // }
  }, [user, navigate, location]);

  // Render children only if user exists when not on auth page.
  // If on auth page, it should render regardless (handled by Route itself)
  // Or simpler: let the Route handle rendering Auth page, guard protects others.
  // Render children if user exists OR if it's the auth page itself being rendered through the guard (unlikely setup)
  // Let's assume AuthGuard only wraps protected routes as intended.
  if (!user && location.pathname !== '/auth') {
     return null; // Don't render children if redirecting
  }

  return <>{children}</>; // Render protected content
};


function App() {
  const location = useLocation();
  const isAuthPage = location.pathname === '/auth';
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  // Adjusted type to match Alert's severity prop more closely
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning' | undefined>(undefined);
  const dispatch = useDispatch();

  useEffect(() => {
    // Fetch initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      dispatch(setUser(session?.user ?? null));
    }).catch(error => console.error("Error getting session:", error)); // Add error handling

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      dispatch(setUser(session?.user ?? null));
      // Optionally show snackbar on login/logout?
      // if (_event === 'SIGNED_IN') showSnackbar('Logged in successfully!', 'success');
      // if (_event === 'SIGNED_OUT') showSnackbar('Logged out.', 'info');
    });

    // Cleanup the listener when the component unmounts
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [dispatch]);


  // App-level Snackbar handler (if needed for global notifications)
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

  return (
    // Wrap the entire returned JSX with ThemeProvider
    <ThemeProvider theme={theme}>
      {/* CssBaseline is optional but recommended */}
      <CssBaseline />
      {/* Using a Fragment <></> here is fine if no extra wrapper div needed */}
      <>
        {/* Render Navbar unless on the Auth page */}
        {!isAuthPage && (
           <Suspense fallback={<div>Loading Nav...</div>}><Navbar /></Suspense>
        )}

        {/* Main content area */}
        {/* Adjusted padding based on isAuthPage potentially */}
        <main className={`flex-grow ${isAuthPage ? '' : 'pt-4 pb-8 sm:px-6 lg:px-8'}`}> {/* Example padding adjustment */}
            {/* Use Suspense for lazy loaded route components if needed */}
             <Suspense fallback={<div>Loading Page...</div>}>
                <Routes>
                  {/* Public route */}
                  <Route path="/auth" element={<Auth />} />

                  {/* Protected routes */}
                  <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
                  <Route path="/applications" element={<AuthGuard><Applications /></AuthGuard>} />
                  <Route path="/target-companies" element={<AuthGuard><TargetCompanies /></AuthGuard>} />
                  <Route path="/pomodoro" element={<AuthGuard><Pomodoro /></AuthGuard>} />
                  <Route path="/ai-tools" element={<AuthGuard><AITools /></AuthGuard>} />
                  <Route path="/tasks" element={<AuthGuard><Tasks /></AuthGuard>} />
                  <Route path="/resume" element={<AuthGuard><ResumePage /></AuthGuard>} />
                  <Route path="/account" element={<AuthGuard><Account /></AuthGuard>} />

                  {/* Consider if ResumeView needs AuthGuard */}
                  <Route path="/resume-view/:resumeId" element={<ResumeView />} />

                  {/* Optional: Add a catch-all route for 404 */}
                  {/* <Route path="*" element={<NotFoundPage />} /> */}
                </Routes>
            </Suspense>
        </main>

        {/* App-level Snackbar for global notifications */}
        {/* Make sure snackbarMessage is not null before rendering Alert */}
        {snackbarMessage && (
           <Snackbar
              open={snackbarOpen}
              autoHideDuration={6000}
              onClose={handleSnackbarClose}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }} // Or your preferred location
              // Optionally add sx prop here too if needed for z-index
              // sx={{ zIndex: 1500 }} // Example: Ensure it's above other elements if needed
           >
              <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }} variant="filled">
                {snackbarMessage}
              </Alert>
           </Snackbar>
        )}

        {/* Optional Footer - Render unless on Auth page */}
        {/* {!isAuthPage && <Footer />} */}
      </>
    </ThemeProvider> // Close ThemeProvider
  );
}

export default App;