import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody, Input, Button, Tabs, Tab } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useDispatch } from 'react-redux';
import { signIn, signUp, clearError } from '../store/authSlice';
import { AppDispatch } from '../store'; // Import your store's AppDispatch type

const Auth = () => {
  // Use the typed version of useDispatch
  const dispatch = useDispatch<AppDispatch>();
  const [selected, setSelected] = useState<string>("login");
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (selected === "register") {
        await dispatch(signUp({ email, password, firstName, lastName }));
        setSelected("login");
      } else {
        await dispatch(signIn({ email, password }));
        navigate('/');
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred');
    }
  };

  return (
    <main className="min-h-screen w-full relative flex items-center justify-center p-4">
      <div className="fixed inset-0 z-0">
        <img
          src="https://img.heroui.chat/image/landscape?w=1920&h=1080&u=1"
          className="w-full h-full object-cover"
          alt="Background"
        />
      </div>

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
          <div className="p-3 rounded-2xl">
              <img src="https://i.postimg.cc/pdC9XpGJ/horizontal-black.png" alt="JobTracker Logo" className="h-10 w-auto" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {selected === "login" ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-default-600 text-lg">
            {selected === "login"
              ? "Sign in to continue to JobTracker"
              : "Sign up to get started with JobTracker"}
          </p>
        </div>

        <Card className="w-full" shadow="lg">
          <CardBody className="p-8">
            <Tabs
              selectedKey={selected}
              onSelectionChange={(key) => {
                setSelected(key as string);
                dispatch(clearError());
              }}
              className="mb-8"
              size="lg"
              color="primary"
              variant="underlined"
            >
              <Tab key="login" title="Login" />
              <Tab key="register" title="Register" />
            </Tabs>

            {error && (
              <div className="mb-4 p-3 rounded bg-danger-50 text-danger text-sm border border-danger">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {selected === "register" && (
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    placeholder="Enter first name"
                    value={firstName}
                    onValueChange={setFirstName}
                    variant="bordered"
                    radius="lg"
                    size="lg"
                    isRequired
                    startContent={
                      <Icon icon="lucide:user" className="text-default-400 pointer-events-none flex-shrink-0 text-xl" />
                    }
                  />
                  <Input
                    label="Last Name"
                    placeholder="Enter last name"
                    value={lastName}
                    onValueChange={setLastName}
                    variant="bordered"
                    radius="lg"
                    size="lg"
                    isRequired
                    startContent={
                      <Icon icon="lucide:user" className="text-default-400 pointer-events-none flex-shrink-0 text-xl" />
                    }
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
                size="lg"
                isRequired
                startContent={
                  <Icon icon="lucide:mail" className="text-default-400 pointer-events-none flex-shrink-0 text-xl" />
                }
              />
              <Input
                label="Password"
                placeholder="Enter your password"
                type="password"
                value={password}
                onValueChange={setPassword}
                variant="bordered"
                radius="lg"
                size="lg"
                isRequired
                startContent={
                  <Icon icon="lucide:lock" className="text-default-400 pointer-events-none flex-shrink-0 text-xl" />
                }
              />

              {selected === "login" && (
                <div className="flex items-center justify-between pt-2">
                  <Button variant="light" color="primary" size="sm" className="font-medium p-0">
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
              >
                {selected === "login" ? "Sign In" : "Create Account"}
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </main>
  );
};

export default Auth;