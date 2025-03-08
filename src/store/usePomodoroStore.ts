import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuthStore } from './useAuthStore';

interface PomodoroState {
  timeLeft: number;
  workDuration: number;
  breakDuration: number;
  isRunning: boolean;
  isBreak: boolean;
  task: string;
  startTime: string | null;
  setTimeLeft: (time: number) => void;
  setWorkDuration: (duration: number) => void;
  setBreakDuration: (duration: number) => void;
  setIsRunning: (running: boolean) => void;
  setIsBreak: (isBreak: boolean) => void;
  setTask: (task: string) => void;
  setStartTime: (time: string | null) => void;
  reset: () => void;
}

const DEFAULT_WORK_TIME = 25 * 60; // 25 minutes in seconds
const DEFAULT_BREAK_TIME = 5 * 60; // 5 minutes in seconds

const getStorageKey = () => {
  const user = useAuthStore.getState().user;
  return user ? `pomodoro-storage-${user.id}` : null;
};

const createPomodoroStore = () => {
  const storageKey = getStorageKey();
  
  if (!storageKey) {
    // Return a basic store without persistence if no user
    return create<PomodoroState>()((set, get) => ({
      timeLeft: DEFAULT_WORK_TIME,
      workDuration: DEFAULT_WORK_TIME,
      breakDuration: DEFAULT_BREAK_TIME,
      isRunning: false,
      isBreak: false,
      task: '',
      startTime: null,
      setTimeLeft: (time) => set({ timeLeft: time }),
      setWorkDuration: (duration) => {
        const isBreak = get().isBreak;
        set({ 
          workDuration: duration,
          timeLeft: isBreak ? get().timeLeft : duration
        });
      },
      setBreakDuration: (duration) => {
        const isBreak = get().isBreak;
        set({ 
          breakDuration: duration,
          timeLeft: isBreak ? duration : get().timeLeft
        });
      },
      setIsRunning: (running) => set({ isRunning: running }),
      setIsBreak: (isBreak) => set({ isBreak }),
      setTask: (task) => set({ task }),
      setStartTime: (time) => set({ startTime: time }),
      reset: () => {
        const { workDuration, breakDuration } = get();
        set({
          timeLeft: get().isBreak ? breakDuration : workDuration,
          isRunning: false,
          isBreak: false,
          task: '',
          startTime: null,
        });
      },
    }));
  }

  // Return a persisted store for authenticated users
  return create<PomodoroState>()(
    persist(
      (set, get) => ({
        timeLeft: DEFAULT_WORK_TIME,
        workDuration: DEFAULT_WORK_TIME,
        breakDuration: DEFAULT_BREAK_TIME,
        isRunning: false,
        isBreak: false,
        task: '',
        startTime: null,
        setTimeLeft: (time) => set({ timeLeft: time }),
        setWorkDuration: (duration) => {
          const isBreak = get().isBreak;
          set({ 
            workDuration: duration,
            timeLeft: isBreak ? get().timeLeft : duration
          });
        },
        setBreakDuration: (duration) => {
          const isBreak = get().isBreak;
          set({ 
            breakDuration: duration,
            timeLeft: isBreak ? duration : get().timeLeft
          });
        },
        setIsRunning: (running) => set({ isRunning: running }),
        setIsBreak: (isBreak) => set({ isBreak }),
        setTask: (task) => set({ task }),
        setStartTime: (time) => set({ startTime: time }),
        reset: () => {
          const { workDuration, breakDuration } = get();
          set({
            timeLeft: get().isBreak ? breakDuration : workDuration,
            isRunning: false,
            isBreak: false,
            task: '',
            startTime: null,
          });
        },
      }),
      {
        name: storageKey,
      }
    )
  );
};

export const usePomodoroStore = () => {
  const store = createPomodoroStore();
  return store();
};