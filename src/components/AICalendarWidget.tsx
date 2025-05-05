import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, RefreshCw, X, Check, LinkIcon } from 'lucide-react'; // Added LinkIcon back
import { generateSmartReminders, generateJobHuntingSchedule } from '../lib/openai';
import { supabase } from '../lib/supabase';
// import ReactMarkdown from 'react-markdown'; // Removed as schedule state is removed

import { Link } from 'react-router-dom'; // Import Link

// --- FullCalendar Imports ---
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import { EventContentArg, EventClickArg } from '@fullcalendar/core'; // Added EventClickArg

// --- UI Component Imports ---
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card"; // Use correct path alias if configured
import { Button } from "./ui/button"; // Use correct path alias if configured

// --- Base FullCalendar Styles ---


// --- Custom Styles ---
import './AICalendarWidget.css';

// --- Types ---
interface AICalendarWidgetProps {
  applications: any[];
  companies: any[];
}

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  event_type: string;
  completed: boolean;
  user_id?: string;
  related_application_id?: string | null;
  related_task_id?: string | null;
}

// --- Component ---
export default function AICalendarWidget({ applications, companies }: AICalendarWidgetProps) {
  // State
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  // const [schedule, setSchedule] = useState<string>(''); // Removed schedule state
  const [loading, setLoading] = useState({ schedule: false, reminders: false, events: true });
  const [showTaskCard, setShowTaskCard] = useState(false);

  // --- Data Fetching ---
  const fetchCalendarEvents = useCallback(async () => {
    setLoading(prev => ({ ...prev, events: true }));
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      console.error("User not logged in");
      setLoading(prev => ({ ...prev, events: false }));
      return;
    }

    const { data: calendarEvents, error } = await supabase
      .from('calendar_events')
      .select('*') // Fetches all columns including related IDs
      .eq('user_id', authData.user.id)
      .order('event_date', { ascending: true });

    if (error) {
      console.error("Error fetching calendar events:", error);
    } else if (calendarEvents) {
      setEvents(calendarEvents as CalendarEvent[]);
    }
    setLoading(prev => ({ ...prev, events: false }));
  }, []);

  useEffect(() => {
    fetchCalendarEvents();
  }, [fetchCalendarEvents]);

  // --- AI Generation ---
  const handleGenerateSchedule = async () => {
    setLoading(prev => ({ ...prev, schedule: true }));
    setShowTaskCard(false);
    try {
      await generateJobHuntingSchedule(applications, companies);
      await fetchCalendarEvents(); // Refresh calendar
    } catch (error) {
      console.error('Error generating schedule:', error);
    }
    setLoading(prev => ({ ...prev, schedule: false }));
  };

  const handleGenerateRemindersForDate = async (dateToGenerate: Date) => {
      setLoading(prev => ({...prev, reminders: true }));
      setShowTaskCard(false);
      try {
          await generateSmartReminders(dateToGenerate, applications, companies);
          await fetchCalendarEvents();
          // Re-select the date to show the new tasks in the side card
          setSelectedDate(dateToGenerate);
          setShowTaskCard(true);
      } catch (error) {
          console.error("Error generating reminders:", error);
      }
       setLoading(prev => ({...prev, reminders: false }));
  }


  // --- Event Interaction ---
  const toggleEventComplete = async (eventId: string, currentStatus: boolean) => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;
    const { error } = await supabase
      .from('calendar_events')
      .update({ completed: !currentStatus })
      .eq('id', eventId)
      .eq('user_id', authData.user.id);
    if (error) {
      console.error("Error updating event status:", error);
    } else {
      await fetchCalendarEvents();
    }
  };

  const handleDateClick = (arg: DateClickArg) => {
    const clickedDate = new Date(arg.dateStr + 'T00:00:00');
    setSelectedDate(clickedDate);
    setShowTaskCard(true);
    // setSchedule(''); // No longer needed
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    console.log('Event Clicked:', clickInfo.event);
    const { title, startStr } = clickInfo.event;
    const { description, eventType, completed, originalId, related_application_id, related_task_id } = clickInfo.event.extendedProps;

    console.log(`Details for ${title}:`, { description, eventType, completed, related_application_id, related_task_id });

    // Ensure side panel shows details for the clicked event's date
    setSelectedDate(new Date(startStr + 'T00:00:00'));
    setShowTaskCard(true);
  };


  // --- Formatting for FullCalendar ---
  const formattedEvents = events.map(event => ({
    id: event.id, // Use database ID for event ID
    title: event.title,
    start: event.event_date,
    allDay: true,
    extendedProps: {
      description: event.description,
      eventType: event.event_type,
      completed: event.completed,
      originalId: event.id, // Keep original DB id if needed separate from FC id
      related_application_id: event.related_application_id,
      related_task_id: event.related_task_id
    },
    className: event.completed ? 'fc-event-completed' : 'fc-event-pending',
  }));

  // --- Custom Event Rendering with Hover Card ---
  const renderEventContent = (eventInfo: EventContentArg) => {
    const { event } = eventInfo;
    // Destructure directly from extendedProps for clarity
    const { description, eventType, completed, originalId, related_application_id, related_task_id } = event.extendedProps;

    return (
      <HoverCard openDelay={150}>
        <HoverCardTrigger asChild className="fc-event-trigger">
          {/* --- THIS IS THE FIX --- */}
          {/* Add onClick with stopPropagation to the direct child of the Trigger */}
          <div
            className="fc-event-title-container truncate"
            onClick={(e) => {
              // Prevent click on the event content from causing issues with passive listeners
              e.stopPropagation();
            }}
          >
          {/* --- END FIX --- */}
            <span className="fc-event-dot"></span> {/* Styled by CSS */}
            <span className="fc-event-main-title">{event.title}</span>
          </div>
        </HoverCardTrigger>
        <HoverCardContent className="w-64 text-sm z-50" side="top" align="center">
          <div className="space-y-2">
            <h4 className="font-semibold">{event.title}</h4>
            {description && <p className="text-muted-foreground">{description}</p>}
             <p className="flex items-center justify-between">
                <span>Status:</span>
                <span className={`font-medium ${completed ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                 {completed ? 'Completed' : 'Pending'}
                </span>
             </p>
            {eventType && <p>Type: <span className='font-medium capitalize'>{eventType.replace(/_/g, ' ')}</span></p>}
             {/* Links for related items - Added stopPropagation here too just in case */}
             {related_application_id && (
                 <Link to={`/applications#${related_application_id}`} className="text-xs text-primary/80 hover:underline flex items-center gap-1 w-fit pt-1" onClick={(e) => e.stopPropagation()}>
                     <LinkIcon className="h-3 w-3" /> View Application
                 </Link>
             )}
             {related_task_id && (
                 <Link to={`/tasks#${related_task_id}`} className="text-xs text-primary/80 hover:underline flex items-center gap-1 w-fit pt-1" onClick={(e) => e.stopPropagation()}>
                    <LinkIcon className="h-3 w-3" /> View Task
                 </Link>
             )}
             <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={(e) => {
                    e.stopPropagation();
                    // Pass originalId which should be the database ID
                    toggleEventComplete(originalId, completed);
                }}
             >
                 {completed ? ( <X className="mr-2 h-4 w-4 text-muted-foreground" /> ) : ( <Check className="mr-2 h-4 w-4 text-green-600" /> )}
                Mark as {completed ? 'Pending' : 'Complete'}
             </Button>
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  };

  // Helper to get events for the side task card
  const getEventsForSelectedDate = () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return events.filter(event => event.event_date === dateStr);
  };

  // --- JSX ---
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
         <h2 className="text-xl font-semibold flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            AI Calendar Assistant
         </h2>
         <div className="flex gap-2 flex-wrap">
            {/* AI Buttons */}
            <Button
               variant="outline"
               onClick={() => handleGenerateRemindersForDate(selectedDate)}
               disabled={loading.reminders || loading.schedule} // Disable if any AI action is loading
               size="sm"
               title={`Generate AI tasks for ${format(selectedDate, 'MMM d')}`}
            >
               <RefreshCw className={`h-4 w-4 mr-2 ${loading.reminders ? 'animate-spin' : ''}`} />
               Generate Tasks for {format(selectedDate, 'MMM d')}
            </Button>
            <Button
               onClick={handleGenerateSchedule}
               disabled={loading.schedule || loading.reminders} // Disable if any AI action is loading
               size="sm"
               title="Generate suggested calendar events for the week"
            >
               <RefreshCw className={`h-4 w-4 mr-2 ${loading.schedule ? 'animate-spin' : ''}`} />
               Suggest Weekly Events
            </Button>
         </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          {loading.events && (
            <div className="flex items-center justify-center h-64 bg-card rounded-lg border">
               <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {!loading.events && (
              <div className="calendar-container p-1 bg-card rounded-lg border shadow-sm">
                <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    events={formattedEvents}
                    eventContent={renderEventContent} // Use custom render with hover card + fix
                    dateClick={handleDateClick}
                    eventClick={handleEventClick} // Added handler for clicks on events
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth'
                    }}
                    height="auto"
                    dayMaxEvents={true} // Show "+n more" if too many events
                />
              </div>
          )}
           {/* Legend */}
           <div className="mt-4 flex gap-4 text-sm px-1">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--primary))' }}></div>
                    <span>Pending Task</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--success))' }}></div>
                    <span>Completed Task</span>
                </div>
            </div>
        </div>

        {/* Side Card (Tasks for Selected Date ONLY now) */}
        <div className="lg:col-span-1">
          {/* Only show card when a date is clicked/selected */}
          {showTaskCard && (
            <div className="bg-card rounded-lg shadow-md p-4 md:p-6 border border-border sticky top-4">
              <>
                 <div className="flex justify-between items-center mb-4">
                   <h3 className="text-lg font-semibold">
                     Tasks: {format(selectedDate, 'MMMM d, yyyy')}
                   </h3>
                   <Button variant="ghost" size="icon" onClick={() => setShowTaskCard(false)} title="Close task list">
                     <X className="h-5 w-5" />
                   </Button>
                 </div>

                 {(loading.reminders || loading.schedule) && getEventsForSelectedDate().length === 0 && ( // Show loading only if generating for this date maybe?
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                      <span className="ml-2 text-muted-foreground">Generating...</span>
                    </div>
                  )}

                 {!(loading.reminders || loading.schedule) && ( // Don't show list if actively generating
                   <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                     {getEventsForSelectedDate().length === 0 && (
                        <p className="text-muted-foreground text-sm text-center py-4">No tasks found for this day.</p>
                     )}
                     {getEventsForSelectedDate().map((event) => (
                       <div key={event.id} className={`p-3 rounded-lg border transition-colors duration-150 ${event.completed ? 'bg-muted/30 border-green-500/30' : 'bg-muted/50 border-border'}`}>
                         <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-1">
                                <h4 className={`font-medium text-sm ${event.completed ? 'line-through text-muted-foreground' : ''}`}>
                                   {event.title}
                                </h4>
                               {event.description && ( <p className={`text-xs ${event.completed ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>{event.description}</p> )}
                               {/* Links - Ensure Link is imported from react-router-dom */}
                               {event.related_application_id && (
                                   <Link to={`/applications#${event.related_application_id}`} className="text-xs text-primary/80 hover:underline flex items-center gap-1 w-fit pt-1">
                                       <LinkIcon className="h-3 w-3" /> View Application
                                   </Link>
                               )}
                                {event.related_task_id && (
                                   <Link to={`/tasks#${event.related_task_id}`} className="text-xs text-primary/80 hover:underline flex items-center gap-1 w-fit pt-1">
                                      <LinkIcon className="h-3 w-3" /> View Task
                                   </Link>
                               )}
                            </div>
                            <button onClick={() => toggleEventComplete(event.id, event.completed)} title={event.completed ? 'Mark as Pending' : 'Mark as Complete'} className={`flex items-center justify-center shrink-0 h-5 w-5 rounded border mt-0.5 transition-colors ${event.completed ? 'bg-green-600 border-green-700 text-white' : 'bg-background border-muted-foreground/50 text-muted-foreground hover:border-primary'}`}>
                               {event.completed && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                            </button>
                         </div>
                       </div>
                     ))}
                   </div>
                  )}
                </>
            </div>
          )}
          {/* Removed the block that showed the schedule markdown */}
        </div> {/* End Side Card */}
      </div> {/* End Main Content Grid */}
    </div> // End Component Root
  );
}