import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  toggleWidget: (type: WidgetType) => void;
  reorderWidgets: (widgets: Widget[]) => void;
  resizeWidget: (id: string, size: { cols: number; rows: number }) => void;
  initializeWidgets: () => void;
  resetStore: () => void;
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

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      widgets: defaultWidgets,
      toggleWidget: (type) =>
        set((state) => {
          const widget = state.widgets.find(w => w.type === type);
          if (!widget) return state;

          const updatedWidget = {
            ...widget,
            enabled: !widget.enabled,
            size: widget.size || { cols: 1, rows: 1 }
          };

          return {
            widgets: state.widgets.map((w) =>
              w.type === type ? updatedWidget : w
            ),
          };
        }),
      reorderWidgets: (widgets) => 
        set({ 
          widgets: widgets.map(w => ({
            ...w,
            size: w.size || { cols: 1, rows: 1 }
          }))
        }),
      resizeWidget: (id, size) =>
        set((state) => ({
          widgets: state.widgets.map((widget) =>
            widget.id === id ? { ...widget, size } : widget
          ),
        })),
      initializeWidgets: () => set({ widgets: defaultWidgets }),
      resetStore: () => {
        localStorage.removeItem('dashboard-storage');
        set({ widgets: defaultWidgets });
      },
    }),
    {
      name: 'dashboard-storage',
      onRehydrateStorage: () => (state) => {
        if (state && (!state.widgets || state.widgets.length === 0)) {
          state.widgets = defaultWidgets;
        }
        if (state && state.widgets) {
          state.widgets = state.widgets.map(widget => ({
            ...widget,
            size: widget.size || { cols: 1, rows: 1 }
          }));
        }
      },
    }
  )
);