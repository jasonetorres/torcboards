import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { Sun, Moon, Briefcase, Target, Timer, LayoutDashboard, Wand2, CheckSquare, Menu, X, Settings, ChevronDown, FileText } from 'lucide-react';

const Navbar = () => {
  const { theme, toggleTheme } = useThemeStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const navLinks = [
    { to: "/", icon: <LayoutDashboard className="h-4 w-4" />, label: "Dashboard" },
    { to: "/applications", icon: <Briefcase className="h-4 w-4" />, label: "Applications" },
    { to: "/target-companies", icon: <Target className="h-4 w-4" />, label: "Target Companies" },
    { to: "/tasks", icon: <CheckSquare className="h-4 w-4" />, label: "Tasks" },
    { to: "/resume", icon: <FileText className="h-4 w-4" />, label: "Resume" },
    { to: "/pomodoro", icon: <Timer className="h-4 w-4" />, label: "Pomodoro" },
    { to: "/ai-tools", icon: <Wand2 className="h-4 w-4" />, label: "AI Tools" },
  ];

  return (
    <nav className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-lg sticky top-0 z-50`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <Briefcase className="h-6 w-6 text-primary" />
              <span className={`font-bold text-xl ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                JobHunt CRM
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium ${
                  theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            ))}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg ${
                theme === 'dark'
                  ? 'text-gray-300 hover:text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20"
                >
                  <span>👋 {user.user_metadata.first_name}</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-card rounded-md shadow-lg py-1 border border-border">
                    <Link
                      to="/account"
                      className="flex items-center px-4 py-2 text-sm hover:bg-muted"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Account Settings
                    </Link>
                    <button
                      onClick={() => {
                        handleSignOut();
                        setIsUserMenuOpen(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-destructive hover:bg-muted"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/auth"
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg mr-2 ${
                theme === 'dark'
                  ? 'text-gray-300 hover:text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`p-2 rounded-lg ${
                theme === 'dark'
                  ? 'text-gray-300 hover:text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden pb-4">
            <div className="flex flex-col space-y-2">
              {user && (
                <div className="px-4 py-3 bg-primary/10 text-primary rounded-md mb-2">
                  👋 Welcome, {user.user_metadata.first_name}!
                </div>
              )}
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center space-x-2 px-4 py-3 rounded-md text-sm font-medium ${
                    theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'
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
                  className="flex items-center space-x-2 px-4 py-3 rounded-md text-sm font-medium text-primary"
                >
                  <Settings className="h-4 w-4" />
                  <span>Account Settings</span>
                </Link>
              )}
              {user ? (
                <button
                  onClick={() => {
                    handleSignOut();
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center justify-center w-full px-4 py-3 rounded-md text-sm font-medium text-destructive bg-destructive/10"
                >
                  Sign Out
                </button>
              ) : (
                <Link
                  to="/auth"
                  onClick={() => setIsMenuOpen(false)}
                  className="bg-primary text-primary-foreground px-4 py-3 rounded-md text-sm font-medium text-center"
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