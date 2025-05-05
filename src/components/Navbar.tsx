import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux'; // Import Redux hooks
import {
  Sun, Moon, Briefcase, Target, Timer, LayoutDashboard, Wand2, CheckSquare, Menu, X, Settings, ChevronDown, FileText
} from 'lucide-react';

import { supabase } from '../lib/supabase'; // Import Supabase client

// **** ASSUMPTIONS: Import your RootState type and theme actions ****
// Adjust paths as per your project structure
import type { RootState } from '../store'; // Example: import RootState type from your store setup
import { toggleTheme } from '../store/themeSlice'; // Example: import toggleTheme action from your theme slice
// setUser action from authSlice is implicitly handled by the listener in App.tsx on sign-out
// *********************************************************************

const Navbar = () => {
  // --- Local UI State ---
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // --- Hooks ---
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // --- Global State from Redux ---
  // Get theme state - Adjust 'state.theme.currentTheme' if your slice structure differs
// Correct:
const theme = useSelector((state: RootState) => state.theme.theme);
  // Get user state from auth slice
  const user = useSelector((state: RootState) => state.auth.user);

  // --- Handlers ---
  const handleSignOut = async () => {
    setIsUserMenuOpen(false); // Close menu if open
    setIsMenuOpen(false); // Close mobile menu if open
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        // Optionally show a snackbar error here
      }
      // No need to dispatch(setUser(null)) here - the listener in App.tsx handles it.
      navigate('/auth'); // Navigate after sign out attempt
    } catch (error) {
      console.error('Error during sign out process:', error);
    }
  };

  const handleToggleTheme = () => {
    // Dispatch the toggleTheme action from your theme slice
    dispatch(toggleTheme());
  };

  // Close user menu if clicking outside (Optional but good UX)
// Around line 55 in your Navbar.tsx:
useEffect(() => {
  const handleClickOutside = (_event: MouseEvent) => { 
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, [isUserMenuOpen]);


  // --- Navigation Links Definition ---
  const navLinks = [
    { to: "/", icon: <LayoutDashboard className="h-4 w-4" />, label: "Dashboard" },
    { to: "/applications", icon: <Briefcase className="h-4 w-4" />, label: "Applications" },
    { to: "/target-companies", icon: <Target className="h-4 w-4" />, label: "Target Companies" },
    { to: "/tasks", icon: <CheckSquare className="h-4 w-4" />, label: "Tasks" },
    { to: "/resume", icon: <FileText className="h-4 w-4" />, label: "Resume" },
    { to: "/pomodoro", icon: <Timer className="h-4 w-4" />, label: "Pomodoro" },
    { to: "/ai-tools", icon: <Wand2 className="h-4 w-4" />, label: "AI Tools" },
  ];

  // --- Render Logic ---
  return (
    // Added sticky, top-0, and z-50 for better navbar behavior
    <nav className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-lg sticky top-0 z-50`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <Briefcase className="h-6 w-6 text-primary" />
              <span className={`font-bold text-xl ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                torcBoard CRM
              </span>
            </Link>
          </div>

          {/* Desktop Navigation & Actions */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Nav Links */}
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium ${
                  theme === 'dark' ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`} // Added hover background for better feedback
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            ))}
            {/* Theme Toggle Button */}
            <button
              onClick={handleToggleTheme} // Use the dispatch handler
              aria-label="Toggle theme" // Added aria-label for accessibility
              className={`p-2 rounded-lg ${
                theme === 'dark'
                  ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            {/* User Menu / Sign In */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium ${
                    theme === 'dark' ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                   }`} // Adjusted theme styling
                >
                  {/* Use optional chaining and provide fallback for user metadata */}
                  <span>👋 {user.user_metadata?.first_name ?? 'User'}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {/* User Dropdown */}
                {isUserMenuOpen && (
                  // Added theme-aware styling for dropdown
                  <div className={`absolute right-0 mt-2 w-48 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-md shadow-lg py-1 border`}>
                    <Link
                      to="/account"
                      className={`flex items-center w-full px-4 py-2 text-sm ${theme === 'dark' ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Account Settings
                    </Link>
                    <button
                      onClick={handleSignOut} // Use the sign out handler
                      className={`flex items-center w-full px-4 py-2 text-sm ${theme === 'dark' ? 'text-red-400 hover:bg-gray-700' : 'text-red-600 hover:bg-gray-100'}`} // Adjusted theme styling for destructive action
                    >
                      {/* Consider adding a sign-out icon */}
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/auth"
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90" // Added hover effect
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile Menu Button & Theme Toggle */}
          <div className="md:hidden flex items-center">
            <button
              onClick={handleToggleTheme} // Use the dispatch handler
              aria-label="Toggle theme"
              className={`p-2 rounded-lg mr-2 ${
                theme === 'dark'
                  ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Open main menu"
              className={`p-2 rounded-lg ${
                theme === 'dark'
                  ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMenuOpen && (
          <div className="md:hidden pb-4">
            <div className="flex flex-col space-y-2">
              {user && (
                 // Added theme-aware styling
                <div className={`px-4 py-3 ${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'} rounded-md mb-2`}>
                  👋 Welcome, {user.user_metadata?.first_name ?? 'User'}!
                </div>
              )}
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsMenuOpen(false)} // Close menu on click
                  className={`flex items-center space-x-2 px-4 py-3 rounded-md text-base font-medium ${ // Increased text size slightly for mobile
                    theme === 'dark' ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              ))}
              {user && (
                <Link
                  to="/account"
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center space-x-2 px-4 py-3 rounded-md text-base font-medium ${
                    theme === 'dark' ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  <span>Account Settings</span>
                </Link>
              )}
              {user ? (
                <button
                  onClick={handleSignOut} // Use the sign out handler
                  className={`flex items-center justify-center w-full px-4 py-3 rounded-md text-base font-medium ${
                     theme === 'dark' ? 'text-red-400 bg-gray-700 hover:bg-gray-600' : 'text-red-600 bg-red-50 hover:bg-red-100' // Adjusted theme styling
                   }`}
                >
                  Sign Out
                </button>
              ) : (
                <Link
                  to="/auth"
                  onClick={() => setIsMenuOpen(false)}
                  className="bg-primary text-primary-foreground px-4 py-3 rounded-md text-base font-medium text-center block hover:bg-primary/90" // Added block display
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;