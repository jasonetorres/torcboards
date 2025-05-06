import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  Sun, Moon, Target, Timer, LayoutDashboard, Wand2, CheckSquare, Menu, X, Settings, ChevronDown, FileText, LogOut, Briefcase // Added Briefcase back for nav links
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import type { RootState } from '../store';
import { toggleTheme } from '../store/themeSlice';
import { cn } from '../lib/utils';

const Navbar = () => {
  // --- State & Refs (unchanged) ---
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);


  // --- Hooks (unchanged) ---
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();

  // --- Global State (unchanged) ---
  const theme = useSelector((state: RootState) => state.theme.theme);
  const user = useSelector((state: RootState) => state.auth.user);

  // --- Handlers (unchanged) ---
  const handleSignOut = async () => {
    setIsUserMenuOpen(false);
    setIsMenuOpen(false);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
      }
      navigate('/auth');
    } catch (error) {
      console.error('Error during sign out process:', error);
    }
  };

  const handleToggleTheme = () => {
    dispatch(toggleTheme());
  };

  // Effect to close menus (unchanged)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isUserMenuOpen &&
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node) &&
        userMenuButtonRef.current &&
        !userMenuButtonRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
      if (
          isMenuOpen &&
          mobileMenuRef.current &&
          !mobileMenuRef.current.contains(event.target as Node) &&
          mobileMenuButtonRef.current &&
          !mobileMenuButtonRef.current.contains(event.target as Node)
      ) {
          setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen, isMenuOpen]);

  // --- Navigation Links (unchanged) ---
  const navLinks = [
    { to: "/", icon: <LayoutDashboard className="h-4 w-4" />, label: "Dashboard" },
    { to: "/applications", icon: <Briefcase className="h-4 w-4" />, label: "Applications" },
    { to: "/target-companies", icon: <Target className="h-4 w-4" />, label: "Target Companies" },
    { to: "/tasks", icon: <CheckSquare className="h-4 w-4" />, label: "Tasks" },
    { to: "/resume", icon: <FileText className="h-4 w-4" />, label: "Resume" },
    { to: "/pomodoro", icon: <Timer className="h-4 w-4" />, label: "Pomodoro" },
    { to: "/ai-tools", icon: <Wand2 className="h-4 w-4" />, label: "AI Tools" },
  ];

  // --- Active Link Check (unchanged) ---
  const isActive = (path: string) => location.pathname === path;

  // --- Render Logic ---
  return (
    <nav className={cn(
        "sticky top-0 z-50",
        "bg-background/80 backdrop-blur-lg",
        "border-b border-border/50"
    )}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* --- Logo/Brand with URL --- */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2 text-foreground hover:text-primary transition-colors">
              {/* Use the provided image URL */}
              <img
                src="https://i.postimg.cc/vHhQk3qf/communitypage.png" // <-- Updated URL
                alt="torcBoard CRM Logo" // Keep descriptive alt text
                className="h-8 w-auto object-contain" // Adjust size (h-8) as needed
              />
              <span className="font-bold text-xl hidden sm:inline">
                torcBoard CRM
              </span>
            </Link>
          </div>
          {/* --- End Logo/Brand --- */}


          {/* Desktop Navigation & Actions (unchanged) */}
          <div className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                    "flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive(link.to)
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            ))}
            <button
              onClick={handleToggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  ref={userMenuButtonRef}
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-foreground bg-muted/50 hover:bg-muted/80 transition-colors"
                  aria-haspopup="true"
                  aria-expanded={isUserMenuOpen}
                >
                  <span>{user.user_metadata?.first_name ?? user.email?.split('@')[0] ?? 'Account'}</span>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isUserMenuOpen ? 'rotate-180' : '')} />
                </button>
                {isUserMenuOpen && (
                  <div className={cn(
                      "absolute right-0 mt-2 w-48 origin-top-right",
                      "bg-card/90 backdrop-blur-md shadow-lg border border-border/50 rounded-md",
                      "py-1 ring-1 ring-black ring-opacity-5 focus:outline-none"
                  )}>
                    <Link
                      to="/account"
                      className="flex items-center w-full px-4 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <Settings className="h-4 w-4 mr-2 text-muted-foreground" />
                      Account Settings
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/auth"
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile Menu Button & Theme Toggle (unchanged) */}
          <div className="md:hidden flex items-center">
            <button
              onClick={handleToggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors mr-1"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              ref={mobileMenuButtonRef}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Open main menu"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu (unchanged) */}
        <div ref={mobileMenuRef} className={cn("md:hidden transition-all duration-300 ease-in-out overflow-hidden", isMenuOpen ? "max-h-screen pb-4" : "max-h-0")}>
             <div className={cn("flex flex-col space-y-1 pt-2")}>
              {user && (
                <div className="px-4 py-3 text-sm font-medium text-foreground border-b border-border/50 mb-1">
                  👋 Welcome, {user.user_metadata?.first_name ?? user.email?.split('@')[0] ?? 'User'}!
                </div>
              )}
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "flex items-center space-x-3 px-4 py-3 rounded-md text-base font-medium transition-colors",
                     isActive(link.to)
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              ))}
              {user && (
                 <>
                    <Link
                      to="/account"
                      onClick={() => setIsMenuOpen(false)}
                      className={cn(
                        "flex items-center space-x-3 px-4 py-3 rounded-md text-base font-medium transition-colors",
                         isActive('/account')
                            ? "text-primary bg-primary/10"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Settings className="h-4 w-4" />
                      <span>Account Settings</span>
                    </Link>
                    <div className="pt-2 px-4">
                        <button
                          onClick={handleSignOut}
                          className="flex items-center justify-center w-full px-4 py-2 rounded-md text-base font-medium text-red-600 dark:text-red-400 bg-destructive/10 hover:bg-destructive/20 transition-colors"
                        >
                           <LogOut className="h-4 w-4 mr-2" />
                          Sign Out
                        </button>
                    </div>
                 </>
              )}
              {!user && (
                  <div className="pt-2 px-4">
                      <Link
                        to="/auth"
                        onClick={() => setIsMenuOpen(false)}
                        className="bg-primary text-primary-foreground px-4 py-3 rounded-md text-base font-medium text-center block hover:bg-primary/90 transition-colors shadow-sm"
                      >
                        Sign In
                      </Link>
                 </div>
              )}
            </div>
          </div>
      </div>
    </nav>
  );
}

export default Navbar;