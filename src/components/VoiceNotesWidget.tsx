import { useState, useEffect, useCallback } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { Mic, Square, Loader2, Check, AlertCircle, X, RefreshCcw } from 'lucide-react';
import * as chrono from 'chrono-node';
import { supabase } from '../lib/supabase'; // Ensure this path is correct
import { useSelector } from 'react-redux';
import { format, isValid } from 'date-fns';
import { RootState } from '../store'; // Ensure this path is correct
import { cn } from '../lib/utils'; // Ensure this path is correct

const capitalizeFirstLetter = (string: string): string => {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
};

interface ProcessedNote {
  type: 'calendar' | 'task' | 'note' | 'error';
  content: string;
  details?: string;
  date?: Date;
  id?: string | number; // For referencing created items
}

interface VoiceNotesWidgetProps {
    onClose: () => void;
}

// Matches the expected structure for inserting into a 'tasks' table
interface TaskInsertData {
    user_id: string;
    title: string;
    description?: string | null;
    due_date?: string | null; // Format: 'yyyy-MM-dd'
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'completed' | 'overdue'; // Or your defined statuses
    source?: string;
    related_calendar_event_id?: string | null;
}

export function VoiceNotesWidget({ onClose }: VoiceNotesWidgetProps) {
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  const [isProcessing, setIsProcessing] = useState(false);
  const [processedNote, setProcessedNote] = useState<ProcessedNote | null>(null);
  const [statusText, setStatusText] = useState('Initializing...');
  const [error, setError] = useState<string | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState(''); // Displays live or final transcript

  const [mounted, setMounted] = useState(false);
  const user = useSelector((state: RootState) => state.auth.user);

  useEffect(() => {
    setMounted(true);
    if (!browserSupportsSpeechRecognition) {
        setStatusText("Speech recognition not supported.");
        setError("Your browser does not support speech recognition. Try using Chrome or Edge.");
    } else {
        setStatusText("Click the mic to start speaking.");
    }
    return () => {
      setMounted(false);
      // Stop listening if the component unmounts while active
      if (SpeechRecognition.browserSupportsSpeechRecognition()) {
          SpeechRecognition.stopListening();
      }
    };
  }, [browserSupportsSpeechRecognition]);

  useEffect(() => {
    if (listening) {
        setCurrentTranscript(transcript); // Update display with live transcript
        setError(null); // Clear previous errors when listening starts
        setProcessedNote(null); // Clear previous results
    }
  }, [transcript, listening]);


  const processVoiceCommand = async (text: string): Promise<ProcessedNote> => {
    if (!user?.id) {
        return { type: 'error', content: 'User not authenticated. Please log in.' };
    }

    const parsedDateInfo = chrono.parse(text);
    let identifiedDate: Date | undefined = undefined;
    let commandText = text;

    if (parsedDateInfo.length > 0) {
        identifiedDate = parsedDateInfo[0].start.date();
        // Naive removal of date phrase - consider a more robust NLP approach for complex cases
        const { index, text: dateText } = parsedDateInfo[0];
        commandText = (commandText.substring(0, index) + commandText.substring(index + dateText.length)).trim();
    }

    const lowerText = commandText.toLowerCase();

    // Task detection (example keywords)
    if (lowerText.startsWith('task ') || lowerText.includes('remind me to ') || lowerText.includes('add task ')) {
        let title = commandText;
        if (lowerText.startsWith('task ')) title = commandText.substring(5).trim();
        else if (lowerText.includes('remind me to ')) title = commandText.substring(lowerText.indexOf('remind me to ') + 12).trim();
        else if (lowerText.includes('add task ')) title = commandText.substring(lowerText.indexOf('add task ') + 8).trim();
        
        title = capitalizeFirstLetter(title);

        if (!title) {
            return { type: 'error', content: 'Task title seems empty. Please try again.' };
        }

        const taskData: TaskInsertData = {
            user_id: user.id,
            title: title,
            due_date: identifiedDate && isValid(identifiedDate) ? format(identifiedDate, 'yyyy-MM-dd') : null,
            priority: 'medium', // Default or infer from voice
            status: 'pending',   // Default
            source: 'voice assistant'
        };

        try {
            const { data, error: dbError } = await supabase.from('tasks').insert(taskData).select().single();
            if (dbError) {
                console.error('Supabase error creating task:', dbError);
                return { type: 'error', content: `Database error: ${dbError.message}` };
            }
            if (!data) {
                 return { type: 'error', content: 'Failed to create task, no data returned.' };
            }
            return { type: 'task', id: data.id, content: data.title, date: identifiedDate, details: data.description || undefined };
        } catch (e: any) {
            console.error('Error inserting task:', e);
            return { type: 'error', content: `Failed to save task: ${e.message}` };
        }
    } 
    // Add 'calendar' event processing here if desired
    // else if (lowerText.startsWith('schedule ') || ...) { ... }
    else {
        // Default to a general note (not saved to DB in this example)
        if (!commandText.trim()) {
            return { type: 'error', content: 'Note content is empty.'};
        }
        return { type: 'note', content: capitalizeFirstLetter(commandText), date: identifiedDate };
    }
  };

  const handleActionButtonClick = useCallback(async () => {
    if (!browserSupportsSpeechRecognition && !processedNote && !error) {
        setStatusText("Speech recognition not supported.");
        setError("Your browser does not support speech recognition.");
        return;
    }

    if (isProcessing) return; // Button should be disabled anyway

    // If currently showing a result or error, this click means "start a new note"
    if (processedNote || error) {
        setProcessedNote(null);
        setError(null);
        setCurrentTranscript('');
        resetTranscript();
        setStatusText('Click the mic to start speaking.');
        return;
    }

    if (!listening) {
        // Start listening
        setCurrentTranscript(''); // Clear any old transcript
        resetTranscript();      // Reset for a fresh start
        setProcessedNote(null); // Clear previous results
        setError(null);         // Clear previous errors
        SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
        setStatusText('Listening...');
    } else {
        // Stop listening and process
        SpeechRecognition.stopListening();
        // `transcript` from the hook should hold the final spoken text
        const transcriptToProcess = transcript.trim(); 

        if (!transcriptToProcess) {
            setStatusText('No speech detected. Try again.');
            setCurrentTranscript('');
            resetTranscript();
            return;
        }
        
        setCurrentTranscript(transcriptToProcess); // Show what's being processed
        setIsProcessing(true);
        setStatusText('Processing your note...');

        try {
            const result = await processVoiceCommand(transcriptToProcess);
            setProcessedNote(result);
            if (result.type !== 'error') {
                setStatusText(`${capitalizeFirstLetter(result.type)} processed successfully!`);
            } else {
                setStatusText(`Error: ${result.content}`);
                setError(result.content);
            }
        } catch (e: any) {
            console.error("Processing exception:", e);
            const errorMessage = e.message || 'Processing failed due to an unexpected error.';
            setError(errorMessage);
            setProcessedNote({ type: 'error', content: errorMessage });
            setStatusText('Error processing your note.');
        } finally {
            setIsProcessing(false);
            // Don't resetTranscript() here; it's done when starting new or if "New Note" is clicked.
        }
    }
  }, [
    browserSupportsSpeechRecognition, 
    isProcessing, 
    processedNote, 
    error, 
    listening, 
    resetTranscript, 
    transcript, // Crucial: transcript from the hook is a dependency
    user // For processVoiceCommand user.id
  ]);

  // Determine button appearance based on state
  let actionButtonIcon, actionButtonText, actionButtonTitle, currentActionButtonClass;
  const isButtonDisabled = isProcessing || (!browserSupportsSpeechRecognition && !listening && !processedNote && !error);

  if (isProcessing) {
    actionButtonIcon = <Loader2 className="h-5 w-5 animate-spin" />;
    actionButtonText = "Processing...";
    actionButtonTitle = "Processing your voice note";
    currentActionButtonClass = "bg-gray-500 hover:bg-gray-500";
  } else if (listening) {
    actionButtonIcon = <Square className="h-5 w-5" />;
    actionButtonText = "Stop Listening";
    actionButtonTitle = "Stop voice recording";
    currentActionButtonClass = "bg-red-600 hover:bg-red-700";
  } else if (processedNote || error) {
    actionButtonIcon = <RefreshCcw className="h-5 w-5" />;
    actionButtonText = "New Note";
    actionButtonTitle = "Start a new voice note";
    currentActionButtonClass = "bg-blue-600 hover:bg-blue-700"; // Changed color for clarity
  } else {
    actionButtonIcon = <Mic className="h-5 w-5" />;
    actionButtonText = "Start Listening";
    actionButtonTitle = "Start voice recording";
    currentActionButtonClass = "bg-primary hover:bg-primary/90";
  }

  const renderMainContent = () => {
    if (error && !isProcessing) { // Show error prominently if not actively processing something else
        return (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive-foreground">
                <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <span className="font-semibold">Error</span>
                </div>
                <p className="text-sm mt-1">{error}</p>
                {processedNote?.type === 'error' && processedNote.content && processedNote.content !== error && (
                     <p className="text-sm mt-1 opacity-80">{processedNote.content}</p>
                )}
            </div>
        );
    }
    if (processedNote && processedNote.type !== 'error') {
        return (
            <div className="p-3 bg-green-600/10 border border-green-600/30 rounded-md text-green-foreground">
                <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span className="font-semibold text-foreground">{capitalizeFirstLetter(processedNote.type)} Created:</span>
                </div>
                <p className="mt-1 text-foreground">{processedNote.content}</p>
                {processedNote.date && isValid(processedNote.date) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Date: {format(processedNote.date, 'PPP p')}
                    </p>
                )}
                {processedNote.details && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Details: {processedNote.details}
                    </p>
                )}
            </div>
        );
    }
    if (listening || currentTranscript) {
        return <p className="text-foreground px-1">{currentTranscript || "Speak now..."}</p>;
    }
    // Initial empty state or prompt
    if (!browserSupportsSpeechRecognition && mounted) {
         return <p className="text-destructive text-center py-4 px-1">Speech recognition is not supported in this browser.</p>;
    }
    return <p className="text-muted-foreground text-center py-4 px-1">Click the microphone to start recording.</p>;
  };
  
  if (!mounted) {
    return null; // Or a basic loading state if preferred
  }

  return (
    <div className={cn(
      "fixed inset-x-2 sm:inset-x-auto sm:left-1/2 bottom-4 sm:transform sm:-translate-x-1/2",
      "w-auto sm:w-[95vw] sm:max-w-lg",
      "z-[9999]",
      "bg-card/95 backdrop-blur-xl rounded-xl shadow-2xl border border-border/50 text-card-foreground",
      "flex flex-col",
      "min-h-[280px] max-h-[90vh]", // Ensures it doesn't take full screen on mobile
      "animate-fade-in" // Assuming you have this animation defined
    )}>
      <div className="flex items-center justify-between p-3 border-b border-border/50 flex-shrink-0">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Mic className="h-4 w-4 text-primary"/>
          Voice Assistant
        </h3>
        <button 
          onClick={onClose} 
          className="p-1 text-muted-foreground hover:text-destructive rounded-full hover:bg-destructive/10 transition-colors" 
          title="Close Assistant" 
          aria-label="Close Assistant"
        >
          <X className="h-5 w-5"/>
        </button>
      </div>

      <div className="p-3 space-y-2 flex-grow flex flex-col overflow-hidden">
        {/* Status Text Area */}
        <div className='h-5 flex items-center text-xs mb-2 flex-shrink-0'>
            <span className={cn(
              "flex items-center gap-1.5",
              isProcessing ? 'text-primary' : (error && !isProcessing) ? 'text-destructive' : 'text-muted-foreground',
            )}>
              {listening && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
              {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{statusText}</span>
            </span>
        </div>

        {/* Main Content Display Area */}
        <div className="flex-grow flex flex-col min-h-0 overflow-y-auto p-1 -m-1 custom-scrollbar"> 
          {/* custom-scrollbar for better scrollbar styling if needed */}
          {renderMainContent()}
        </div>

        {/* Action Button Area */}
        <div className="pt-3 mt-auto border-t border-border/50 flex justify-center flex-shrink-0">
          <button
            onClick={handleActionButtonClick}
            disabled={isButtonDisabled}
            className={cn(
              "flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-lg text-white transition-all",
              "hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-card",
              "w-full sm:w-auto text-sm font-medium shadow-md",
              currentActionButtonClass,
              isButtonDisabled ? "opacity-60 cursor-not-allowed hover:scale-100" : ""
            )}
            title={actionButtonTitle}
            aria-label={actionButtonTitle}
          >
            {actionButtonIcon}
            <span>{actionButtonText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}