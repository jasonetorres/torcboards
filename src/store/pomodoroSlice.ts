// src/store/pomodoroSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface PomodoroState {
  timeLeft: number;
  workDuration: number;
  breakDuration: number;
  isRunning: boolean;
  isBreak: boolean;
  task: string;
  startTime: string | null;
}

const DEFAULT_WORK_TIME = 25 * 60; // 25 minutes in seconds
const DEFAULT_BREAK_TIME = 5 * 60; // 5 minutes in seconds

const initialState: PomodoroState = {
  timeLeft: DEFAULT_WORK_TIME,
  workDuration: DEFAULT_WORK_TIME,
  breakDuration: DEFAULT_BREAK_TIME,
  isRunning: false,
  isBreak: false,
  task: '',
  startTime: null,
};

export const pomodoroSlice = createSlice({
  name: 'pomodoro',
  initialState,
  reducers: {
    setTimeLeft: (state, action: PayloadAction<number>) => {
      state.timeLeft = action.payload;
    },
    setWorkDuration: (state, action: PayloadAction<number>) => {
      state.workDuration = action.payload;
      if (!state.isBreak) {
        state.timeLeft = action.payload;
      }
    },
    setBreakDuration: (state, action: PayloadAction<number>) => {
      state.breakDuration = action.payload;
      if (state.isBreak) {
        state.timeLeft = action.payload;
      }
    },
    setIsRunning: (state, action: PayloadAction<boolean>) => {
      state.isRunning = action.payload;
    },
    setIsBreak: (state, action: PayloadAction<boolean>) => {
      state.isBreak = action.payload;
    },
    setTask: (state, action: PayloadAction<string>) => {
      state.task = action.payload;
    },
    setStartTime: (state, action: PayloadAction<string | null>) => {
      state.startTime = action.payload;
    },
    reset: (state) => {
      state.timeLeft = state.isBreak ? state.breakDuration : state.workDuration;
      state.isRunning = false;
      state.isBreak = false;
      state.task = '';
      state.startTime = null;
    },
  },
});

export const {
  setTimeLeft,
  setWorkDuration,
  setBreakDuration,
  setIsRunning,
  setIsBreak,
  setTask,
  setStartTime,
  reset,
} = pomodoroSlice.actions;

export default pomodoroSlice.reducer;