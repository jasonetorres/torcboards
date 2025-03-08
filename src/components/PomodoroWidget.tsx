import { useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { usePomodoroStore } from '../store/usePomodoroStore';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export function PomodoroWidget() {
  const {
    timeLeft,
    workDuration,
    breakDuration,
    isRunning,
    isBreak,
    task,
    startTime,
    setTimeLeft,
    setIsRunning,
    setIsBreak,
    setTask,
    setStartTime,
    reset
  } = usePomodoroStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      // Play sound
      if (audioRef.current) {
        audioRef.current.play().catch(console.error);
      }

      // Show notification
      if (!isBreak) {
        toast.success('Work session complete! Time for a break.', {
          duration: 4000,
          onDismiss: () => {
            setIsBreak(true);
            setTimeLeft(breakDuration);
            setIsRunning(false);
            setStartTime(null);
          }
        });
      } else {
        toast.success('Break time over! Ready to work?', {
          duration: 4000,
          onDismiss: () => {
            setIsBreak(false);
            setTimeLeft(workDuration);
            setIsRunning(false);
            setStartTime(null);
          }
        });
      }
    }

    return () => clearInterval(interval);
  }, [isRunning, timeLeft, isBreak, setTimeLeft, setIsBreak, setIsRunning, setStartTime, workDuration, breakDuration]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const toggleTimer = () => {
    if (!isRunning && !isBreak && !task) return;
    if (!isRunning && !startTime) {
      setStartTime(new Date().toISOString());
    }
    setIsRunning(!isRunning);
  };

  return (
    <div className="text-center">
      <div className="text-3xl font-mono mb-2">{formatTime(timeLeft)}</div>
      {!isBreak && !isRunning && (
        <input
          type="text"
          placeholder="Task..."
          value={task}
          onChange={(e) => setTask(e.target.value)}
          className="w-full p-1.5 text-sm rounded border border-input bg-background mb-2"
        />
      )}
      {isRunning && task && (
        <p className="text-xs text-muted-foreground mb-2 truncate">
          {task}
        </p>
      )}
      <div className="flex justify-center gap-2 mb-2">
        <button
          onClick={toggleTimer}
          disabled={!isBreak && !task}
          className={`p-2 rounded-full ${
            isRunning
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-primary hover:bg-primary/90'
          } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isRunning ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={reset}
          className="p-2 rounded-full bg-muted hover:bg-muted/90"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
      <Link
        to="/pomodoro"
        className="text-primary hover:underline text-xs"
      >
        View full timer →
      </Link>
    </div>
  );
}