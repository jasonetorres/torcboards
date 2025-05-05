import React, { useEffect, useCallback, useState } from 'react';
import { Play, Pause, RotateCcw, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSelector, useDispatch } from 'react-redux';
import { setTimeLeft, setWorkDuration, setBreakDuration, setIsRunning, setIsBreak, setTask, setStartTime, reset } from '../store/pomodoroSlice';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { useNavigate } from 'react-router-dom';

const Pomodoro = () => {
  const timeLeft = useSelector((state: any) => state.pomodoro.timeLeft);
  const workDuration = useSelector((state: any) => state.pomodoro.workDuration);
  const breakDuration = useSelector((state: any) => state.pomodoro.breakDuration);
  const isRunning = useSelector((state: any) => state.pomodoro.isRunning);
  const isBreak = useSelector((state: any) => state.pomodoro.isBreak);
  const task = useSelector((state: any) => state.pomodoro.task);
  const startTime = useSelector((state: any) => state.pomodoro.startTime);
  const user = useSelector((state: any) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate(); // Removed unused navigate
  const [sessions, setSessions] = useState<any[]>([]);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from('pomodoro_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) setSessions(data);
  }, [user]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        dispatch(setTimeLeft(timeLeft - 1));
      }, 1000);
    } else if (timeLeft === 0) {
      if (audioRef.current) {
        audioRef.current.play().catch(console.error);
      }

      if (!isBreak) {
        dispatch(setIsBreak(true));
        dispatch(setTimeLeft(breakDuration));
        setSnackbarMessage('Work session ended! Time for a break.');
        setSnackbarOpen(true);
        dispatch(setIsRunning(false));
        dispatch(setStartTime(null));
      } else {
        dispatch(setIsBreak(false));
        dispatch(setTimeLeft(workDuration));
        setSnackbarMessage('Break time over! Ready to work.');
        setSnackbarOpen(true);
        dispatch(setIsRunning(false));
        dispatch(setStartTime(null));
      }
    }

    return () => clearInterval(interval);
  }, [isRunning, timeLeft, isBreak, task, user, fetchSessions, dispatch, startTime, workDuration, breakDuration]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleReset = () => {
    dispatch(reset());
  };

  const toggleTimer = () => {
    if (!isRunning && !isBreak && !task) return;
    if (!isRunning && !startTime) {
      dispatch(setStartTime(new Date().toISOString()));
    }
    dispatch(setIsRunning(!isRunning));
  };

  const timeOptions = Array.from({ length: 6 }, (_, i) => (i + 1) * 5);

  const handleCloseSnackbar = (_event: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  return (
    <main className="min-h-screen w-full relative flex items-center justify-center p-4">
      <div className="fixed inset-0 z-0">
        <img
          src="https://img.heroui.chat/image/landscape?w=1920&h=1080&u=1"
          className="w-full h-full object-cover"
          alt="Dashboard Background"
        />
        <div className="absolute inset-0 bg-background/" />
      </div>

      <div className="w-full max-w-7xl z-10">
        <div className="space-y-6">
          <h1 className="text-3xl font-bold mb-6 text-foreground">Pomodoro Timer</h1>

          <div className="bg-card text-card-foreground p-6 rounded-lg shadow-md mb-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold mb-2">{isBreak ? 'Break Time!' : 'Work Session'}</h2>
              <div className="text-6xl font-mono mb-4">{formatTime(timeLeft)}</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Work Duration</label>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {timeOptions.map((minutes) => (
                      <button
                        key={minutes}
                        onClick={() => dispatch(setWorkDuration(minutes * 60))}
                        disabled={isRunning}
                        className={`px-3 py-1 rounded-md text-sm w-full sm:w-auto ${
                          workDuration === minutes * 60
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80'
                        } disabled:opacity-50`}
                      >
                        {minutes}m
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Break Duration</label>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {timeOptions.slice(0, 3).map((minutes) => (
                      <button
                        key={minutes}
                        onClick={() => dispatch(setBreakDuration(minutes * 60))}
                        disabled={isRunning}
                        className={`px-3 py-1 rounded-md text-sm w-full sm:w-auto ${
                          breakDuration === minutes * 60
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80'
                        } disabled:opacity-50`}
                      >
                        {minutes}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {!isBreak && (
                <input
                  type="text"
                  placeholder="What are you working on?"
                  value={task}
                  onChange={(e) => dispatch(setTask(e.target.value))}
                  className="w-full p-2 rounded border border-input bg-background mb-4"
                  disabled={isRunning}
                />
              )}
              <div className="flex justify-center gap-4">
                <button
                  onClick={toggleTimer}
                  disabled={!isBreak && !task}
                  className={`p-4 rounded-full ${
                    isRunning
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-primary hover:bg-primary/90'
                  } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isRunning ? (
                    <Pause className="h-6 w-6" />
                  ) : (
                    <Play className="h-6 w-6" />
                  )}
                </button>
                <button
                  onClick={handleReset}
                  className="p-4 rounded-full bg-muted hover:bg-muted/90"
                >
                  <RotateCcw className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <h3 className="text-lg font-semibold mb-4">Recent Sessions</h3>
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-md"
                  >
                    <div>
                      <p className="font-medium">{session.task}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(session.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {session.completed && (
                      <Check className="h-5 w-5 text-green-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card text-card-foreground p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">How it works</h2>
            <div className="space-y-3 text-muted-foreground">
              <p>1. Choose your work and break durations</p>
              <p>2. Enter the task you want to focus on</p>
              <p>3. Work until the timer ends</p>
              <p>4. Take a break</p>
              <p>5. Repeat!</p>
            </div>
          </div>
        </div>
      </div>
      <Snackbar open={snackbarOpen} autoHideDuration={3000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </main>
  );
};

export default Pomodoro;