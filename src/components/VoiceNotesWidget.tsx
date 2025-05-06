import { useEffect, useState, useCallback } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { Mic, Square, Loader2, Check, AlertCircle, X, RefreshCcw } from 'lucide-react'; // Removed Info
import * as chrono from 'chrono-node';
import { supabase } from '../lib/supabase';
import { useSelector } from 'react-redux';
import { format, isValid } from 'date-fns'; // Removed isPast, isToday
import { RootState } from '../store';
import { cn } from '../lib/utils';

// --- Helper function to capitalize first letter ---
const capitalizeFirstLetter = (string: string): string => {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
};
// ----------------------------------------------------

// Types
interface ProcessedNote {
  type: 'calendar' | 'task' | 'note' | 'error';
  content: string;
  details?: string;
  date?: Date;
}

interface VoiceNotesWidgetProps {
    onClose: () => void;
}

interface TaskInsertData {
    user_id: string;
    title: string;
    description?: string | null;
    due_date?: string | null;
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'completed' | 'overdue';
    source?: string;
    related_calendar_event_id?: string | null;
}

export function VoiceNotesWidget({ onClose }: VoiceNotesWidgetProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessed, setLastProcessed] = useState<ProcessedNote | null>(null);
  const [displayedTranscript, setDisplayedTranscript] = useState('');
  const user = useSelector((state: RootState) => state.auth.user);

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable
  } = useSpeechRecognition();

  useEffect(() => {
    if (listening) {
      setDisplayedTranscript(transcript);
    }
  }, [transcript, listening]);

  const handleActionButtonClick = () => {
     if (lastProcessed) setLastProcessed(null);
     if (listening) {
       SpeechRecognition.stopListening();
     } else if (!isProcessing) {
       resetTranscript();
       setDisplayedTranscript('');
       if (isMicrophoneAvailable) {
         SpeechRecognition.startListening({ continuous: true });
       } else {
         setLastProcessed({ type: 'error', content: 'Microphone not available or permission denied.' });
       }
     }
   };

   const processTranscriptCallback = useCallback(async () => {
    let transcriptToProcess = displayedTranscript.trim();
    // console.log('[VOICE_WIDGET] Starting process. Raw Transcript:', `"${transcriptToProcess}"`);

    if (!transcriptToProcess || !user?.id) {
      resetTranscript(); setDisplayedTranscript(''); return;
    }

    setIsProcessing(true);
    setLastProcessed(null);
    setDisplayedTranscript('');
    // console.log('[VOICE_WIDGET] Set state: isProcessing=true, displayedTranscript cleared.');

    try {
      const parsedDates = chrono.parse(transcriptToProcess);
      const lowerTranscript = transcriptToProcess.toLowerCase();
      let coreContent = transcriptToProcess;
      let parsedDateObj: Date | undefined = undefined;
      let formattedDateForDB: string | null = null;

      // console.log('[VOICE_WIDGET] Parsed Dates from chrono:', parsedDates);

      if (parsedDates.length > 0 && isValid(parsedDates[0].start.date())) {
        parsedDateObj = parsedDates[0].start.date();
        formattedDateForDB = format(parsedDateObj, 'yyyy-MM-dd');
        const datePhrase = parsedDates[0].text;
        coreContent = transcriptToProcess.replace(new RegExp(datePhrase, 'i'), '').trim();
        coreContent = coreContent.replace(/^(on|at|by|for)\s+|\s+(on|at|by|for)$/gi, '').trim();
      }

      const commandPrefixesRegex = /^(hey |set a reminder |add |create |new |set |make |my )?(task |tasks |todo |to do |reminder |reminders )(for me |for me to |to |that I need to )?:?\s*/i;
      // --- Use capitalizeFirstLetter here ---
      let extractedTitle = capitalizeFirstLetter(coreContent.replace(commandPrefixesRegex, '').trim());

      if (!extractedTitle && coreContent) {
        extractedTitle = capitalizeFirstLetter(coreContent);
      } else if (!extractedTitle && transcriptToProcess) {
         extractedTitle = capitalizeFirstLetter(transcriptToProcess.replace(commandPrefixesRegex, '').trim());
      }

      if (!extractedTitle) {
          throw new Error("Could not understand the main content of your request.");
      }
      // ---------------------------------------

      if (lowerTranscript.includes('task') || lowerTranscript.includes('todo')) {
        const taskData: TaskInsertData = {
          user_id: user.id, title: extractedTitle, status: 'pending',
          priority: 'medium', due_date: formattedDateForDB, source: 'voice_command_task'
        };
        if (transcriptToProcess !== extractedTitle) taskData.description = transcriptToProcess;

        const { data: insertedTask, error: taskError } = await supabase.from('tasks').insert(taskData).select().single();
        if (taskError) throw new Error(`Failed to save task: ${taskError.message}`);

        if (taskData.due_date && insertedTask) {
          const calPayload = { user_id: user.id, title: `Task Due: ${taskData.title}`, event_date: taskData.due_date, event_type: 'task_due_date', completed: false, related_task_id: insertedTask.id };
          await supabase.from('calendar_events').upsert(calPayload, { onConflict: 'user_id, event_date, title' });
        }
        setLastProcessed({ type: 'task', content: taskData.title, date: parsedDateObj });
      }
      else if (parsedDateObj && formattedDateForDB) {
        const calendarPayload = {
          user_id: user.id, title: extractedTitle, event_date: formattedDateForDB,
          event_type: 'voice_reminder', description: transcriptToProcess, completed: false
        };
        const { data: upsertedCalEvent, error: calError } = await supabase.from('calendar_events').upsert(calendarPayload, { onConflict: 'user_id, event_date, title' }).select().single();
        if (calError) throw new Error(`Failed to save calendar event: ${calError.message}`);

        if (upsertedCalEvent) {
          const taskFromCal: TaskInsertData = {
            user_id: user.id, title: upsertedCalEvent.title, description: upsertedCalEvent.description || null,
            due_date: upsertedCalEvent.event_date, priority: 'medium', status: 'pending',
            source: 'voice_calendar_event', related_calendar_event_id: upsertedCalEvent.id
          };
          await supabase.from('tasks').upsert(taskFromCal, { onConflict: 'user_id, related_calendar_event_id' });
        }
        setLastProcessed({ type: 'calendar', content: extractedTitle, date: parsedDateObj });
      }
      else {
        setLastProcessed({ type: 'note', content: 'Note recorded: ' + transcriptToProcess.substring(0,50) + (transcriptToProcess.length > 50 ? '...' : '') });
      }
    } catch (error) {
      const errorMessage = (error as Error).message || 'An unknown error occurred.';
      setLastProcessed({ type: 'error', content: `Processing failed: ${errorMessage}` });
    } finally {
      setIsProcessing(false);
      resetTranscript();
    }
  }, [user, displayedTranscript, resetTranscript]);


  useEffect(() => {
    if (!listening && displayedTranscript && !isProcessing && user) {
      processTranscriptCallback();
    }
  }, [listening, displayedTranscript, isProcessing, user, processTranscriptCallback]);


  if (!browserSupportsSpeechRecognition || !isMicrophoneAvailable) {
    return (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 w-full max-w-xs bg-card/90 backdrop-blur-md rounded-lg shadow-xl border border-destructive/50 text-card-foreground p-4 z-[9999]">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-destructive">
                    {!browserSupportsSpeechRecognition ? "Voice Not Supported" : "Microphone Error"}
                </h3>
                <button onClick={onClose} className="p-1 text-muted-foreground hover:text-destructive" title="Close"><X className="h-4 w-4"/></button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
                {!browserSupportsSpeechRecognition
                    ? "Voice recognition isn't available in your current browser."
                    : "Microphone access is denied or microphone not found. Please check browser permissions."
                }
            </p>
        </div>
     );
  }

  // --- UI State Determination (Action Button, Main Content, Status Text) ---
  // (This logic remains unchanged from the previous correct version)
  let actionButtonIcon: React.ReactNode; let actionButtonText: string; let actionButtonClass = ""; let actionButtonTitle: string;
  let isButtonDisabled = isProcessing;
  if (listening) { /* ... */ actionButtonIcon = <Square className="h-5 w-5" />; actionButtonText = "Stop & Process"; actionButtonClass = "bg-red-600 hover:bg-red-700 focus:ring-red-500"; actionButtonTitle = "Stop Listening & Process"; }
  else if (isProcessing) { /* ... */ actionButtonIcon = <Loader2 className="h-5 w-5 animate-spin" />; actionButtonText = "Processing..."; actionButtonClass = "bg-gray-500 cursor-not-allowed"; actionButtonTitle = "Processing..."; }
  else if (lastProcessed) { /* ... */ actionButtonIcon = <RefreshCcw className="h-5 w-5" />; actionButtonText = "Record Again"; actionButtonClass = "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"; actionButtonTitle = "Start New Recording"; }
  else { /* ... */ actionButtonIcon = <Mic className="h-5 w-5" />; actionButtonText = "Start Recording"; actionButtonClass = "bg-primary hover:bg-primary/90 focus:ring-primary"; actionButtonTitle = "Start Listening"; }

   let mainContentDisplay: React.ReactNode; let statusText: string | null = null;
   if (listening) { statusText = "Listening..."; mainContentDisplay = ( <div className="bg-muted/30 rounded-md p-3 border border-input min-h-[80px] flex-grow flex items-center justify-center"> <p className="text-sm text-muted-foreground italic text-center"> {displayedTranscript || 'Speak clearly...'} </p> </div> ); }
   else if (isProcessing) { statusText = "Processing..."; mainContentDisplay = ( <div className="bg-muted/30 rounded-md p-3 border border-input min-h-[80px] flex-grow flex items-center justify-center"> <p className="text-sm text-muted-foreground italic text-center">{displayedTranscript}</p> </div> ); }
   else if (lastProcessed) { mainContentDisplay = ( <div className="bg-muted/50 rounded-lg p-3 border border-input min-h-[80px] flex-grow"> <div className={cn("flex items-center gap-2 text-sm mb-1 font-medium", lastProcessed.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400' )}> {lastProcessed.type === 'error' ? <AlertCircle className="h-4 w-4 flex-shrink-0" /> : <Check className="h-4 w-4 flex-shrink-0" />} <span> {lastProcessed.type === 'calendar' ? 'Calendar Event Action' : lastProcessed.type === 'task' ? 'Task Action' : lastProcessed.type === 'note' ? 'Note Action' : lastProcessed.type === 'error' ? 'Error Occurred' : 'Action Processed'} </span> </div> <p className="text-sm text-foreground pl-6">{lastProcessed.content.replace(/^Error: /, '')}</p> {lastProcessed.date && ( <p className="text-xs text-muted-foreground mt-1 pl-6"> Date: {format(lastProcessed.date, 'MMMM d, yyyy')} </p> )} </div> ); } // Note: Corrected yyyy here just in case
   else { statusText = "Tap mic to start"; mainContentDisplay = ( <div className="text-center text-xs text-muted-foreground bg-muted/20 rounded-lg p-3 border border-dashed border-input flex-grow flex flex-col justify-center min-h-[80px]"> <p className='italic mb-2 text-sm'>Tap the microphone below to start</p> <p className="font-medium mb-1">Examples:</p> <ul className="list-none space-y-0.5"> <li>"Add task email John tomorrow"</li> <li>"Schedule meeting for Friday 3pm"</li> <li>"Remind me to buy milk this evening"</li> </ul> </div> ); }

  // --- Return JSX (Structure remains the same) ---
  return (
     <div className={cn( "fixed bottom-4 left-1/2 transform -translate-x-1/2 w-[95vw] max-w-lg", "z-[9999]", "bg-card/95 backdrop-blur-xl rounded-xl shadow-2xl border border-border/50 text-card-foreground", "flex flex-col", "min-h-[320px]", "animate-fade-in" )}>
      <div className="flex items-center justify-between p-3 border-b border-border/50 flex-shrink-0"> <h3 className="text-base font-semibold text-foreground flex items-center gap-2"> <Mic className="h-4 w-4 text-primary"/> Voice Assistant </h3> <button onClick={onClose} className="p-1 text-muted-foreground hover:text-destructive rounded-full hover:bg-destructive/10 transition-colors" title="Close Assistant" aria-label="Close Assistant"> <X className="h-5 w-5"/> </button> </div>
      <div className="p-4 space-y-2 flex-grow flex flex-col overflow-hidden">
          <div className='h-5 flex items-center text-xs mb-2 flex-shrink-0'> {(listening || isProcessing || (!lastProcessed && !displayedTranscript)) && ( <span className={cn( "flex items-center gap-2", isProcessing ? 'text-primary' : 'text-muted-foreground', listening && 'animate-pulse')}> {listening && <span className="w-2 h-2 rounded-full bg-red-500" />} {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />} {statusText} </span> )} </div>
          <div className="flex-grow flex flex-col min-h-0"> {mainContentDisplay} </div>
          <div className="pt-3 mt-2 border-t border-border/50 flex justify-center flex-shrink-0"> <button onClick={handleActionButtonClick} disabled={isButtonDisabled} className={cn( `flex items-center justify-center gap-2.5 px-6 py-3 rounded-lg text-white transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-card w-full sm:w-auto text-sm font-medium shadow-md`, actionButtonClass, isButtonDisabled ? "opacity-60 cursor-not-allowed hover:scale-100" : "" )} title={actionButtonTitle} aria-label={actionButtonTitle} > {actionButtonIcon} <span>{actionButtonText}</span> </button> </div>
      </div>
    </div>
  );
}