import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { setTimeLeft, setIsRunning, setIsBreak, setTask, setStartTime, reset } from '../store/pomodoroSlice';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import type { RootState } from '../store';
import { cn } from '../lib/utils'; // Assuming you have this utility

// Types remain the same
type PomodoroSession = { /* ... */ };
type SnackbarSeverity = 'success' | 'error' | 'info' | 'warning';

export function PomodoroWidget() {
  // State and selectors remain the same
  const timeLeft = useSelector((state: RootState) => state.pomodoro.timeLeft);
  const workDuration = useSelector((state: RootState) => state.pomodoro.workDuration);
  const breakDuration = useSelector((state: RootState) => state.pomodoro.breakDuration);
  const isRunning = useSelector((state: RootState) => state.pomodoro.isRunning);
  const isBreak = useSelector((state: RootState) => state.pomodoro.isBreak);
  const task = useSelector((state: RootState) => state.pomodoro.task);
  const startTime = useSelector((state: RootState) => state.pomodoro.startTime);

  const dispatch = useDispatch();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<SnackbarSeverity>('success');

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // useEffects remain the same
  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        dispatch(setTimeLeft(timeLeft - 1));
      }, 1000);
    } else if (isRunning && timeLeft === 0) {
      if (audioRef.current) {
        audioRef.current.play().catch(console.error);
      }
      dispatch(setIsRunning(false));
      dispatch(setStartTime(null));

      let message = '';
      let severity: SnackbarSeverity = 'success';
      if (!isBreak) {
        message = 'Work session complete! Time for a break.';
        severity = 'success'; // Or 'info'
        dispatch(setIsBreak(true));
        dispatch(setTimeLeft(breakDuration));
      } else {
        message = 'Break time over! Ready for a new task?';
        severity = 'success';
        dispatch(setIsBreak(false));
        dispatch(setTimeLeft(workDuration));
        dispatch(setTask(''));
      }
      setSnackbarMessage(message);
      setSnackbarSeverity(severity);
      setSnackbarOpen(true);
    } else {
      if (interval) {
        clearInterval(interval);
      }
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning, timeLeft, isBreak, dispatch, workDuration, breakDuration, task, startTime]);


  // formatTime, handleReset, handleCloseSnackbar remain the same
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleReset = () => {
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    }
    dispatch(reset());
  };

  const handleCloseSnackbar = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  // *** CORRECTED toggleTimer Function ***
  const toggleTimer = () => {
    // Keep logs if they are helpful for you, otherwise remove
    console.log('toggleTimer called. State: isRunning=', isRunning, 'isBreak=', isBreak, 'task=', `"${task}"`);

    if (isRunning) {
      // --- Pause Logic ---
      console.log('Action: Pausing timer.');
      dispatch(setIsRunning(false));
    } else {
      // --- Play Logic ---
      console.log('Action: Attempting to play/start timer.');
      if (!isBreak) { // Check if not on break
        console.log('Condition: Not on break.');
        // --- CORRECTED Condition ---
        // Check if task exists AND is not just whitespace
        if (task?.trim()) {
          // Start or Resume Timer
          console.log('Condition: Task has content. Starting timer.');
          if (!startTime) { // Set start time only when initially starting
            dispatch(setStartTime(new Date().toISOString()));
          }
          dispatch(setIsRunning(true));
        } else {
          // --- No Task Feedback ---
          // This block now correctly catches null, undefined, empty string, or whitespace-only tasks
          console.log('>>> Condition: TASK IS MISSING OR EMPTY <<<');
          setSnackbarMessage('Please enter a task before starting the timer.');
          setSnackbarSeverity('warning');
          console.log('Action: Calling setSnackbarOpen(true)');
          setSnackbarOpen(true); // <<< Show the Snackbar
        }
        // --- End CORRECTED Condition ---
      } else {
         console.log('Condition: Currently on break. Cannot start.');
      }
    }
  };
  // *** End CORRECTED toggleTimer Function ***


  // Render logic remains largely the same, ensure structure is correct
  return (
    <div className="text-center p-4 flex flex-col h-full">
      <div className="text-4xl font-mono mb-3">{formatTime(timeLeft)}</div>

      <div className="flex-grow flex flex-col justify-center min-h-[50px]"> {/* Added min-height */}
        {!isRunning && !isBreak && (
          <input
            type="text"
            placeholder="What are you working on?"
            value={task}
            onChange={(e) => dispatch(setTask(e.target.value))}
            className="w-full p-2 text-sm rounded border border-input bg-background mb-3 focus:ring-1 focus:ring-primary focus:outline-none"
          />
        )}
        {isRunning && task && (
          <p className="text-sm text-muted-foreground mb-3 truncate h-[42px] flex items-center justify-center" title={task}> {/* Match input height approx */}
            Working on: {task}
          </p>
        )}
        {isBreak && (
           <p className="text-sm text-primary font-semibold mb-3 h-[42px] flex items-center justify-center"> {/* Match input height approx */}
               Break Time!
           </p>
        )}
        {/* Placeholder for consistent height when nothing else is shown */}
        {!((!isRunning && !isBreak) || (isRunning && task) || isBreak) && (
             <div className="mb-3 h-[42px]"></div>
         )}
      </div>

      <div className="flex justify-center items-center gap-3 mb-3">
        <button
          onClick={toggleTimer}
          disabled={isBreak} // Only disable during breaks
          className={cn(
            `p-3 rounded-full transition-colors text-white shadow-md`,
            isRunning ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          aria-label={isRunning ? "Pause Timer" : "Start Timer"}
        >
          {isRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <button
          onClick={handleReset}
          className="p-3 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors shadow"
          aria-label="Reset Timer"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
      </div>

      <Link
        to="/pomodoro"
        className="text-xs text-primary hover:underline"
      >
        Go to full Pomodoro page →
      </Link>

      {/* Snackbar (structure remains correct) */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ zIndex: 1400 }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }} variant="filled">
          {snackbarMessage || ''}
        </Alert>
      </Snackbar>
    </div>
  );
}