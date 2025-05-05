import { useEffect, useRef, useState } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { Mic, MicOff, Loader2, Check} from 'lucide-react';
import * as chrono from 'chrono-node';
import { supabase } from '../lib/supabase';
import { useSelector } from 'react-redux'; // Import useSelector
import { format } from 'date-fns';

interface ProcessedNote {
  type: 'calendar' | 'reminder' | 'note' | 'task';
  content: string;
  date?: Date;
}

export function VoiceNotesWidget() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessed, setLastProcessed] = useState<ProcessedNote | null>(null);
  const user = useSelector((state: any) => state.auth.user); // Use useSelector

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  const processTranscript = async () => {
    if (!transcript.trim() || !user?.id) return;

    setIsProcessing(true);
    try {
      const parsedDates = chrono.parse(transcript);
      const lowerTranscript = transcript.toLowerCase();

      // Check if this is a task
      if (lowerTranscript.includes('task') || lowerTranscript.includes('todo')) {
        const taskData = {
          user_id: user.id,
          title: transcript.replace(/^(add |create |new )?(task|todo)( to do)?:?\s*/i, ''),
          status: 'pending',
          priority: 'medium'
        };

        if (parsedDates.length > 0) {
          const date = parsedDates[0].start.date();
          taskData.due_date = format(date, 'yyyy-MM-dd');
        }

        // Add task
        await supabase.from('tasks').insert([taskData]);

        // Add calendar event if there's a due date
        if (parsedDates.length > 0) {
          await supabase.from('calendar_events').insert({
            user_id: user.id,
            title: `Task Due: ${taskData.title}`,
            event_date: taskData.due_date,
            event_type: 'task',
            completed: false
          });
        }

        setLastProcessed({
          type: 'task',
          content: taskData.title,
          date: parsedDates.length > 0 ? parsedDates[0].start.date() : undefined
        });
      }
      // Handle calendar events
      else if (parsedDates.length > 0) {
        const date = parsedDates[0].start.date();
        const beforeDate = transcript.substring(0, parsedDates[0].index).trim();
        const afterDate = transcript.substring(parsedDates[0].index + parsedDates[0].text.length).trim();

        const eventTitle = beforeDate || afterDate;
        const formattedDate = format(date, 'yyyy-MM-dd');

        await supabase.from('calendar_events').insert({
          user_id: user.id,
          title: eventTitle,
          event_date: formattedDate,
          event_type: 'voice_note',
          description: transcript,
          completed: false
        });

        setLastProcessed({
          type: 'calendar',
          content: eventTitle,
          date
        });
      } else {
        setLastProcessed({
          type: 'note',
          content: transcript
        });
      }
    } catch (error) {
      console.error('Error processing voice note:', error);
    }
    setIsProcessing(false);
    resetTranscript();
  };

  useEffect(() => {
    if (!listening && transcript) {
      processTranscript();
    }
  }, [listening, transcript, user]); // Added user to dependency array

  if (!browserSupportsSpeechRecognition) {
    return (
      <div className="text-center text-muted-foreground">
        Your browser doesn't support voice recognition.
      </div>
    );
  }

  return (
    <div className="fixed top-20 right-4 w-96 bg-card rounded-lg shadow-lg border border-border animate-fade-in">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (listening) {
                  SpeechRecognition.stopListening();
                } else {
                  resetTranscript();
                  SpeechRecognition.startListening({ continuous: true });
                }
              }}
              className={`p-2 rounded-full ${
                listening
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-primary hover:bg-primary/90'
              } text-white transition-colors`}
            >
              {listening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
            {listening && (
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Listening...
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {listening && transcript && (
            <div className="bg-muted rounded-lg p-3 animate-fade-in">
              <p className="text-sm">{transcript}</p>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center justify-center gap-2 text-primary py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </div>
          )}

          {lastProcessed && !isProcessing && !listening && (
            <div className="bg-muted/50 rounded-lg p-3 animate-fade-in">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 mb-1">
                <Check className="h-4 w-4" />
                {lastProcessed.type === 'calendar' ? 'Added to calendar' :
                 lastProcessed.type === 'task' ? 'Task created' : 'Note saved'}
              </div>
              <p className="text-sm">{lastProcessed.content}</p>
              {lastProcessed.date && (
                <p className="text-xs text-muted-foreground mt-1">
                  Date: {format(lastProcessed.date, 'MMMM d,yyyy')}
                </p>
              )}
            </div>
          )}

          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
            <p className="font-medium mb-1">Try saying:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>"Add task: Update resume by next Friday"</li>
              <li>"Schedule interview preparation for tomorrow"</li>
              <li>"Create todo: Follow up with recruiter in 3 days"</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}