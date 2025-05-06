import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody, Input, Button, Tabs, Tab } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useDispatch, useSelector } from 'react-redux'; // Import useSelector
import { signIn, signUp, clearError } from '../store/authSlice';
import { AppDispatch, RootState } from '../store'; // Import RootState and AppDispatch
import { cn } from '../lib/utils'; // Import cn utility

const Auth = () => {
  const dispatch = useDispatch<AppDispatch>();
  // Get error state from Redux store
  const authError = useSelector((state: RootState) => state.auth.error); // Assuming error is stored here
  const isLoading = useSelector((state: RootState) => state.auth.loading); // Assuming loading state exists

  const [selected, setSelected] = useState<string>("login");
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  // Remove local error state, rely on Redux state 'authError'
  // const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Clear previous errors from Redux store
    dispatch(clearError());

    let resultAction;
    if (selected === "register") {
      resultAction = await dispatch(signUp({ email, password, firstName, lastName }));
      // Check if signup was successful using RTK action result matching
      if (signUp.fulfilled.match(resultAction)) {
          alert('Registration successful! Please check your email to verify your account.'); // Or show snackbar
          setSelected("login"); // Switch to login tab after successful signup
          // Clear form fields
          setEmail('');
          setPassword('');
          setFirstName('');
          setLastName('');
      }
    } else {
      resultAction = await dispatch(signIn({ email, password }));
       // Check if signin was successful
      if (signIn.fulfilled.match(resultAction)) {
          navigate('/'); // Navigate to dashboard on successful login
      }
    }
    // Error state is now handled by the authError selector from Redux store
  };

  // Function to handle tab changes, clearing errors
  const handleTabChange = (key: React.Key) => {
    setSelected(key as string);
    dispatch(clearError()); // Clear error when switching tabs
    // Optionally clear form fields too?
    // setEmail('');
    // setPassword('');
    // setFirstName('');
    // setLastName('');
  };

  return (
    <main className="min-h-screen w-full relative flex items-center justify-center p-4 overflow-y-auto">
      {/* Background Image and Overlay */}
      <div className="fixed inset-0 z-0">
        <img
          src="https://img.heroui.chat/image/landscape?w=1920&h=1080&u=1" // Consistent background
          className="w-full h-full object-cover"
          alt="Background"
        />
        {/* --- Corrected Overlay --- */}
        <div className="absolute inset-0 bg-black/30" /> {/* Slightly darker overlay for auth page? */}
      </div>

      {/* Content Area */}
      <div className="w-full max-w-md z-10">
        {/* Header Text (Styled for contrast) */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            {/* Logo - Consider using a white/light version if contrast is an issue */}
            <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-sm"> {/* Optional: slight bg for logo */}
              <img src="https://i.postimg.cc/vHhQk3qf/communitypage.png" alt="torcBoard Logo" className="h-10 w-auto" />
            </div>
          </div>
           {/* Apply text-white or similar high-contrast color */}
          <h1 className="text-3xl font-bold text-white mb-2">
            {selected === "login" ? "Welcome Back" : "Create Account"}
          </h1>
          <p className="text-gray-200 text-lg"> {/* Changed text color */}
            {selected === "login"
              ? "Sign in to continue to torcBoard CRM"
              : "Sign up to get started with torcBoard CRM"}
          </p>
        </div>

        {/* Auth Card (Styled) */}
        <Card
          className={cn(
              "w-full",
              "bg-card/80 backdrop-blur-sm border border-border/50", // Frosted glass style
              "text-card-foreground" // Ensure text inside uses card foreground color
          )}
          shadow="lg" // Keep HeroUI shadow prop
          radius="lg" // Keep HeroUI radius prop
        >
          <CardBody className="p-6 sm:p-8"> {/* Responsive padding */}
            <Tabs
              selectedKey={selected}
              onSelectionChange={handleTabChange} // Use updated handler
              // className="mb-8" // Removed bottom margin, added to parent space-y
              size="lg"
              color="primary"
              variant="underlined"
              fullWidth // Make tabs take full width
              classNames={{ // Optional: Adjust tab styling if needed
                  // tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider",
                  // cursor: "w-full bg-primary",
                  // tab: "max-w-fit px-0 h-12",
                  // tabContent: "group-data-[selected=true]:text-primary"
              }}
            >
              <Tab key="login" title="Login" />
              <Tab key="register" title="Register" />
            </Tabs>

            {/* Error display using Redux state */}
            {authError && (
              <div className={cn(
                  "my-4 p-3 rounded text-sm border",
                  "bg-red-100 text-red-900 border-red-200", // Light mode colors
                  "dark:bg-red-900/30 dark:text-red-200 dark:border-red-700/50" // Dark mode colors
                  )}
              >
                {authError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 pt-4"> {/* Added padding-top */}
              {selected === "register" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    placeholder="Enter first name"
                    value={firstName}
                    onValueChange={setFirstName}
                    variant="bordered"
                    radius="lg"
                    size="md" // Adjusted size
                    isRequired
                    startContent={ <Icon icon="lucide:user" className="text-default-400 pointer-events-none flex-shrink-0 text-xl" /> }
                  />
                  <Input
                    label="Last Name"
                    placeholder="Enter last name"
                    value={lastName}
                    onValueChange={setLastName}
                    variant="bordered"
                    radius="lg"
                    size="md" // Adjusted size
                    isRequired
                    startContent={ <Icon icon="lucide:user" className="text-default-400 pointer-events-none flex-shrink-0 text-xl" /> }
                  />
                </div>
              )}

              <Input
                label="Email"
                placeholder="Enter your email"
                type="email"
                value={email}
                onValueChange={setEmail}
                variant="bordered"
                radius="lg"
                size="md" // Adjusted size
                isRequired
                startContent={ <Icon icon="lucide:mail" className="text-default-400 pointer-events-none flex-shrink-0 text-xl" /> }
              />
              <Input
                label="Password"
                placeholder="Enter your password"
                type="password"
                value={password}
                onValueChange={setPassword}
                variant="bordered"
                radius="lg"
                size="md" // Adjusted size
                isRequired
                startContent={ <Icon icon="lucide:lock" className="text-default-400 pointer-events-none flex-shrink-0 text-xl" /> }
              />

              {selected === "login" && (
                <div className="flex items-center justify-end pt-1"> {/* Adjusted alignment */}
                  {/* TODO: Implement forgot password functionality */}
                  <Button variant="light" color="primary" size="sm" className="font-medium p-0 text-xs" isDisabled> {/* Disabled for now */}
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
                isLoading={isLoading} // Use loading state from Redux
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