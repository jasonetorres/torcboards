import { useState, useEffect, useCallback } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { Mic, Square, Loader2, Check, AlertCircle, X, RefreshCcw } from 'lucide-react';
import * as chrono from 'chrono-node';
import { supabase } from '../lib/supabase';
import { useSelector } from 'react-redux';
import { format, isValid } from 'date-fns';
import { RootState } from '../store';
import { cn } from '../lib/utils';

const capitalizeFirstLetter = (string: string): string => {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
};

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
  const { transcript, listening, resetTranscript } = useSpeechRecognition();
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayedTranscript, setDisplayedTranscript] = useState('');
  const [lastProcessed, setLastProcessed] = useState<ProcessedNote | null>(null);
  const [statusText, setStatusText] = useState('Ready to listen...');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const mainContentDisplay = lastProcessed ? (
    <div>Content</div>
  ) : displayedTranscript ? (
    <p className="text-foreground">{displayedTranscript}</p>
  ) : null;

  const isButtonDisabled = isProcessing;
  const actionButtonClass = "bg-primary";
  const actionButtonTitle = "Start Recording";
  const actionButtonText = "Start Recording";
  const actionButtonIcon = <Mic className="h-5 w-5" />;
  
  const handleActionButtonClick = () => {
    // Action button click handler logic
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className={cn(
      "fixed inset-x-2 sm:inset-x-auto sm:left-1/2 bottom-4 sm:transform sm:-translate-x-1/2",
      "w-auto sm:w-[95vw] sm:max-w-lg",
      "z-[9999]",
      "bg-card/95 backdrop-blur-xl rounded-xl shadow-2xl border border-border/50 text-card-foreground",
      "flex flex-col",
      "min-h-[280px] max-h-[90vh]",
      "animate-fade-in"
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
        <div className='h-5 flex items-center text-xs mb-2 flex-shrink-0'>
          {(listening || isProcessing || (!lastProcessed && !displayedTranscript)) && (
            <span className={cn(
              "flex items-center gap-2",
              isProcessing ? 'text-primary' : 'text-muted-foreground',
              listening && 'animate-pulse'
            )}>
              {listening && <span className="w-2 h-2 rounded-full bg-red-500" />}
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
              {statusText}
            </span>
          )}
        </div>

        <div className="flex-grow flex flex-col min-h-0 overflow-y-auto">
          {mainContentDisplay}
        </div>

        <div className="pt-3 mt-2 border-t border-border/50 flex justify-center flex-shrink-0">
          <button
            onClick={handleActionButtonClick}
            disabled={isButtonDisabled}
            className={cn(
              "flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-lg text-white transition-all",
              "hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-card",
              "w-full sm:w-auto text-sm font-medium shadow-md",
              actionButtonClass,
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