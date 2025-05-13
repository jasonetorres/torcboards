import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '../lib/supabase';

// --- Types and Initial State ---
export type WidgetType = 'quote'| 'applications' | 'companies' | 'followUps' | 'pomodoro' | 'aiCalendar'| 'tasks' | 'resume';

interface Widget {
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
  loading: boolean;
  error: string | null;
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
  widgets: defaultWidgets,
  loading: false,
  error: null
};

// --- Async Thunks ---
export const fetchDashboardLayout = createAsyncThunk(
  'dashboard/fetchLayout',
  async (userId: string) => {
    const { data, error } = await supabase
      .from('dashboard_layouts')
      .select('widgets')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data?.widgets as Widget[] || defaultWidgets;
  }
);

export const saveDashboardLayout = createAsyncThunk(
  'dashboard/saveLayout',
  async ({ userId, widgets }: { userId: string; widgets: Widget[] }) => {
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
    initializeWidgets: (state) => {
      state.widgets = defaultWidgets;
      state.loading = false;
      state.error = null;
    },
    resetStore: (state) => {
      state.widgets = defaultWidgets;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardLayout.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboardLayout.fulfilled, (state, action) => {
        state.widgets = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchDashboardLayout.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch dashboard layout';
      })
      .addCase(saveDashboardLayout.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(saveDashboardLayout.fulfilled, (state, action) => {
        state.widgets = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(saveDashboardLayout.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to save dashboard layout';
      });
  },
});

export const { toggleWidget, reorderWidgets, resizeWidget, initializeWidgets, resetStore } = dashboardSlice.actions;

export default dashboardSlice.reducer;