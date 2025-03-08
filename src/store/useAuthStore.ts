import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface UserMetadata {
  first_name?: string;
  last_name?: string;
}

interface AuthState {
  user: (User & { user_metadata: UserMetadata }) | null;
  setUser: (user: User | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      },
      signUp: async (email, password, firstName, lastName) => {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
            },
          },
        });
        if (error) throw error;

        // Send welcome email
        if (data.user) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            
            const response = await fetch('https://ssdsqxzaopizyvwrankv.functions.supabase.co/send-welcome-email', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`,
              },
              body: JSON.stringify({
                email,
                first_name: firstName
              })
            });

            if (!response.ok) {
              throw new Error('Failed to send welcome email');
            }
          } catch (error) {
            console.error('Error sending welcome email:', error);
          }
        }
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        // Clear all user-specific storage on sign out
        localStorage.removeItem(`pomodoro-storage-${useAuthStore.getState().user?.id}`);
        set({ user: null });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);