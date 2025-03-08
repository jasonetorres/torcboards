import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, RefreshCw, X, Check } from 'lucide-react';
import { generateSmartReminders, generateJobHuntingSchedule } from '../lib/openai';
import { supabase } from '../lib/supabase';
import ReactMarkdown from 'react-markdown';
import 'react-calendar/dist/Calendar.css';
import './AICalendarWidget.css';

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
}

export function AICalendarWidget({ applications, companies }: AICalendarWidgetProps) {
  const [date, setDate] = useState(new Date());
  const [reminders, setReminders] = useState<string>('');
  const [schedule, setSchedule] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showTaskCard, setShowTaskCard] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    fetchCalendarEvents();
  }, [date]);

  const fetchCalendarEvents = async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    const { data: calendarEvents } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.user.id)
      .order('event_date', { ascending: true });

    if (calendarEvents) {
      setEvents(calendarEvents);
    }
  };

  const handleDateChange = async (newDate: Date) => {
    setDate(newDate);
    setLoading(true);
    setShowTaskCard(true);
    try {
      const remindersContent = await generateSmartReminders(newDate, applications);
      setReminders(remindersContent || '');
      await fetchCalendarEvents();
    } catch (error) {
      console.error('Error generating reminders:', error);
    }
    setLoading(false);
  };

  const generateSchedule = async () => {
    setLoading(true);
    try {
      const scheduleContent = await generateJobHuntingSchedule(applications, companies);
      setSchedule(scheduleContent || '');
      setShowTaskCard(false);
      await fetchCalendarEvents();
    } catch (error) {
      console.error('Error generating schedule:', error);
    }
    setLoading(false);
  };

  const toggleEventComplete = async (eventId: string, completed: boolean) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    await supabase
      .from('calendar_events')
      .update({ completed })
      .eq('id', eventId)
      .eq('user_id', user.user.id);
    
    await fetchCalendarEvents();
  };

  const tileContent = ({ date: tileDate }: { date: Date }) => {
    const dateStr = format(tileDate, 'yyyy-MM-dd');
    const dayEvents = events.filter(event => event.event_date === dateStr);
    
    if (dayEvents.length === 0) return null;

    return (
      <div className="event-dots">
        {dayEvents.map((event, i) => (
          <div
            key={i}
            className={`event-dot ${event.completed ? 'completed' : ''}`}
            title={event.title}
          />
        ))}
      </div>
    );
  };

  const tileClassName = ({ date: tileDate }: { date: Date }) => {
    const dateStr = format(tileDate, 'yyyy-MM-dd');
    const hasEvents = events.some(event => event.event_date === dateStr);
    return hasEvents ? 'has-events' : '';
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return events.filter(event => event.event_date === dateStr);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          AI Calendar Assistant
        </h2>
        <button
          onClick={generateSchedule}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Generate Schedule
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <Calendar
            onChange={handleDateChange}
            value={date}
            tileContent={tileContent}
            tileClassName={tileClassName}
            className="w-full border rounded-lg shadow-sm bg-card p-4"
          />
          
          <div className="mt-4 flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Completed</span>
            </div>
          </div>
        </div>

        <div className="relative">
          {showTaskCard && (
            <div className="bg-card rounded-lg shadow-md p-6 border border-border">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  Tasks for {format(date, 'MMMM d, yyyy')}
                </h3>
                <button
                  onClick={() => setShowTaskCard(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {getEventsForDate(date).map((event) => (
                    <div
                      key={event.id}
                      className={`p-4 rounded-lg ${
                        event.completed ? 'bg-green-100 dark:bg-green-900/20' : 'bg-muted'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{event.title}</h4>
                        <button
                          onClick={() => toggleEventComplete(event.id, !event.completed)}
                          className={`p-1 rounded-full ${
                            event.completed
                              ? 'bg-green-500 text-white'
                              : 'bg-muted-foreground/20'
                          }`}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                      {event.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {event.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {schedule && !showTaskCard && (
            <div className="bg-card rounded-lg shadow-md p-6 border border-border">
              <h3 className="text-lg font-semibold mb-4">Weekly Schedule</h3>
              <div className="prose prose-sm max-w-none schedule-card">
                <ReactMarkdown>{schedule}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}