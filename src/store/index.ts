// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import dashboardReducer from './dashboardSlice';
import pomodoroReducer from './pomodoroSlice';
import themeReducer from './themeSlice'; 

export const store = configureStore({
  reducer: {
    auth: authReducer,
    dashboard: dashboardReducer,
    pomodoro: pomodoroReducer,
    theme: themeReducer, // Add theme reducer
    // Add other reducers here if needed
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;