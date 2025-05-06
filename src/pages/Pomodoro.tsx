import React, { useEffect, useCallback, useState, useRef } from 'react'; // Added useRef to imports
import { Play, Pause, RotateCcw, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store'; // Import RootState for better typing
import { setTimeLeft, setWorkDuration, setBreakDuration, setIsRunning, setIsBreak, setTask, setStartTime, reset } from '../store/pomodoroSlice';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
// Removed unused useNavigate import
// import { useNavigate } from 'react-router-dom';

// Define a type for the session data for clarity
type PomodoroSession = {
  id: string;
  task: string;
  created_at: string;
  completed: boolean;
  // Add other fields if necessary
};

const Pomodoro = () => {
  // Use RootState for proper typing
  const timeLeft = useSelector((state: RootState) => state.pomodoro.timeLeft);
  const workDuration = useSelector((state: RootState) => state.pomodoro.workDuration);
  const breakDuration = useSelector((state: RootState) => state.pomodoro.breakDuration);
  const isRunning = useSelector((state: RootState) => state.pomodoro.isRunning);
  const isBreak = useSelector((state: RootState) => state.pomodoro.isBreak);
  const task = useSelector((state: RootState) => state.pomodoro.task);
  const startTime = useSelector((state: RootState) => state.pomodoro.startTime);
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();
  // const navigate = useNavigate(); // Removed unused navigate

  const [sessions, setSessions] = useState<PomodoroSession[]>([]); // Use the defined type
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null); // Use useRef correctly

  const fetchSessions = useCallback(async () => {
    if (!user) return;

    try {
        const { data, error } = await supabase
          .from('pomodoro_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        if (data) setSessions(data as PomodoroSession[]); // Assert type

    } catch (error) {
        console.error("Error fetching Pomodoro sessions:", error);
        // Optionally show an error message to the user
    }
  }, [user]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Effect for the timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        dispatch(setTimeLeft(timeLeft - 1));
      }, 1000);
    } else if (isRunning && timeLeft === 0) {
      // Timer reached zero while running
      if (audioRef.current) {
        audioRef.current.play().catch(console.error); // Play sound
      }

      // Persist session completion (example logic, adjust as needed)
      const completeSession = async () => {
          if (!isBreak && startTime && task && user) { // Only log completed work sessions
              const endTime = new Date().toISOString();
              const durationSeconds = Math.floor((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000);
              try {
                  const { error } = await supabase.from('pomodoro_sessions').insert({
                      user_id: user.id,
                      task: task,
                      start_time: startTime,
                      end_time: endTime,
                      duration: durationSeconds,
                      completed: true // Mark as completed
                  });
                  if (error) throw error;
                  fetchSessions(); // Refresh recent sessions list
              } catch (error) {
                  console.error("Error saving completed Pomodoro session:", error);
              }
          }
      };

      completeSession(); // Call the async function

      // Switch state (Work -> Break or Break -> Work)
      if (!isBreak) { // Work session finished
        dispatch(setIsBreak(true));
        dispatch(setTimeLeft(breakDuration));
        setSnackbarMessage('Work session ended! Time for a break.');
      } else { // Break session finished
        dispatch(setIsBreak(false));
        dispatch(setTimeLeft(workDuration));
        setSnackbarMessage('Break time over! Ready to work.');
        // Reset task for the new work session? Optional.
        // dispatch(setTask(''));
      }
      setSnackbarOpen(true);
      dispatch(setIsRunning(false)); // Stop the timer conceptually
      dispatch(setStartTime(null)); // Reset start time for the next interval
    }

    // Cleanup function
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning, timeLeft, isBreak, task, user, fetchSessions, dispatch, startTime, workDuration, breakDuration]);


  // Initialize Audio only once on the client-side
  useEffect(() => {
    if (typeof window !== 'undefined') {
        // Ensure this runs only in the browser
        audioRef.current = new Audio('/sounds/timer-complete.mp3'); // Adjust path as needed
    }
  }, []);


  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleReset = () => {
    if (isRunning) {
       dispatch(setIsRunning(false)); // Stop timer first if running
    }
    dispatch(reset()); // Dispatch the reset action from the slice
     // Optionally clear the task input as well
     // dispatch(setTask(''));
  };

  const toggleTimer = () => {
    // Prevent starting timer without a task during work session
    if (!isBreak && !task && !isRunning) {
        setSnackbarMessage('Please enter a task before starting the timer.');
        setSnackbarOpen(true);
        return;
    }

    // Set start time only when starting a new work session from idle
    if (!isRunning && !isBreak && !startTime) {
      dispatch(setStartTime(new Date().toISOString()));
    } else if (!isRunning && isBreak) {
        // Don't track start time for breaks, or handle differently if needed
        dispatch(setStartTime(null));
    }

    dispatch(setIsRunning(!isRunning));
  };

  // Ensure timeOptions are defined correctly
  const timeOptions = Array.from({ length: 12 }, (_, i) => (i + 1) * 5); // e.g., 5 to 60 mins
  const breakTimeOptions = Array.from({ length: 6 }, (_, i) => (i + 1) * 5); // e.g., 5 to 30 mins


  const handleCloseSnackbar = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
    setSnackbarMessage(null); // Clear message when closing
  };

  return (
    // Consistent main layout structure
    <main className="min-h-screen w-full relative flex justify-center px-4 pt-16 pb-16 overflow-y-auto">
       {/* Background Image and Overlay */}
      <div className="fixed inset-0 z-0">
        <img
          src="https://img.heroui.chat/image/landscape?w=1920&h=1080&u=1"
          className="w-full h-full object-cover"
          alt="Background"
        />
        <div className="absolute inset-0 bg-black/20" /> {/* Consistent overlay */}
      </div>

      {/* Content Area */}
      <div className="w-full max-w-3xl z-10"> {/* Adjusted max-width */}
        <div className="space-y-6">
           {/* Header - Consistent style */}
          <h1 className="text-3xl font-bold text-white mix-blend-screen">Pomodoro Timer</h1>

          {/* Main Timer Card - Applied consistent styling */}
          <div className="bg-card/80 backdrop-blur-sm shadow-lg border-border/50 p-6 rounded-lg text-card-foreground">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold mb-2">{isBreak ? 'Break Time!' : 'Work Session'}</h2>
              <div className={`text-6xl font-mono mb-4 font-bold ${isBreak ? 'text-green-400' : 'text-primary'}`}>
                  {formatTime(timeLeft)}
              </div>

              {/* Duration Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                 {/* Work Duration */}
                 <div>
                   <label className="block text-sm font-medium mb-2 text-card-foreground/80">Work Duration (minutes)</label>
                   <div className="flex flex-wrap gap-2 justify-center">
                     {timeOptions.map((minutes) => (
                       <button
                         key={`work-${minutes}`}
                         onClick={() => dispatch(setWorkDuration(minutes * 60))}
                         disabled={isRunning}
                         className={`px-3 py-1 rounded-md text-xs sm:text-sm transition-colors ${
                           workDuration === minutes * 60 && !isBreak // Highlight only if it's the current work duration AND not on break
                             ? 'bg-primary text-primary-foreground'
                             : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                         } disabled:opacity-50 disabled:cursor-not-allowed`}
                       >
                         {minutes}m
                       </button>
                     ))}
                   </div>
                 </div>
                 {/* Break Duration */}
                 <div>
                   <label className="block text-sm font-medium mb-2 text-card-foreground/80">Break Duration (minutes)</label>
                   <div className="flex flex-wrap gap-2 justify-center">
                     {breakTimeOptions.map((minutes) => (
                       <button
                         key={`break-${minutes}`}
                         onClick={() => dispatch(setBreakDuration(minutes * 60))}
                         disabled={isRunning}
                         className={`px-3 py-1 rounded-md text-xs sm:text-sm transition-colors ${
                           breakDuration === minutes * 60 && isBreak // Highlight only if it's the current break duration AND on break
                             ? 'bg-green-500 text-white' // Different highlight for break
                             : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                         } disabled:opacity-50 disabled:cursor-not-allowed`}
                       >
                         {minutes}m
                       </button>
                     ))}
                   </div>
                 </div>
              </div>

              {/* Task Input - Only show when not on break */}
               {!isBreak && (
                <div className="mb-6 px-4 sm:px-8">
                   <label htmlFor="taskInput" className="sr-only">Task</label>
                   <input
                     id="taskInput"
                     type="text"
                     placeholder="What are you working on?"
                     value={task}
                     onChange={(e) => dispatch(setTask(e.target.value))}
                     className="w-full p-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-center text-sm sm:text-base"
                     disabled={isRunning} // Disable input while timer is running
                   />
                </div>
               )}

              {/* Timer Controls */}
              <div className="flex justify-center items-center gap-4">
                <button
                  onClick={toggleTimer}
                  disabled={!isBreak && !task} // Keep disable logic based on task for work session
                  className={`p-3 sm:p-4 rounded-full transition-all transform hover:scale-110 ${
                    isRunning
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                  title={isRunning ? 'Pause Timer' : 'Start Timer'}
                >
                  {isRunning ? ( <Pause className="h-5 w-5 sm:h-6 sm:w-6" /> ) : ( <Play className="h-5 w-5 sm:h-6 sm:w-6" /> )}
                </button>
                <button
                  onClick={handleReset}
                  className="p-3 sm:p-4 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-all transform hover:scale-110"
                  title="Reset Timer"
                >
                  <RotateCcw className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              </div>
            </div>

             {/* Recent Sessions List */}
            {sessions.length > 0 && (
                <div className="border-t border-border/50 pt-6 mt-8">
                  <h3 className="text-lg font-semibold mb-4 text-center sm:text-left">Recent Sessions</h3>
                  <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-md text-sm"
                      >
                        <div className="flex-grow pr-4">
                          <p className="font-medium truncate" title={session.task}>{session.task || 'Untitled Session'}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(session.created_at).toLocaleDateString()} {new Date(session.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                        {session.completed && (
                          <Check className="h-5 w-5 text-green-500 flex-shrink-0" title="Completed"/>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
            )}
          </div>

           {/* How it Works Card - Applied consistent styling */}
          <div className="bg-card/80 backdrop-blur-sm shadow-lg border-border/50 p-6 rounded-lg text-card-foreground">
            <h2 className="text-xl font-semibold mb-4">How it works</h2>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Choose your desired work and break durations above.</li>
              <li>Enter the task you want to focus on (for work sessions).</li>
              <li>Click the Play button to start the timer.</li>
              <li>Focus on your task until the timer rings.</li>
              <li>Take your scheduled break when prompted.</li>
              <li>Repeat the cycle!</li>
            </ol>
          </div>
        </div>
      </div>
      {/* Snackbar remains outside the main content flow for positioning */}
      <Snackbar open={snackbarOpen} autoHideDuration={4000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert variant="filled" onClose={handleCloseSnackbar} severity={snackbarMessage?.includes('Break') ? 'info' : 'success'} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </main>
  );
};

export default Pomodoro;