// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import dashboardReducer from './dashboardSlice';
import pomodoroReducer from './pomodoroSlice';
import themeReducer from './themeSlice';
// ***** 1. Import your new dashboardDataReducer *****
import dashboardDataReducer from './dashboardDataSlice'; // Make sure this path is correct

export const store = configureStore({
  reducer: {
    auth: authReducer,
    dashboard: dashboardReducer, // This is for widget layout/visibility
    pomodoro: pomodoroReducer,
    theme: themeReducer,
    // ***** 2. Add the new reducer to the store with a key (e.g., 'dashboardData') *****
    dashboardData: dashboardDataReducer, // This is for the content of dashboard widgets
    // Add other reducers here if needed
  },
});

// The RootState type will now automatically include `dashboardData`
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;