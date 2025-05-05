import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type WidgetType = 'quote' | 'calendar' | 'applications' | 'companies' | 'followUps' | 'pomodoro' | 'aiCalendar' | 'aiSchedule' | 'voiceNotes' | 'tasks' | 'resume';

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
}

const defaultWidgets: Widget[] = [
  { id: 'quote', type: 'quote', enabled: true, order: 0, size: { cols: 1, rows: 1 } },
  { id: 'applications', type: 'applications', enabled: true, order: 1, size: { cols: 2, rows: 1 } },
  { id: 'companies', type: 'companies', enabled: true, order: 2, size: { cols: 1, rows: 1 } },
  { id: 'followUps', type: 'followUps', enabled: true, order: 3, size: { cols: 1, rows: 1 } },
  { id: 'pomodoro', type: 'pomodoro', enabled: false, order: 4, size: { cols: 1, rows: 1 } },
  { id: 'aiCalendar', type: 'aiCalendar', enabled: true, order: 5, size: { cols: 2, rows: 1 } },
  { id: 'aiSchedule', type: 'aiSchedule', enabled: false, order: 6, size: { cols: 1, rows: 1 } },
  { id: 'voiceNotes', type: 'voiceNotes', enabled: false, order: 7, size: { cols: 1, rows: 1 } },
  { id: 'tasks', type: 'tasks', enabled: false, order: 8, size: { cols: 1, rows: 1 } },
  { id: 'resume', type: 'resume', enabled: true, order: 9, size: { cols: 1, rows: 1 } }
];

const initialState: DashboardState = {
  widgets: defaultWidgets,
};

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
      state.widgets = action.payload.map(w => ({ ...w, size: w.size || { cols: 1, rows: 1 } }));
    },
    resizeWidget: (state, action: PayloadAction<{ id: string; size: { cols: number; rows: number } }>) => {
      const widget = state.widgets.find(w => w.id === action.payload.id);
      if (widget) {
        widget.size = action.payload.size;
      }
    },
    initializeWidgets: (state) => {
      state.widgets = defaultWidgets;
    },
    resetStore: (state) => {
      state.widgets = defaultWidgets;
    },
  },
});

export const { toggleWidget, reorderWidgets, resizeWidget, initializeWidgets, resetStore } = dashboardSlice.actions;

export default dashboardSlice.reducer;