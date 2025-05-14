// src/pages/Auth.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardBody, Input, Button, Tabs, Tab } from "@heroui/react"; // Assuming @heroui/react is your UI library
import { Icon } from "@iconify/react";
import { useDispatch, useSelector } from 'react-redux';
import { signIn, signUp, clearError } from '../store/authSlice'; // Adjust path as necessary
import { AppDispatch, RootState } from '../store'; // Adjust path as necessary
import { cn } from '../lib/utils'; // Adjust path as necessary

const Auth = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user, error: authError, loading: isLoading } = useSelector((state: RootState) => state.auth);

  const [selected, setSelected] = useState<string>("login");
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [formError, setFormError] = useState('');
  const [isPageLoaded, setIsPageLoaded] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPageLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (user && user.id) {
      if (location.pathname === '/auth') {
        navigate('/', { replace: true });
      }
    }
  }, [user, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(clearError());
    setFormError('');

    if (selected === "register") {
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

      const resultAction = await dispatch(signUp({ email, password, firstName, lastName }));

      if (signUp.fulfilled.match(resultAction)) {
        const { user: signedUpUser, session, requiresConfirmation: confirmationNeeded } = resultAction.payload;

        if (session && signedUpUser) {
          navigate('/');
        } else if (confirmationNeeded || (signedUpUser && !session)) {
          alert('Registration successful! Please check your email to verify your account before logging in.');
          setSelected("login");
          setEmail('');
          setPassword('');
          setFirstName('');
          setLastName('');
        } else {
          setFormError("Signup complete, but an issue occurred. Please try logging in or check your email.");
          setSelected("login");
        }
      }
      // No explicit else here; authError from Redux will be displayed if signUp.rejected
    } else { // Login
      if (!email.trim()) {
        setFormError("Email is required.");
        return;
      }
      if (!password) {
        setFormError("Password is required.");
        return;
      }
      // Dispatch signIn. If it's successful, the useEffect for user will handle navigation.
      // If it fails, authError from Redux state will be displayed.
      await dispatch(signIn({ email, password }));
    }
  };

  const handleTabChange = (key: React.Key) => {
    setSelected(key as string);
    dispatch(clearError()); // Clear Redux auth error
    setFormError('');      // Clear local form error
    // Optionally reset form fields
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

      <div
        className={cn(
          "w-full max-w-md z-10 transition-opacity duration-1000 ease-out",
          isPageLoaded ? "opacity-100" : "opacity-0"
        )}
      >
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

            {authError && (
              <div className={cn( "mb-4 p-3 rounded text-sm border", "bg-red-100 text-red-900 border-red-200", "dark:bg-red-900/30 dark:text-red-200 dark:border-red-700/50" )} >
                {authError}
              </div>
            )}
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
                    onValueChange={setFirstName} // Assuming HeroUI Input uses onValueChange
                    variant="bordered" radius="lg" size="md" isRequired
                    startContent={ <Icon icon="lucide:user" className="text-default-400 pointer-events-none flex-shrink-0 text-xl" /> }
                  />
                  <Input
                    label="Last Name"
                    placeholder="Enter last name"
                    value={lastName}
                    onValueChange={setLastName} // Assuming HeroUI Input uses onValueChange
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
                onValueChange={setEmail} // Assuming HeroUI Input uses onValueChange
                variant="bordered" radius="lg" size="md" isRequired
                startContent={ <Icon icon="lucide:mail" className="text-default-400 pointer-events-none flex-shrink-0 text-xl" /> }
              />
              <Input
                label="Password"
                placeholder="Enter your password"
                type="password"
                value={password}
                onValueChange={setPassword} // Assuming HeroUI Input uses onValueChange
                variant="bordered" radius="lg" size="md" isRequired
                startContent={ <Icon icon="lucide:lock" className="text-default-400 pointer-events-none flex-shrink-0 text-xl" /> }
              />

              {selected === "login" && (
                <div className="flex items-center justify-end pt-1">
                  {/* "Forgot password?" button can be enabled when functionality is ready */}
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
                isLoading={isLoading}
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