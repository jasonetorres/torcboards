import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, RefreshCw, X, Check, Link as LinkIcon } from 'lucide-react';
import { generateSmartReminders, generateJobHuntingSchedule } from '../lib/openai';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import { EventContentArg, EventClickArg } from '@fullcalendar/core';
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
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

export default function AICalendarWidget({ applications, companies }: AICalendarWidgetProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState({ schedule: false, reminders: false, events: true });

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
    if (!authData.user) return;
    try {
        const { error } = await supabase
          .from('calendar_events')
          .update({ completed: !currentStatus, updated_at: new Date().toISOString() })
          .eq('id', eventId)
          .eq('user_id', authData.user.id);
        if (error) throw error;
        await fetchCalendarEvents();
    } catch(error) { console.error("Error updating event status:", error); alert(`Failed to update event status: ${(error as Error).message}`); }
  };

  const handleDateClick = (arg: DateClickArg) => {
    setSelectedDate(arg.date);
    console.log("Date clicked:", arg.dateStr);
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    console.log('Event Clicked:', clickInfo.event.title, clickInfo.event.extendedProps);
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

  const renderEventContent = (eventInfo: EventContentArg) => {
    const { event } = eventInfo;
    const { description, eventType, completed, originalId, related_application_id, related_task_id } = event.extendedProps;

    return (
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild className="fc-event-trigger w-full h-full block cursor-pointer">
          <div className="fc-event-title-container truncate w-full h-full flex items-center p-0.5">
             <span className={cn("fc-event-dot mr-1 flex-shrink-0", completed ? "bg-green-500" : "bg-primary" )}></span>
            <span className="fc-event-main-title flex-grow truncate text-xs">{event.title}</span>
          </div>
        </HoverCardTrigger>
        <HoverCardContent
            className={cn(
                "max-w-xs text-sm rounded-lg shadow-xl border",
                "bg-popover text-popover-foreground",
                "z-[9999]"
            )}
            side="top" align="center" sideOffset={6}
        >
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
        </HoverCardContent>
      </HoverCard>
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
            disabled={loading.reminders || loading.schedule}
            size="sm"
            title={`Generate AI tasks for ${format(selectedDate, 'MMM d')}`}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading.reminders ? 'animate-spin' : ''}`} />
            Gen Tasks ({format(selectedDate, 'MMM d')})
          </Button>
          <Button
            onClick={handleGenerateSchedule}
            disabled={loading.schedule || loading.reminders}
            size="sm"
            title="Generate suggested calendar events for the week"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading.schedule ? 'animate-spin' : ''}`} />
            Suggest Week
          </Button>
        </div>
      </div>

      <div>
        {loading.events && (
          <div className="flex items-center justify-center h-64 bg-card/50 rounded-lg border">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {!loading.events && (
          <div className="calendar-container relative z-0 p-1 bg-card rounded-lg border shadow-sm text-sm">
            <FullCalendar
              key={events.length}
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              events={formattedEvents}
              eventContent={renderEventContent}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
              height="auto"
              dayMaxEvents={2}
              moreLinkClassNames={"text-xs text-primary hover:underline p-0.5"}
              displayEventTime={false}
              weekends={true}
              viewClassNames={"text-xs"}
              dayHeaderClassNames={"text-xs"}
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
    </div>
  );
}