// src/store/authSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// Interface for user metadata passed during signup and potentially stored
interface UserMetadata {
  first_name?: string;
  last_name?: string;
  // Add any other metadata fields you expect
}

// Interface for the user object in your state, extending Supabase's User
// and including the user_metadata structure you expect.
interface AppUser extends User {
  user_metadata: UserMetadata; // Ensure this matches what Supabase User type might have or how you structure it
}

interface AuthState {
  user: AppUser | null; // Use the extended AppUser type
  session: Session | null;
  loading: boolean;
  error: string | null;
  requiresConfirmation?: boolean;
}

const initialState: AuthState = {
  user: null,
  session: null,
  loading: false,
  error: null,
  requiresConfirmation: false,
};

// --- Async Thunks ---

export const signIn = createAsyncThunk(
  'auth/signIn',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return rejectWithValue(error.message);
      }
      // Ensure the user object from Supabase is cast to AppUser if it matches the structure
      // or handle potential discrepancies if user_metadata isn't directly on data.user
      const appUser = data.user ? { ...data.user, user_metadata: data.user.user_metadata || {} } as AppUser : null;
      return { user: appUser, session: data.session };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const signUp = createAsyncThunk(
  'auth/signUp',
  async (
    { email, password, firstName, lastName }: { email: string; password: string; firstName: string; lastName: string },
    // Removed unused 'dispatch' from parameters
    { rejectWithValue }
  ) => {
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      if (signUpError) {
        console.error('Supabase signUp error:', signUpError);
        return rejectWithValue(signUpError.message);
      }

      // Check if user object exists in signUpData
      const appUser = signUpData.user ? { ...signUpData.user, user_metadata: signUpData.user.user_metadata || {} } as AppUser : null;

      if (appUser) {
        console.log('Supabase signUp successful, user ID:', appUser.id, 'Session:', signUpData.session);
        const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-welcome-email`;
        const { data: currentSessionData } = await supabase.auth.getSession();

        console.log(`[authSlice] Calling send-welcome-email for user: ${appUser.id}, firstName: ${firstName}`);
        const response = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(currentSessionData?.session?.access_token && {
              'Authorization': `Bearer ${currentSessionData.session.access_token}`,
            }),
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            userId: appUser.id,
            firstName: firstName
          }),
        });

        if (!response.ok) {
          const errorBody = await response.json();
          console.error('Error sending welcome email (response not ok):', response.status, errorBody);
        } else {
          const successData = await response.json();
          console.log('Welcome email function call successful:', successData);
        }

        if (!signUpData.session) { // User exists, but no session (email confirmation needed)
            console.log("User signed up but requires email confirmation.");
            return { user: appUser, session: null, requiresConfirmation: true };
        }
        return { user: appUser, session: signUpData.session };

      } else {
        // This case implies signUpData.user was null, which is unusual if no error was thrown by supabase.auth.signUp
        // Supabase typically returns a user object even if email confirmation is pending.
        // If email confirmation is required, signUpData.session will be null.
        if (signUpData.session === null) { // This is the more reliable check for confirmation pending
             console.log('User requires email confirmation. No active session returned.');
             // If signUpData.user is unexpectedly null here, we pass null for the user.
             return { user: null, session: null, requiresConfirmation: true };
        }
        console.error('Supabase signUp returned no user and no error, but also no session indicating confirmation.');
        return rejectWithValue('Sign up failed: Unexpected response from authentication server.');
      }

    } catch (error: any) {
      console.error('Unexpected error in signUp thunk:', error);
      return rejectWithValue(error.message || 'An unexpected error occurred during sign up.');
    }
  }
);

export const signOut = createAsyncThunk(
  'auth/signOut',
  async (_, { rejectWithValue }) => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        return rejectWithValue(error.message);
      }
      return { user: null, session: null };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Made reducer more robust to handle a potentially null payload,
    // although the primary fix is to ensure App.tsx always dispatches an object.
    setUser: (state, action: PayloadAction<{ user: AppUser | null, session: Session | null } | null>) => {
      if (action.payload) {
        // Ensure user_metadata is at least an empty object if user exists but metadata is missing
        const user = action.payload.user;
        state.user = user ? { ...user, user_metadata: user.user_metadata || {} } as AppUser : null;
        state.session = action.payload.session;
      } else {
        state.user = null;
        state.session = null;
      }
      state.loading = false;
      state.error = null;
      state.requiresConfirmation = false;
    },
    clearError: (state) => {
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
        state.loading = action.payload;
    }
  },
  extraReducers: (builder) => {
    // Handling signIn
    builder
      .addCase(signIn.pending, (state) => {
        state.loading = true; state.error = null; state.requiresConfirmation = false;
      })
      .addCase(signIn.fulfilled, (state, action: PayloadAction<{ user: AppUser | null, session: Session | null }>) => {
        state.loading = false;
        state.user = action.payload.user;
        state.session = action.payload.session;
        state.requiresConfirmation = false;
      })
      .addCase(signIn.rejected, (state, action) => {
        state.loading = false; state.error = action.payload as string || 'Sign in failed.';
      });

    // Handling signUp
    builder
      .addCase(signUp.pending, (state) => {
        state.loading = true; state.error = null; state.requiresConfirmation = false;
      })
      .addCase(signUp.fulfilled, (state, action: PayloadAction<{ user: AppUser | null, session: Session | null, requiresConfirmation?: boolean }>) => {
        state.loading = false;
        // User object might be present even if confirmation needed, session will be null
        state.user = action.payload.user;
        state.session = action.payload.session;
        state.requiresConfirmation = action.payload.requiresConfirmation || false;
        if (action.payload.requiresConfirmation) {
            console.log("Sign up fulfillment: User requires email confirmation.");
        }
      })
      .addCase(signUp.rejected, (state, action) => {
        state.loading = false; state.error = action.payload as string || 'Sign up failed.';
      });

    // Handling signOut
    builder
      .addCase(signOut.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(signOut.fulfilled, (state, action: PayloadAction<{ user: AppUser | null, session: Session | null }>) => { // Ensure payload type matches
        state.loading = false;
        state.user = action.payload.user; // Should be null
        state.session = action.payload.session; // Should be null
        state.requiresConfirmation = false;
      })
      .addCase(signOut.rejected, (state, action) => {
        state.loading = false; state.error = action.payload as string || 'Sign out failed.';
      });
  },
});

export const { setUser, clearError, setLoading } = authSlice.actions;

export default authSlice.reducer;
