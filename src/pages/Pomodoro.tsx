import React, { useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { usePomodoroStore } from '../store/usePomodoroStore';

const Pomodoro = () => {
  const {
    timeLeft,
    workDuration,
    breakDuration,
    isRunning,
    isBreak,
    task,
    startTime,
    setTimeLeft,
    setWorkDuration,
    setBreakDuration,
    setIsRunning,
    setIsBreak,
    setTask,
    setStartTime,
    reset
  } = usePomodoroStore();
  const [sessions, setSessions] = React.useState<any[]>([]);
  const user = useAuthStore((state) => state.user);

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
        setTimeLeft(timeLeft - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      if (!isBreak) {
        if (user && task) {
          supabase
            .from('pomodoro_sessions')
            .insert([
              {
                user_id: user.id,
                duration: workDuration,
                task,
                completed: true,
                start_time: startTime,
              }
            ])
            .then(() => {
              fetchSessions();
            });
        }
        setIsBreak(true);
        setTimeLeft(breakDuration);
      } else {
        setIsBreak(false);
        setTimeLeft(workDuration);
      }
      setIsRunning(false);
      setStartTime(null);
    }

    return () => clearInterval(interval);
  }, [isRunning, timeLeft, isBreak, task, user, fetchSessions, setTimeLeft, setIsBreak, setIsRunning, setStartTime, startTime, workDuration, breakDuration]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleReset = () => {
    reset();
  };

  const toggleTimer = () => {
    if (!isRunning && !isBreak && !task) return;
    if (!isRunning && !startTime) {
      setStartTime(new Date().toISOString());
    }
    setIsRunning(!isRunning);
  };

  const timeOptions = Array.from({ length: 6 }, (_, i) => (i + 1) * 5);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Pomodoro Timer</h1>
      
      <div className="bg-card text-card-foreground p-8 rounded-lg shadow-md mb-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold mb-2">
            {isBreak ? 'Break Time!' : 'Work Session'}
          </h2>
          <div className="text-6xl font-mono mb-4">{formatTime(timeLeft)}</div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Work Duration</label>
              <div className="flex flex-wrap gap-2 justify-center">
                {timeOptions.map((minutes) => (
                  <button
                    key={minutes}
                    onClick={() => setWorkDuration(minutes * 60)}
                    disabled={isRunning}
                    className={`px-3 py-1 rounded-md text-sm ${
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
                    onClick={() => setBreakDuration(minutes * 60)}
                    disabled={isRunning}
                    className={`px-3 py-1 rounded-md text-sm ${
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
              onChange={(e) => setTask(e.target.value)}
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
  );
};

export default Pomodoro;