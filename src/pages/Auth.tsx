import React, { useState, useEffect } from 'react'; // Ensure useEffect is imported
import { useNavigate } from 'react-router-dom';
import { Card, CardBody, Input, Button, Tabs, Tab } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useDispatch, useSelector } from 'react-redux';
import { signIn, signUp, clearError } from '../store/authSlice';
import { AppDispatch, RootState } from '../store';
import { cn } from '../lib/utils';

const Auth = () => {
  const dispatch = useDispatch<AppDispatch>();
  // Get user, error, loading, and requiresConfirmation states from Redux
  const { user, error: authError, loading: isLoading } = useSelector((state: RootState) => state.auth);

  const [selected, setSelected] = useState<string>("login");
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  // Local error state for form-specific validation (e.g., "First name required")
  const [formError, setFormError] = useState('');

  const navigate = useNavigate();

  // --- Add useEffect to redirect if user is already logged in ---
  useEffect(() => {
    if (user && user.id) { // Check if user object is populated
      console.log("[Auth.tsx] User is already logged in, redirecting to dashboard.");
      navigate('/', { replace: true });
    }
  }, [user, navigate]);
  // -------------------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(clearError()); // Clear any previous API auth errors from Redux
    setFormError('');     // Clear local form validation errors

    if (selected === "register") {
      // Basic client-side validation for registration
      if (!firstName.trim() || !lastName.trim()) {
        setFormError("First and last name are required for registration.");
        return;
      }
      if (!email.trim()) {
        setFormError("Email is required.");
        return;
      }
      if (!password) {
        setFormError("Password is required.");
        return;
      }
      // Add more validation as needed (e.g., password strength)

      const resultAction = await dispatch(signUp({ email, password, firstName, lastName }));

      if (signUp.fulfilled.match(resultAction)) {
        // Destructure payload from the fulfilled action
        const { user: signedUpUser, session, requiresConfirmation: confirmationNeeded } = resultAction.payload;

        if (session && signedUpUser) {
          // Session created immediately (email confirmation likely off or user auto-confirmed)
          console.log("[Auth.tsx] Signup successful with session, navigating to dashboard.");
          navigate('/');
        } else if (confirmationNeeded || (signedUpUser && !session)) {
          // User created, but email confirmation is pending
          // Show a more user-friendly message (alert is okay for now, but consider a snackbar/toast)
          alert('Registration successful! Please check your email to verify your account before logging in.');
          setSelected("login"); // Switch to login tab
          // Clear form fields after successful submission for confirmation
          setEmail('');
          setPassword('');
          setFirstName('');
          setLastName('');
        } else {
          // This case is less likely if the thunk handles states well, but as a fallback
          setFormError("Signup complete, but an issue occurred. Please try logging in or check your email.");
          setSelected("login");
        }
      }
      // If signUp.rejected, authError from Redux store will be set by extraReducers
      // and displayed by the {authError && ...} block.
    } else { // Login logic
      if (!email.trim()) {
        setFormError("Email is required.");
        return;
      }
      if (!password) {
        setFormError("Password is required.");
        return;
      }
      const resultAction = await dispatch(signIn({ email, password }));
      if (signIn.fulfilled.match(resultAction) && resultAction.payload.user) {
        console.log("[Auth.tsx] Signin successful, navigating to dashboard.");
        navigate('/');
      }
      // If signIn.rejected, authError from Redux store will be set.
    }
  };

  const handleTabChange = (key: React.Key) => {
    setSelected(key as string);
    dispatch(clearError()); // Clear API errors
    setFormError('');     // Clear local form errors
    // Reset form fields when switching tabs for better UX
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
  };

  return (
    <main className="min-h-screen w-full relative flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 z-0">
        <img
          src="https://img.heroui.chat/image/landscape?w=1920&h=1080&u=1"
          className="w-full h-full object-cover"
          alt="Background"
        />
        <div className="absolute inset-0 bg-black/30" />
      </div>

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-sm">
              <img src="https://i.postimg.cc/vHhQk3qf/communitypage.png" alt="torcBoard Logo" className="h-10 w-auto" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {selected === "login" ? "Welcome Back" : "Create Account"}
          </h1>
          <p className="text-gray-200 text-lg">
            {selected === "login"
              ? "Sign in to continue to torcBoard CRM"
              : "Sign up to get started with torcBoard CRM"}
          </p>
        </div>

        <Card
          className={cn(
              "w-full",
              "bg-card/80 backdrop-blur-sm border border-border/50",
              "text-card-foreground"
          )}
          shadow="lg"
          radius="lg"
        >
          <CardBody className="p-6 sm:p-8">
            <Tabs
              selectedKey={selected}
              onSelectionChange={handleTabChange}
              size="lg"
              color="primary"
              variant="underlined"
              fullWidth
              className="mb-6"
            >
              <Tab key="login" title="Login" />
              <Tab key="register" title="Register" />
            </Tabs>

            {/* Display API errors from Redux store */}
            {authError && (
              <div className={cn( "mb-4 p-3 rounded text-sm border", "bg-red-100 text-red-900 border-red-200", "dark:bg-red-900/30 dark:text-red-200 dark:border-red-700/50" )} >
                {authError}
              </div>
            )}
            {/* Display local form validation errors */}
            {formError && (
              <div className={cn( "mb-4 p-3 rounded text-sm border", "bg-yellow-100 text-yellow-900 border-yellow-300", "dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-700/50" )} >
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {selected === "register" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    placeholder="Enter first name"
                    value={firstName}
                    onValueChange={setFirstName} // Correct prop for HeroUI Input
                    variant="bordered" radius="lg" size="md" isRequired
                    startContent={ <Icon icon="lucide:user" className="text-default-400 pointer-events-none flex-shrink-0 text-xl" /> }
                  />
                  <Input
                    label="Last Name"
                    placeholder="Enter last name"
                    value={lastName}
                    onValueChange={setLastName} // Correct prop
                    variant="bordered" radius="lg" size="md" isRequired
                    startContent={ <Icon icon="lucide:user" className="text-default-400 pointer-events-none flex-shrink-0 text-xl" /> }
                  />
                </div>
              )}

              <Input
                label="Email"
                placeholder="Enter your email"
                type="email"
                value={email}
                onValueChange={setEmail} // Correct prop
                variant="bordered" radius="lg" size="md" isRequired
                startContent={ <Icon icon="lucide:mail" className="text-default-400 pointer-events-none flex-shrink-0 text-xl" /> }
              />
              <Input
                label="Password"
                placeholder="Enter your password"
                type="password"
                value={password}
                onValueChange={setPassword} // Correct prop
                variant="bordered" radius="lg" size="md" isRequired
                startContent={ <Icon icon="lucide:lock" className="text-default-400 pointer-events-none flex-shrink-0 text-xl" /> }
              />

              {selected === "login" && (
                <div className="flex items-center justify-end pt-1">
                  <Button variant="light" color="primary" size="sm" className="font-medium p-0 text-xs" isDisabled>
                    Forgot password?
                  </Button>
                </div>
              )}

              <Button
                type="submit"
                color="primary"
                className="w-full"
                size="lg"
                radius="lg"
                isLoading={isLoading} // Use isLoading from Redux
              >
                {isLoading ? 'Processing...' : (selected === "login" ? "Sign In" : "Create Account")}
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </main>
  );
};

export default Auth;
