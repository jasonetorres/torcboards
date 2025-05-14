import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '../lib/supabase'; // Adjust path if necessary
import { getRandomQuote as fetchQuoteUtil } from '../lib/utils'; // Adjust path to your getRandomQuote util
import type { Database } from '../lib/supabase-types'; // Adjust path
import type { RootState } from './index'; // Adjust path to your root store (e.g., './index' or './store')

// --- Type Definitions ---
// Ensure these types match or are imported from a central location if used elsewhere.
// They should align with what your Dashboard.tsx component expects.
type Company = Database['public']['Tables']['companies']['Row'];

type Application = Database['public']['Tables']['applications']['Row'] & {
    // Assuming 'companies' can be an expanded object or just an ID.
    // Based on your Supabase query in Dashboard.tsx: `companies ( name, website )`
    // it seems 'companies' can be an object when fetched with a join.
    companies?: Partial<Company> | null; // Or more specific if you know the exact shape from the join
};

type Quote = {
    text: string;
    author: string;
};

interface DashboardDataState {
    quote: Quote | null;
    applications: Application[];
    companies: Company[];
    upcomingFollowUps: Application[];
    loading: 'idle' | 'pending' | 'succeeded' | 'failed';
    error: string | null | undefined; // To store error messages from thunks
    lastFetchedPageData: number | null; // Timestamp of the last successful page data fetch
}

// --- Initial State ---
const initialState: DashboardDataState = {
    quote: null,
    applications: [],
    companies: [],
    upcomingFollowUps: [],
    loading: 'idle',
    error: null,
    lastFetchedPageData: null,
};


export const fetchDashboardQuote = createAsyncThunk<
    Quote, // Return type of the thunk's payload
    void,  // Argument type for the thunk (void if no argument)
    { state: RootState } // ThunkAPI config, allows access to getState
>(
    'dashboardData/fetchQuote',
    async (_, { getState }) => {
        const { quote: existingQuote } = getState().dashboardData;
        // If a quote already exists, return it to prevent re-fetching during the same app session.
        // You could add more sophisticated "freshness" logic if quotes should expire.
        if (existingQuote) {
            return existingQuote;
        }
        const newQuote = fetchQuoteUtil(); // Assuming this is a synchronous utility
        return newQuote;
    }
);

/**
 * Fetches the main page data for the dashboard:
 * recent applications, target companies, and upcoming follow-ups.
 */
export const fetchDashboardPageData = createAsyncThunk<
    { applications: Application[]; companies: Company[]; upcomingFollowUps: Application[] }, // Return type
    string, // Argument type: userId
    { state: RootState; rejectValue: string } // ThunkAPI config
>(
    'dashboardData/fetchPageData',
    async (userId: string, { getState, rejectWithValue }) => {
        const { applications: currentApplications, lastFetchedPageData, loading } = getState().dashboardData;

        // Prevent re-fetch if already loading
        if (loading === 'pending') {
            return rejectWithValue('Data fetching already in progress.');
        }

        // Optional: Simple "freshness" check to avoid rapid re-fetching
        const DURATION_TO_CONSIDER_FRESH = 5 * 60 * 1000; // 5 minutes
        if (
            currentApplications.length > 0 && // Check if some data already exists
            lastFetchedPageData &&
            (Date.now() - lastFetchedPageData < DURATION_TO_CONSIDER_FRESH)
        ) {
            // console.log("Dashboard page data is considered fresh, skipping Supabase refetch.");
            // Return the existing data to prevent unnecessary state updates if data hasn't changed
            return {
                applications: currentApplications,
                companies: getState().dashboardData.companies,
                upcomingFollowUps: getState().dashboardData.upcomingFollowUps,
            };
        }

        try {
            // Fetch recent applications
            const appsPromise = supabase
                .from('applications')
                .select(`*, companies ( name, website )`) // Ensure your 'Application' type matches this structure
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(5);

            // Fetch target companies
            const companiesPromise = supabase
                .from('companies')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'interested')
                .limit(5);

            // Fetch upcoming follow-ups
            const followUpsPromise = supabase
                .from('applications')
                .select(`*, companies ( name )`) // Ensure your 'Application' type matches this
                .eq('user_id', userId)
                .gte('next_follow_up', new Date().toISOString().split('T')[0]) // Filter for today onwards
                .order('next_follow_up', { ascending: true })
                .limit(5);

            const [
                { data: recentApps, error: appsError },
                { data: targetCompanies, error: compError },
                { data: followUps, error: followUpError }
            ] = await Promise.all([appsPromise, companiesPromise, followUpsPromise]);

            if (appsError) throw appsError;
            if (compError) throw compError;
            if (followUpError) throw followUpError;

            return {
                applications: (recentApps as Application[]) || [],
                companies: (targetCompanies as Company[]) || [],
                upcomingFollowUps: (followUps as Application[]) || [],
            };
        } catch (error: any) {
            console.error("Error fetching dashboard page data:", error);
            return rejectWithValue(error.message || 'Failed to fetch dashboard page data');
        }
    }
);

// --- Slice Definition ---
const dashboardDataSlice = createSlice({
    name: 'dashboardData',
    initialState,
    reducers: {
        /**
         * Action to clear all dashboard content data.
         * Useful for logout or resetting the dashboard state.
         */
        clearDashboardData: (state) => {
            state.quote = null;
            state.applications = [];
            state.companies = [];
            state.upcomingFollowUps = [];
            state.loading = 'idle';
            state.error = null;
            state.lastFetchedPageData = null;
        },
        // You can add other specific reducers here if needed, e.g., to manually update a single application
    },
    extraReducers: (builder) => {
        builder
            // Reducers for fetchDashboardQuote
            .addCase(fetchDashboardQuote.fulfilled, (state, action: PayloadAction<Quote>) => {
                state.quote = action.payload;
            })
            // No pending/rejected for quote as it's simple or uses existing

            // Reducers for fetchDashboardPageData
            .addCase(fetchDashboardPageData.pending, (state) => {
                state.loading = 'pending';
                state.error = null; // Clear previous errors
            })
            .addCase(fetchDashboardPageData.fulfilled, (
                state,
                action: PayloadAction<{ applications: Application[]; companies: Company[]; upcomingFollowUps: Application[] }>
            ) => {
                state.loading = 'succeeded';
                state.applications = action.payload.applications;
                state.companies = action.payload.companies;
                state.upcomingFollowUps = action.payload.upcomingFollowUps;
                state.lastFetchedPageData = Date.now(); // Update timestamp
            })
            .addCase(fetchDashboardPageData.rejected, (state, action) => {
                state.loading = 'failed';
                state.error = action.payload || action.error.message; // Store error message
            });
    },
});

// Export actions
export const { clearDashboardData } = dashboardDataSlice.actions;

// Export the reducer
export default dashboardDataSlice.reducer;