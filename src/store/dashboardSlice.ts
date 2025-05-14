// store/dashboardSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '../lib/supabase';

// --- Types and Initial State ---
export type WidgetType = 'quote'| 'applications' | 'companies' | 'followUps' | 'pomodoro' | 'aiCalendar'| 'tasks' | 'resume';

export interface Widget { // Ensure this is exported
  id: string;
  type: WidgetType;
  enabled: boolean;
  order: number;
  size: {
    cols: number;
    rows: number;
  };
}

interface DashboardState {
  widgets: Widget[];
  loading: boolean; // This 'loading' is specifically for fetch/save layout operations
  error: string | null;
  layoutStatus: 'idle' | 'loading' | 'succeeded' | 'failed'; // <-- NEW STATE for layout readiness
}

const defaultWidgets: Widget[] = [
  { id: 'quote', type: 'quote', enabled: true, order: 0, size: { cols: 1, rows: 1 } },
  { id: 'applications', type: 'applications', enabled: true, order: 1, size: { cols: 1, rows: 1 } },
  { id: 'companies', type: 'companies', enabled: true, order: 2, size: { cols: 1, rows: 1 } },
  { id: 'followUps', type: 'followUps', enabled: true, order: 3, size: { cols: 1, rows: 1 } },
  { id: 'aiCalendar', type: 'aiCalendar', enabled: true, order: 4, size: { cols: 2, rows: 2 } },
  { id: 'resume', type: 'resume', enabled: true, order: 5, size: { cols: 1, rows: 2 } },
  { id: 'pomodoro', type: 'pomodoro', enabled: false, order: 6, size: { cols: 1, rows: 1 } },
  { id: 'tasks', type: 'tasks', enabled: false, order: 9, size: { cols: 1, rows: 1 } },
];

const initialState: DashboardState = {
  widgets: [], // Start with empty or keep default, but layoutStatus will gate rendering
  loading: false,
  error: null,
  layoutStatus: 'idle', // <-- INITIALIZE NEW STATE
};

// --- Async Thunks ---
export const fetchDashboardLayout = createAsyncThunk<
  Widget[],
  string
>(
  'dashboard/fetchLayout',
  async (userId: string, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('dashboard_layouts')
        .select('widgets')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data?.widgets as Widget[] || defaultWidgets; // Return default if no saved layout
    } catch (err: any) {
        return rejectWithValue(err.message || 'Failed to fetch layout');
    }
  }
);

export const saveDashboardLayout = createAsyncThunk<
  Widget[],
  { userId: string; widgets: Widget[] }
>(
  'dashboard/saveLayout',
  async ({ userId, widgets }, { rejectWithValue }) => {
    try {
        const { error } = await supabase
        .from('dashboard_layouts')
        .upsert({
            user_id: userId,
            widgets,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id'
        });

        if (error) throw error;
        return widgets;
    } catch (err: any) {
        return rejectWithValue(err.message || 'Failed to save layout');
    }
  }
);

export const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    toggleWidget: (state, action: PayloadAction<WidgetType>) => {
      const widget = state.widgets.find(w => w.type === action.payload);
      if (widget) {
        widget.enabled = !widget.enabled;
        widget.size = widget.size || { cols: 1, rows: 1 };
      }
    },
    reorderWidgets: (state, action: PayloadAction<Widget[]>) => {
      state.widgets = action.payload.map((widget, index) => ({
        ...widget,
        order: index,
        size: widget.size || { cols: 1, rows: 1 }
      }));
    },
    resizeWidget: (state, action: PayloadAction<{ id: string; size: { cols: number; rows: number } }>) => {
      const widget = state.widgets.find(w => w.id === action.payload.id);
      if (widget) {
        widget.size = action.payload.size || { cols: 1, rows: 1 };
      }
    },
    initializeWidgets: (state) => { // This is used on logout
      state.widgets = defaultWidgets;
      state.loading = false;
      state.error = null;
      state.layoutStatus = 'succeeded'; // Considered initialized
    },
    resetStore: (state) => { // If this is a more general reset
      state.widgets = defaultWidgets; // Or [] if you prefer fetching default explicitely
      state.loading = false;
      state.error = null;
      state.layoutStatus = 'idle'; // Set to idle to trigger fetch on next load if needed
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardLayout.pending, (state) => {
        state.loading = true; // For save/fetch operations
        state.layoutStatus = 'loading'; // <-- SET LAYOUT STATUS
        state.error = null;
      })
      .addCase(fetchDashboardLayout.fulfilled, (state, action: PayloadAction<Widget[]>) => {
        state.widgets = action.payload;
        state.loading = false;
        state.layoutStatus = 'succeeded'; // <-- SET LAYOUT STATUS
        state.error = null;
      })
      .addCase(fetchDashboardLayout.rejected, (state, action) => {
        state.loading = false;
        state.layoutStatus = 'failed'; // <-- SET LAYOUT STATUS
        state.error = action.payload as string || action.error.message || 'Failed to fetch dashboard layout';
        state.widgets = defaultWidgets; // Fallback to default on error
      })
      .addCase(saveDashboardLayout.pending, (state) => {
        state.loading = true; // This loading is for the save operation
        state.error = null;
      })
      .addCase(saveDashboardLayout.fulfilled, (state, action: PayloadAction<Widget[]>) => {
        state.widgets = action.payload;
        state.loading = false;
        state.error = null;
        // Assuming layout is fine after a successful save
        if (state.layoutStatus !== 'succeeded') state.layoutStatus = 'succeeded';
      })
      .addCase(saveDashboardLayout.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || action.error.message || 'Failed to save dashboard layout';
        // Don't change layoutStatus on save error, keep existing UI
      });
  },
});

export const { toggleWidget, reorderWidgets, resizeWidget, initializeWidgets, resetStore } = dashboardSlice.actions;

export default dashboardSlice.reducer;