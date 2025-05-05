import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux'; // Import Redux hooks
import { setTimeLeft, setIsRunning, setIsBreak, setTask, setStartTime, reset } from '../store/pomodoroSlice'; // Import Pomodoro actions
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import type { RootState } from '../store'; // Import RootState for typed selectors

export function PomodoroWidget() {
  // Use RootState for typed selectors
  const timeLeft = useSelector((state: RootState) => state.pomodoro.timeLeft);
  const workDuration = useSelector((state: RootState) => state.pomodoro.workDuration);
  const breakDuration = useSelector((state: RootState) => state.pomodoro.breakDuration);
  const isRunning = useSelector((state: RootState) => state.pomodoro.isRunning);
  const isBreak = useSelector((state: RootState) => state.pomodoro.isBreak);
  const task = useSelector((state: RootState) => state.pomodoro.task);
  const startTime = useSelector((state: RootState) => state.pomodoro.startTime);

  const dispatch = useDispatch();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'info' | 'warning' | 'error'>('success'); // Add severity state

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Consider making the audio source configurable or loading it only when needed
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined; // Initialize as undefined

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        dispatch(setTimeLeft(timeLeft - 1));
      }, 1000);
    } else if (isRunning && timeLeft === 0) { // Only transition state if it was running and hit 0
      if (audioRef.current) {
        audioRef.current.play().catch(console.error); // Play sound on completion
      }

      // Stop the current timer run first
      dispatch(setIsRunning(false));
      dispatch(setStartTime(null)); // Clear start time for the completed session

      if (!isBreak) {
        // Transition to Break
        setSnackbarMessage('Work session complete! Time for a break.');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        dispatch(setIsBreak(true));
        dispatch(setTimeLeft(breakDuration)); // Set break duration
      } else {
        // Transition back to Work (idle)
        setSnackbarMessage('Break time over! Ready for a new task?');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        dispatch(setIsBreak(false));
        dispatch(setTimeLeft(workDuration)); // Reset to work duration
        dispatch(setTask('')); // Optionally clear task after break
      }
    } else {
        // Clear interval if not running or timeLeft is 0 but wasn't running
         if (interval) {
             clearInterval(interval);
         }
    }

    // Cleanup function
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning, timeLeft, isBreak, dispatch, workDuration, breakDuration]);


  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // *** toggleTimer Function with CONSOLE LOGS added ***
  const toggleTimer = () => {
    // Log initial state values when the function is called
    console.log('toggleTimer called. State: isRunning=', isRunning, 'isBreak=', isBreak, 'task=', `"${task}"`); // Log state

    if (isRunning) {
      // --- Pause Logic ---
      console.log('Action: Pausing timer.'); // Log action
      dispatch(setIsRunning(false));
      // Optional: could calculate remaining time more precisely here if needed
    } else {
      // --- Play Logic ---
      console.log('Action: Attempting to play/start timer.'); // Log action
      if (!isBreak) { // Only allow starting if not on break
        console.log('Condition: Not on break.'); // Log condition met
        if (task) { // Check if task exists
          // Start or Resume Timer
          console.log('Condition: Task exists. Starting timer.'); // Log condition met
          if (!startTime) { // Set start time only when initially starting
            dispatch(setStartTime(new Date().toISOString()));
          }
          dispatch(setIsRunning(true));
        } else {
          // --- No Task Feedback ---
          console.log('>>> Condition: TASK IS MISSING <<<'); // Log condition met (task missing)
          setSnackbarMessage('Please enter a task before starting the timer.');
          setSnackbarSeverity('warning');
          console.log('Action: Calling setSnackbarOpen(true)'); // Log action about to happen
          setSnackbarOpen(true); // <<< Make the Snackbar appear
        }
      } else {
         console.log('Condition: Currently on break. Cannot start.'); // Log condition (on break)
      }
    }
  };


  const handleReset = () => {
    // Optionally stop audio if resetting during sound playback
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0; // Reset audio position
    }
    dispatch(reset()); // Dispatch the reset action from your slice
  };


  const handleCloseSnackbar = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  return (
    <div className="text-center p-4"> {/* Added padding */}
      <div className="text-4xl font-mono mb-3">{formatTime(timeLeft)}</div> {/* Increased size/margin */}

      {/* Task Input - Show only when NOT running and NOT on break */}
      {!isRunning && !isBreak && (
        <input
          type="text"
          placeholder="What are you working on?" // More descriptive placeholder
          value={task}
          onChange={(e) => dispatch(setTask(e.target.value))}
          className="w-full p-2 text-sm rounded border border-input bg-background mb-3 focus:ring-1 focus:ring-primary focus:outline-none" // Adjusted style
        />
      )}

      {/* Display Task - Show only when running */}
      {isRunning && task && (
        <p className="text-sm text-muted-foreground mb-3 truncate" title={task}> {/* Added title for full task on hover */}
          Working on: {task}
        </p>
      )}

      {/* Display Break Message - Show only when on break */}
      {isBreak && (
         <p className="text-sm text-primary font-semibold mb-3">
             Break Time!
         </p>
      )}


      <div className="flex justify-center items-center gap-3 mb-3"> {/* Increased gap */}
        {/* Play/Pause Button */}
        <button
          onClick={toggleTimer}
          // Disable button only during break time
          disabled={isBreak}
          className={`p-3 rounded-full transition-colors ${ // Increased padding
            isRunning
              ? 'bg-orange-500 hover:bg-orange-600' // Use orange for Pause
              : 'bg-green-600 hover:bg-green-700' // Use green for Play
          } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label={isRunning ? "Pause Timer" : "Start Timer"} // ARIA label
        >
          {isRunning ? (
            <Pause className="h-5 w-5" /> // Slightly larger icons
          ) : (
            <Play className="h-5 w-5" />
          )}
        </button>

        {/* Reset Button */}
        <button
          onClick={handleReset} // Use updated handler
          className="p-3 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors" // Adjusted style & padding
          aria-label="Reset Timer" // ARIA label
        >
          <RotateCcw className="h-5 w-5" />
        </button>
      </div>

      {/* Link to Full Timer */}
      <Link
        to="/pomodoro" // Ensure this route exists in your router setup
        className="text-xs text-primary hover:underline"
      >
        Go to full Pomodoro page →
      </Link>

      {/* Snackbar for Notifications */}
      <Snackbar
    open={snackbarOpen}
    autoHideDuration={4000} // Or your preferred duration
    onClose={handleCloseSnackbar}
    // 1. Set position to MIDDLE-CENTER:
    anchorOrigin={{ vertical: 'middle', horizontal: 'center' }}
    // 2. Set z-index higher than Navbar (10) using sx prop:
    //    1400 is a common safe value for MUI overlays.
    sx={{ zIndex: 1400 }}
>
  {/* Make sure snackbarMessage has a value before rendering Alert */}
  {snackbarMessage && (
       <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }} variant="filled">
          {snackbarMessage}
       </Alert>
  )}
</Snackbar>
    </div>
  );
}