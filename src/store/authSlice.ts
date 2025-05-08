// src/store/authSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// Interface for user metadata passed during signup and potentially stored
// This can remain un-exported if only used internally by AppUser within this file.
// If other parts of your app need UserMetadata directly, you should export it too.
interface UserMetadata {
  first_name?: string;
  last_name?: string;
  // Add any other metadata fields you expect
  // These were in your previous log, ensure they are covered if needed:
  email?: string; // if you store email in user_metadata as well
  email_verified?: boolean;
  phone_verified?: boolean;
  sub?: string;
}

// Interface for the user object in your state, extending Supabase's User
// and including the user_metadata structure you expect.
// ***** ADDED 'export' KEYWORD HERE *****
export interface AppUser extends User {
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
      // Ensure the user object from Supabase is cast to AppUser.
      // Supabase's data.user.user_metadata should align with your UserMetadata interface.
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
    { rejectWithValue }
  ) => {
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { // This data goes into user_metadata by default with Supabase
            first_name: firstName,
            last_name: lastName,
            // If you need to explicitly set email/email_verified in user_metadata here, add them.
            // However, Supabase manages the primary email field on the User object itself.
          },
        },
      });

      if (signUpError) {
        console.error('Supabase signUp error:', signUpError);
        return rejectWithValue(signUpError.message);
      }

      const appUser = signUpData.user ? { ...signUpData.user, user_metadata: signUpData.user.user_metadata || {} } as AppUser : null;

      if (appUser) {
        console.log('Supabase signUp successful, user ID:', appUser.id, 'Session:', signUpData.session);
        // Consider moving Edge function call to backend trigger if possible, or ensure robust error handling
        const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-welcome-email`;
        const { data: currentSessionData } = await supabase.auth.getSession();

        // Welcome email logic (ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env)
        if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
            console.log(`[authSlice] Calling send-welcome-email for user: ${appUser.id}, firstName: ${firstName}`);
            try {
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
                const errorBody = await response.text(); // Use .text() first to avoid JSON parse error if not JSON
                console.error('Error sending welcome email (response not ok):', response.status, errorBody);
                } else {
                const successData = await response.json();
                console.log('Welcome email function call successful:', successData);
                }
            } catch (fetchError: any) {
                console.error('Fetch error calling welcome email function:', fetchError.message);
            }
        } else {
            console.warn('[authSlice] Welcome email function skipped: Supabase URL or Anon Key not configured in .env');
        }


        if (!signUpData.session) {
            console.log("User signed up but requires email confirmation.");
            return { user: appUser, session: null, requiresConfirmation: true };
        }
        return { user: appUser, session: signUpData.session, requiresConfirmation: false }; // Added requiresConfirmation here

      } else {
        if (signUpData.session === null) {
             console.log('User requires email confirmation. No active session returned and no user object.');
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
      return { user: null, session: null }; // No need to cast to AppUser here since it's null
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<{ user: AppUser | null, session: Session | null } | null>) => {
      if (action.payload && action.payload.user) {
        // Ensure user_metadata is at least an empty object if user exists but metadata is missing
        state.user = { ...action.payload.user, user_metadata: action.payload.user.user_metadata || {} } as AppUser;
        state.session = action.payload.session;
      } else if (action.payload === null) { // Explicitly checking for null payload to clear user
        state.user = null;
        state.session = null;
      }
      // If action.payload exists but action.payload.user is null (e.g. from a specific dispatch),
      // user would be null, session might still be set from payload.session.
      // The above logic prioritizes action.payload.user.
      // If action.payload is an object like { user: null, session: null }, it's handled.

      state.loading = false; // setUser usually implies auth process ended
      state.error = null;
      state.requiresConfirmation = false; // Reset confirmation flag
    },
    clearError: (state) => {
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
        state.loading = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(signIn.pending, (state) => {
        state.loading = true; state.error = null; state.requiresConfirmation = false;
      })
      .addCase(signIn.fulfilled, (state, action: PayloadAction<{ user: AppUser | null, session: Session | null }>) => {
        state.loading = false;
        state.user = action.payload.user;
        // ***** ENSURED THIS DEBUG LOG IS PRESENT *****
        console.log('[authSlice] signIn.fulfilled: User state in Redux has been set to:', JSON.stringify(state.user, null, 2));
        state.session = action.payload.session;
        state.requiresConfirmation = false;
      })
      .addCase(signIn.rejected, (state, action) => {
        state.loading = false; state.error = action.payload as string || 'Sign in failed.';
      });

    builder
      .addCase(signUp.pending, (state) => {
        state.loading = true; state.error = null; state.requiresConfirmation = false;
      })
      .addCase(signUp.fulfilled, (state, action: PayloadAction<{ user: AppUser | null, session: Session | null, requiresConfirmation?: boolean }>) => {
        state.loading = false;
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

    builder
      .addCase(signOut.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(signOut.fulfilled, (state) => { // action payload is { user: null, session: null } but not strictly needed here
        state.loading = false;
        state.user = null;
        state.session = null;
        state.requiresConfirmation = false;
      })
      .addCase(signOut.rejected, (state, action) => {
        state.loading = false; state.error = action.payload as string || 'Sign out failed.';
      });
  },
});

export const { setUser, clearError, setLoading } = authSlice.actions;

export default authSlice.reducer;