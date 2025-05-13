import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, RefreshCw, X, Check, Link as LinkIcon } from 'lucide-react';
import { generateSmartReminders, generateJobHuntingSchedule } from '../lib/openai';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import { EventContentArg, EventClickArg, MoreLinkArg, EventApi } from '@fullcalendar/core';
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card"; // Re-enabled HoverCard import
import { Button } from "./ui/button";
import { cn } from '../lib/utils';

import './AICalendarWidget.css';

interface AICalendarWidgetProps {
  applications: any[];
  companies: any[];
}

interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  event_date: string;
  event_type: string;
  completed: boolean;
  user_id?: string;
  related_application_id?: string | null;
  related_task_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

// --- Custom Modal Component for "+more" link ---
interface YourCustomMoreEventsModalProps {
  date: Date;
  events: EventApi[];
  onClose: () => void;
  onToggleComplete: (eventId: string, currentStatus: boolean) => void;
}

function YourCustomMoreEventsModal({ date, events, onClose, onToggleComplete }: YourCustomMoreEventsModalProps) {
  return (
    <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))', 
        padding: '20px', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        zIndex: 10000,
        width: '90vw', maxWidth: '500px', 
        maxHeight: '70vh', display: 'flex', flexDirection: 'column'
    }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Events for {format(date, 'MMMM d, yyyy')}</h3>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close modal">
                <X className="h-4 w-4" />
            </Button>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, overflowY: 'auto', flexGrow: 1 }}>
            {events.length > 0 ? events.map((event: EventApi) => (
                <li key={event.id} style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid hsl(var(--border))' }}>
                    <strong style={{ display: 'block', color: event.extendedProps.completed ? 'hsl(var(--success))' : 'hsl(var(--primary))' }}>
                        {event.title}
                    </strong>
                    {event.extendedProps.description && (
                        <p style={{ fontSize: '0.85rem', margin: '5px 0 0 0', color: 'hsl(var(--muted-foreground))' }}>
                            {event.extendedProps.description}
                        </p>
                    )}
                     {event.extendedProps.related_application_id && (
                       <Link
                         to={`/applications#${event.extendedProps.related_application_id}`}
                         className="text-xs text-primary/90 hover:text-primary hover:underline flex items-center gap-1 w-fit mt-1"
                       >
                         <LinkIcon className="h-3 w-3" /> View Application
                       </Link>
                     )}
                     {event.extendedProps.related_task_id && (
                       <Link
                         to={`/tasks#${event.extendedProps.related_task_id}`}
                         className="text-xs text-primary/90 hover:text-primary hover:underline flex items-center gap-1 w-fit mt-1"
                       >
                         <LinkIcon className="h-3 w-3" /> View Task
                       </Link>
                     )}
                    <Button
                       variant="outline"
                       size="sm" // Changed from 'xs' as it might not be standard in Shadcn/ui Button
                       className="w-full mt-2 h-8 text-xs" // Kept h-7 and text-xs for smaller button
                       onClick={() => onToggleComplete(event.id, event.extendedProps.completed)}
                     >
                       {event.extendedProps.completed ? (
                         <X className="mr-1.5 h-3 w-3 text-muted-foreground" />
                       ) : (
                         <Check className="mr-1.5 h-3 w-3 text-green-600" />
                       )}
                       Mark as {event.extendedProps.completed ? 'Pending' : 'Complete'}
                     </Button>
                </li>
            )) : <p>No more events for this day.</p>}
        </ul>
        <Button onClick={onClose} variant="outline" size="sm" style={{ marginTop: '20px', alignSelf: 'flex-end' }}>
            Close
        </Button>
    </div>
  );
}
// --- End of Custom Modal Component ---


export default function AICalendarWidget({ applications, companies }: AICalendarWidgetProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState({ schedule: false, reminders: false, events: true });

  // State for custom "+more" modal
  const [customMoreModalOpen, setCustomMoreModalOpen] = useState(false);
  const [customMoreModalDate, setCustomMoreModalDate] = useState<Date | null>(null);
  const [customMoreModalEvents, setCustomMoreModalEvents] = useState<EventApi[]>([]);

  // States for HoverCard/Mobile display logic
  const [mounted, setMounted] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null); // For mobile click-to-expand
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Delay mounting for components that might need measurements after initial render (like HoverCard)
    const timer = setTimeout(() => {
      setMounted(true);
    }, 250); // Adjust delay as needed
    
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    };
    
    checkMobile(); // Initial check
    window.addEventListener('resize', checkMobile);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const fetchCalendarEvents = useCallback(async () => {
    setLoading(prev => ({ ...prev, events: true }));
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      console.error("User not logged in for fetching calendar events.");
      setLoading(prev => ({ ...prev, events: false }));
      setEvents([]);
      return;
    }
    try {
        const { data: calendarEvents, error } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('user_id', authData.user.id)
          .order('event_date', { ascending: true });
        if (error) throw error;
        setEvents(calendarEvents as CalendarEvent[] || []);
    } catch (error) {
        console.error("Error fetching calendar events:", error);
        setEvents([]);
    } finally {
        setLoading(prev => ({ ...prev, events: false }));
    }
  }, []);

  useEffect(() => {
    fetchCalendarEvents();
  }, [fetchCalendarEvents]);

  const handleGenerateSchedule = async () => {
    setLoading(prev => ({ ...prev, schedule: true }));
    try {
      if (generateJobHuntingSchedule) {
          await generateJobHuntingSchedule(applications, companies);
          await fetchCalendarEvents();
      } else { alert("AI Schedule generation feature not available."); }
    } catch (error) { console.error('Error generating schedule:', error); alert(`Failed to generate schedule: ${(error as Error).message}`);
    } finally { setLoading(prev => ({ ...prev, schedule: false })); }
  };

  const handleGenerateRemindersForDate = async (dateToGenerate: Date) => {
      setLoading(prev => ({...prev, reminders: true }));
      try {
         if (generateSmartReminders) {
             await generateSmartReminders(dateToGenerate, applications, companies);
             await fetchCalendarEvents();
             setSelectedDate(dateToGenerate);
         } else { alert("AI Reminder generation feature not available."); }
      } catch (error) { console.error("Error generating reminders:", error); alert(`Failed to generate reminders: ${(error as Error).message}`);
      } finally { setLoading(prev => ({...prev, reminders: false })); }
  };

  const toggleEventComplete = async (eventId: string, currentStatus: boolean) => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
        alert("You must be logged in to update an event.");
        return;
    }
    try {
        const { error } = await supabase
          .from('calendar_events')
          .update({ completed: !currentStatus, updated_at: new Date().toISOString() })
          .eq('id', eventId)
          .eq('user_id', authData.user.id);
        if (error) throw error;
        await fetchCalendarEvents(); // Refetch all events to update main calendar
        
        // If the custom modal is open, update its events list too
        if (customMoreModalOpen) {
          setCustomMoreModalEvents(prevEvents =>
            prevEvents.map(ev =>
              ev.id === eventId ? { ...ev, extendedProps: { ...ev.extendedProps, completed: !currentStatus } } as EventApi : ev
            )
          );
        }
        // If the mobile accordion-style detail is open for this event, it will also need an update or to be closed
        if (isMobile && selectedEventId === eventId) {
            // This is tricky because selectedEventId doesn't hold the event object itself.
            // For simplicity, we can close it. A more robust solution would update the specific event if displayed.
            // Or, since fetchCalendarEvents() is called, the main 'events' list will update,
            // and if 'selectedEventId' leads to re-rendering details from that list, it should reflect.
            // However, selectedEventId just toggles visibility of already rendered details.
            // For now, let's rely on the full list re-render.
        }


    } catch(error) { console.error("Error updating event status:", error); alert(`Failed to update event status: ${(error as Error).message}`); }
  };

  const handleDateClick = (arg: DateClickArg) => {
    setSelectedDate(arg.date);
    console.log("Date clicked:", arg.dateStr);
  };

  // Updated handleEventClick for mobile interaction
  const handleEventClick = (clickInfo: EventClickArg) => {
    console.log('Event Clicked:', clickInfo.event.title);
    if (isMobile) {
      // Toggle visibility of details for the clicked event on mobile
      const clickedEventOriginalId = clickInfo.event.extendedProps.originalId as string;
      setSelectedEventId(prevSelectedId => 
        prevSelectedId === clickedEventOriginalId ? null : clickedEventOriginalId
      );
    }
    // Prevent default browser action if the event element is, e.g., an anchor
    clickInfo.jsEvent.preventDefault();
  };

  const formattedEvents = events.map(event => ({
    id: event.id,
    title: event.title,
    start: event.event_date,
    allDay: true,
    extendedProps: {
      description: event.description,
      eventType: event.event_type,
      completed: event.completed,
      originalId: event.id,
      related_application_id: event.related_application_id,
      related_task_id: event.related_task_id
    },
    className: event.completed ? 'fc-event-completed' : 'fc-event-pending',
  }));

  // renderEventContent with HoverCard and mobile-specific logic restored
  const renderEventContent = (eventInfo: EventContentArg) => {
    const { event } = eventInfo;
    const { description, eventType, completed, originalId, related_application_id, related_task_id } = event.extendedProps;
    const isSelectedOnMobile = selectedEventId === originalId;

    // Common visual part of the event (dot and title)
    const eventDisplayContent = (
      <div className="fc-event-title-container truncate w-full h-full flex items-center p-0.5">
        <span className={cn("fc-event-dot mr-1 flex-shrink-0", completed ? "bg-green-500" : "bg-primary" )}></span>
        <span className="fc-event-main-title flex-grow truncate text-xs">{event.title}</span>
      </div>
    );

    // Common detailed content for popover/mobile expansion
    const eventDetailsPopoverContent = (
      <div className="space-y-2 p-3">
         <h4 className="font-semibold break-words leading-tight">{event.title}</h4>
         {description && (
            <p className="text-muted-foreground text-xs break-words">
                {description}
            </p>
         )}
         <p className="flex items-center justify-between text-xs border-t border-border pt-1.5 mt-1.5">
           <span className="text-muted-foreground">Status:</span>
           <span className={cn("font-medium", completed ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400')}>
             {completed ? 'Completed' : 'Pending'}
           </span>
         </p>
         {eventType && (
           <p className='text-xs text-muted-foreground'>
             Type: <span className='font-medium capitalize text-foreground ml-1'>{eventType.replace(/_/g, ' ')}</span>
           </p>
         )}
         {(related_application_id || related_task_id) && (
           <div className='pt-1.5 mt-1.5 border-t border-border space-y-1'>
             {related_application_id && (
               <Link
                 to={`/applications#${related_application_id}`}
                 className="text-xs text-primary/90 hover:text-primary hover:underline flex items-center gap-1 w-fit"
                 onClick={(e) => e.stopPropagation()}
               >
                 <LinkIcon className="h-3 w-3" /> View Application
               </Link>
             )}
             {related_task_id && (
               <Link
                 to={`/tasks#${related_task_id}`}
                 className="text-xs text-primary/90 hover:text-primary hover:underline flex items-center gap-1 w-fit"
                 onClick={(e) => e.stopPropagation()}
               >
                 <LinkIcon className="h-3 w-3" /> View Task
               </Link>
             )}
           </div>
         )}
         <Button
           variant="outline"
           size="sm"
           className="w-full mt-2 h-8 text-xs"
           onClick={(e) => {
             e.stopPropagation();
             toggleEventComplete(originalId, completed);
           }}
         >
           {completed ? (
             <X className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
           ) : (
             <Check className="mr-1.5 h-3.5 w-3.5 text-green-600" />
           )}
           Mark as {completed ? 'Pending' : 'Complete'}
         </Button>
      </div>
    );

    if (isMobile) {
      return (
        <div className="relative"> {/* Added relative for absolute positioning of details */}
          {/* The event itself is clickable to toggle details */}
          <div onClick={() => handleEventClick({ event: eventInfo.event, el: eventInfo.el, jsEvent: new MouseEvent('click'), view: eventInfo.view } as EventClickArg)} className="cursor-pointer">
            {eventDisplayContent}
          </div>
          {isSelectedOnMobile && (
            // Mobile expanded details shown below the event
            <div className="mobile-event-details bg-popover border border-border rounded-lg shadow-lg mt-1 p-2 z-10"> {/* Ensure z-index if needed */}
              {eventDetailsPopoverContent}
            </div>
          )}
        </div>
      );
    }

    // Desktop: Use HoverCard, only if 'mounted' is true
    return mounted ? (
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          {/* The trigger should be what the user hovers over */}
          <div className="fc-event-trigger-desktop w-full h-full block cursor-pointer">
            {eventDisplayContent}
          </div>
        </HoverCardTrigger>
        <HoverCardContent
            className={cn(
                "max-w-xs text-sm rounded-lg shadow-xl border",
                "bg-popover text-popover-foreground",
                "z-[50]" // Ensure this z-index is sufficient; FullCalendar's "+more" popover might also have a high z-index.
                         // Your custom "+more" modal uses zIndex: 10000. This HoverCard should be below that if they overlap.
            )}
            side="top"
            align="center"
            sideOffset={6}
        >
          {eventDetailsPopoverContent}
        </HoverCardContent>
      </HoverCard>
    ) : (
      // Render basic content if not yet "mounted" (helps avoid initial measurement issues)
      eventDisplayContent
    );
  };
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold flex items-center gap-2 text-foreground">
          <CalendarIcon className="h-5 w-5" /> Your Calendar
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => handleGenerateRemindersForDate(selectedDate)}
            disabled={loading.reminders || loading.schedule || loading.events}
            size="sm"
            title={`Generate AI tasks for ${format(selectedDate, 'MMM d, yyyy')}`}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading.reminders ? 'animate-spin' : ''}`} />
            Gen Tasks ({format(selectedDate, 'MMM d')})
          </Button>
          <Button
            onClick={handleGenerateSchedule}
            disabled={loading.schedule || loading.reminders || loading.events}
            size="sm"
            title="Generate suggested calendar events for the week"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading.schedule ? 'animate-spin' : ''}`} />
            Suggest Week
          </Button>
        </div>
      </div>

      <div className="calendar-widget-container">
        {loading.events && (
          <div className="flex items-center justify-center h-64 bg-card/50 rounded-lg border">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {!loading.events && events.length === 0 && (
            <div className="flex items-center justify-center h-64 bg-card/50 rounded-lg border text-muted-foreground">
                No events yet. Try suggesting a week or adding tasks with due dates!
            </div>
        )}
        {!loading.events && events.length > 0 && (
          <div className="calendar-container relative p-1 bg-card rounded-lg border shadow-sm text-sm"> {/* Removed z-0 that might have conflicted */}
            <FullCalendar
              key={events.map(e=>e.id + (e.completed !== undefined ? e.completed.toString() : 'false')).join(',')}
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              events={formattedEvents}
              eventContent={renderEventContent} // This now uses the restored HoverCard logic
              dateClick={handleDateClick}
              eventClick={handleEventClick} // handleEventClick now manages mobile detail expansion
              headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek' }}
              buttonText={{ today: 'Today', month: 'Month', week: 'Week' }}
              height="auto" 
              dayMaxEvents={2} 
              moreLinkClassNames={"text-xs text-primary hover:underline p-0.5"}
              displayEventTime={false} 
              weekends={true}
              viewClassNames={"text-xs"} 
              dayHeaderClassNames={"text-xs font-medium text-muted-foreground"}
              
              moreLinkClick={(arg: MoreLinkArg) => {
                console.log("More link clicked. Date:", arg.date, "Hidden event segments:", arg.hiddenSegs);
                setCustomMoreModalDate(arg.date);
                setCustomMoreModalEvents(arg.hiddenSegs.map(seg => seg.event)); 
                setCustomMoreModalOpen(true);
              }}
            />
          </div>
        )}
        <div className="mt-2 flex gap-4 text-xs px-1 text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="fc-event-dot bg-primary"></span>
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="fc-event-dot bg-green-500"></span>
            <span>Completed</span>
          </div>
        </div>
      </div>

      {customMoreModalOpen && customMoreModalDate && (
        <YourCustomMoreEventsModal
          date={customMoreModalDate}
          events={customMoreModalEvents}
          onClose={() => setCustomMoreModalOpen(false)}
          onToggleComplete={toggleEventComplete}
        />
      )}
    </div>
  );
}