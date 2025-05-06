import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// --- Types and Initial State (Unchanged) ---
export type WidgetType = 'quote'| 'applications' | 'companies' | 'followUps' | 'pomodoro' | 'aiCalendar'| 'tasks' | 'resume'; //'voiceNotes' add this back

interface Widget {
  id: string;
  type: WidgetType;
  enabled: boolean;
  order: number; // This needs to be updated on reorder
  size: {
    cols: number;
    rows: number;
  };
}

interface DashboardState {
  widgets: Widget[];
}

// Ensure defaultWidgets have sequential order values starting from 0
const defaultWidgets: Widget[] = [
  { id: 'quote', type: 'quote', enabled: true, order: 0, size: { cols: 1, rows: 1 } },
  { id: 'applications', type: 'applications', enabled: true, order: 1, size: { cols: 1, rows: 1 } }, // Adjusted default size example
  { id: 'companies', type: 'companies', enabled: true, order: 2, size: { cols: 1, rows: 1 } },
  { id: 'followUps', type: 'followUps', enabled: true, order: 3, size: { cols: 1, rows: 1 } },
  { id: 'aiCalendar', type: 'aiCalendar', enabled: true, order: 4, size: { cols: 2, rows: 2 } }, // Adjusted default size example
  { id: 'resume', type: 'resume', enabled: true, order: 5, size: { cols: 1, rows: 2 } }, // Adjusted default size example
  { id: 'pomodoro', type: 'pomodoro', enabled: false, order: 6, size: { cols: 1, rows: 1 } },
  //{ id: 'voiceNotes', type: 'voiceNotes', enabled: false, order: 8, size: { cols: 6, rows: 6 } },
  { id: 'tasks', type: 'tasks', enabled: false, order: 9, size: { cols: 1, rows: 1 } }, // Assuming tasks might exist
];

// Function to ensure initial state is sorted by order, just in case
const getInitialState = (): DashboardState => {
    const sortedWidgets = [...defaultWidgets].sort((a, b) => a.order - b.order);
    // Re-assign order based on sorted index to ensure it's sequential and gapless
    const normalizedWidgets = sortedWidgets.map((widget, index) => ({
        ...widget,
        order: index,
        size: widget.size || { cols: 1, rows: 1 } // Ensure size exists
    }));
    return { widgets: normalizedWidgets };
}

const initialState: DashboardState = getInitialState();

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
    // --- CORRECTED reorderWidgets Reducer ---
    reorderWidgets: (state, action: PayloadAction<Widget[]>) => {
      // The payload IS the new array in the desired visual order.
      // We need to update the main widgets array AND the 'order' property
      // on each widget object to match its new index.
      state.widgets = action.payload.map((widget, index) => ({
        ...widget,
        order: index, // Assign the new order based on the array index
        size: widget.size || { cols: 1, rows: 1 } // Ensure size exists
      }));
    },
    // ------------------------------------------
    resizeWidget: (state, action: PayloadAction<{ id: string; size: { cols: number; rows: number } }>) => {
      const widget = state.widgets.find(w => w.id === action.payload.id);
      if (widget) {
        // Ensure size is always an object
        widget.size = action.payload.size || { cols: 1, rows: 1 };
      }
    },
    // Initialize/Reset might benefit from the sorting/normalization too
    initializeWidgets: (state) => {
      state.widgets = getInitialState().widgets;
    },
    resetStore: (state) => {
       state.widgets = getInitialState().widgets;
    },
  },
});

// Exports remain the same
export const { toggleWidget, reorderWidgets, resizeWidget, initializeWidgets, resetStore } = dashboardSlice.actions;

export default dashboardSlice.reducer;