import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Clock,
  Target,
  Plus,
  Mic,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent, // Use specific type for event
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy, // Corrected import name if needed
} from '@dnd-kit/sortable';
import { supabase } from '../lib/supabase';
import { useSelector, useDispatch } from 'react-redux';
import { getRandomQuote } from '../lib/utils';
import { DashboardWidget } from '../components/DashboardWidget'; // Assuming this component handles its own sortable logic + responsive col-spans
import AICalendarWidget from '../components/AICalendarWidget';
import { PomodoroWidget } from '../components/PomodoroWidget';
import { VoiceNotesWidget } from '../components/VoiceNotesWidget';
import TasksWidget from '../components/TasksWidget';
import { ResumeWidget } from '../components/ResumeWidget';
import type { Database } from '../lib/supabase-types';
import { Card, CardBody } from "@heroui/react"; // Assuming @heroui/react is installed
import { WidgetType, toggleWidget, reorderWidgets, resizeWidget, initializeWidgets } from '../store/dashboardSlice'; // Removed unused resetStore import
import type { RootState } from '../store'; // Import the RootState type

type Application = Database['public']['Tables']['applications']['Row'];
type Company = Database['public']['Tables']['companies']['Row'];

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  event_type: string;
  completed: boolean;
  user_id: string;
}

const Dashboard = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<Application[]>([]);
  const [isWidgetMenuOpen, setIsWidgetMenuOpen] = useState(false);
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);
  const quote = getRandomQuote();
  // Corrected: Use RootState for type safety
  const user = useSelector((state: RootState) => state.auth.user);
  const widgets = useSelector((state: RootState) => state.dashboard.widgets);
  const dispatch = useDispatch();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    // Initialize widgets if the state is empty
    if (widgets.length === 0) {
      dispatch(initializeWidgets());
    }
  }, [widgets.length, dispatch]);


  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        try {
           // Fetch recent applications
           const { data: recentApps, error: appsError } = await supabase
             .from('applications')
             .select(`
               *,
               companies ( name, website )
             `)
             .eq('user_id', user.id)
             .order('created_at', { ascending: false })
             .limit(5);
           if (appsError) throw appsError;
           if (recentApps) setApplications(recentApps);

           // Fetch target companies
           const { data: targetCompanies, error: compError } = await supabase
             .from('companies')
             .select('*')
             .eq('user_id', user.id)
             .eq('status', 'interested')
             .limit(5);
           if (compError) throw compError;
           if (targetCompanies) setCompanies(targetCompanies);

           // Fetch upcoming follow-ups
           const { data: followUps, error: followUpError } = await supabase
             .from('applications')
             .select(`
               *,
               companies ( name )
             `)
             .eq('user_id', user.id)
             .gte('next_follow_up', new Date().toISOString().split('T')[0]) // Ensure comparing dates correctly
             .order('next_follow_up', { ascending: true })
             .limit(5);
           if (followUpError) throw followUpError;
           if (followUps) setUpcomingFollowUps(followUps);

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        }
      };

      const fetchCalendarEvents = async () => {
        try {
            const { data, error } = await supabase
              .from('calendar_events')
              .select('*')
              .eq('user_id', user.id)
              .order('event_date', { ascending: true });

            if (error) throw error;
            if (data) {
              setEvents(data as CalendarEvent[]);
            }
        } catch(error) {
            console.error("Error fetching calendar events:", error);
        }
      };

      fetchData();
      fetchCalendarEvents();
    }
  }, [user]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = widgets.findIndex((w) => w.id === active.id);
      const newIndex = widgets.findIndex((w) => w.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
          const newWidgets = arrayMove(widgets, oldIndex, newIndex).map((widget, index) => ({
            ...widget,
            order: index,
          }));
          dispatch(reorderWidgets(newWidgets));
      }
    }
  };

  const widgetComponents: Record<WidgetType, React.ReactNode> = {
    quote: (
      <blockquote className="border-l-4 border-primary pl-4">
        <p className="text-lg italic mb-2">{quote.text}</p>
        <footer className="text-sm text-muted-foreground">— {quote.author}</footer>
      </blockquote>
    ),
    calendar: (
      <AICalendarWidget events={events} />
    ),
    applications: (
      <>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Briefcase className="h-5 w-5" /> Recent Applications
        </h2>
        <div className="space-y-3">
          {applications.length > 0 ? applications.map((app: any) => (
            <div key={app.id} className="p-3 bg-muted rounded-md">
              <h3 className="font-medium">{app.position}</h3>
              <p className="text-sm text-muted-foreground">
                {app.companies?.name ?? 'N/A'}
              </p>
              <p className="text-sm text-muted-foreground">
                Applied: {app.applied_date ? format(new Date(app.applied_date), 'MMM d, yyyy') : 'Draft'}
              </p>
            </div>
          )) : <p className="text-muted-foreground text-sm">No recent applications found.</p>}
        </div>
        <Link to="/applications" className="text-primary hover:underline text-sm block mt-4">
          View all applications →
        </Link>
      </>
    ),
    companies: (
      <>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Target className="h-5 w-5" /> Target Companies
        </h2>
        <div className="space-y-3">
           {companies.length > 0 ? companies.map((company) => (
             <div key={company.id} className="p-3 bg-muted rounded-md">
               <h3 className="font-medium">{company.name}</h3>
               {company.website && (
                 <a
                   href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                   target="_blank"
                   rel="noopener noreferrer"
                   className="text-sm text-primary hover:underline break-all"
                 >
                   Visit website →
                 </a>
               )}
             </div>
           )) : <p className="text-muted-foreground text-sm">No target companies found.</p>}
        </div>
        <Link to="/target-companies" className="text-primary hover:underline text-sm block mt-4">
          View all companies →
        </Link>
      </>
    ),
    followUps: (
      <>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5" /> Upcoming Follow-ups
        </h2>
        <div className="space-y-3">
           {upcomingFollowUps.length > 0 ? upcomingFollowUps.map((app: any) => (
             <div key={app.id} className="p-3 bg-muted rounded-md">
               <h3 className="font-medium">{app.position}</h3>
               <p className="text-sm text-muted-foreground">
                 {app.companies?.name ?? 'N/A'}
               </p>
               <p className="text-sm text-muted-foreground">
                 Follow up: {app.next_follow_up ? format(new Date(app.next_follow_up), 'MMM d, yyyy') : 'N/A'}
               </p>
             </div>
           )) : <p className="text-muted-foreground text-sm">No upcoming follow-ups.</p>}
        </div>
        <Link to="/applications" className="text-primary hover:underline text-sm block mt-4">
          View all follow-ups →
        </Link>
      </>
    ),
    pomodoro: (
      <PomodoroWidget />
    ),
    voiceNotes: (
      <VoiceNotesWidget />
    ),
    tasks: (
      <TasksWidget />
    ),
    resume: (
      <ResumeWidget />
    ),
    aiCalendar: <div>AI Calendar Widget Placeholder</div>,
    aiSchedule: <div>AI Schedule Widget Placeholder</div>,
  };


  // Filter and sort widgets based on Redux state
  const enabledWidgets = widgets.filter((w) => w.enabled).sort((a, b) => a.order - b.order);
  const availableWidgets = widgets.filter((w) => !w.enabled);

  return (
    // *** CORRECTED MAIN CONTAINER CLASS ***
    <main className="min-h-screen w-full relative flex justify-center px-4 pt-16 pb-16 overflow-x-hidden"> {/* Adjusted padding and removed items-center */}
      {/* Background Image */}
      <div className="fixed inset-0 z-0">
        <img
          src="https://img.heroui.chat/image/landscape?w=1920&h=1080&u=1"
          className="w-full h-full object-cover"
          alt="Dashboard Background"
        />
        <div className="absolute inset-0 bg-black/10" />
      </div>

      {/* Main Content Area */}
      {/* This div is now aligned to the top of the main container due to removal of items-center */}
      <div className="w-full max-w-7xl z-10">
        <div className="space-y-6">
          {/* Header: Title and Buttons */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-foreground">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
              <button
                onClick={() => setShowVoiceAssistant(!showVoiceAssistant)}
                className={`p-2 rounded-full transition-colors ${
                  showVoiceAssistant
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-primary hover:bg-primary/90'
                } text-white`}
                title={showVoiceAssistant ? "Close Job Buddy" : "Open Job Buddy"}
                aria-label={showVoiceAssistant ? "Close Job Buddy Voice Assistant" : "Open Job Buddy Voice Assistant"}
              >
                <Mic className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </div>
            <button
              onClick={() => setIsWidgetMenuOpen(!isWidgetMenuOpen)}
              className="w-full sm:w-auto bg-primary text-primary-foreground px-4 py-2 rounded-md flex items-center justify-center gap-2 text-sm hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>Add Widget</span>
            </button>
          </div>

          {/* Voice Assistant Panel */}
          {showVoiceAssistant && (
            <div className="fixed inset-x-0 bottom-0 p-4 sm:p-6 bg-card border-t border-border shadow-lg z-50">
              <div className="max-w-md sm:max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">lil torc</h2>
                  <button
                    onClick={() => setShowVoiceAssistant(false)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Close Voice Assistant"
                  >
                    <X className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>
                <VoiceNotesWidget />
              </div>
            </div>
          )}

          {/* Available Widgets Menu */}
          {isWidgetMenuOpen && (
             availableWidgets.length > 0 ? (
               <div className="bg-card text-card-foreground p-4 rounded-lg shadow-md">
                 <div className="flex justify-between items-center mb-3">
                    <h2 className="text-lg font-semibold">Available Widgets</h2>
                    <button
                        onClick={() => setIsWidgetMenuOpen(false)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Close Add Widget Menu"
                    >
                        <X className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                 </div>
                 <div className="flex flex-wrap gap-2">
                   {availableWidgets.map((widget) => (
                     <button
                       key={widget.id}
                       onClick={() => {
                         dispatch(toggleWidget(widget.type));
                       }}
                       className="bg-muted hover:bg-muted/80 px-3 py-1 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
                     >
                       {widget.type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                     </button>
                   ))}
                 </div>
               </div>
             ) : (
                <div className="bg-card text-card-foreground p-4 rounded-lg shadow-md">
                     <div className="flex justify-between items-center mb-3">
                        <h2 className="text-lg font-semibold">Available Widgets</h2>
                        <button
                            onClick={() => setIsWidgetMenuOpen(false)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Close Add Widget Menu"
                        >
                            <X className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                     </div>
                     <p className="text-muted-foreground text-sm">All widgets are currently enabled.</p>
                </div>
             )
          )}

          {/* Drag and Drop Widget Grid */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={enabledWidgets.map((w) => w.id)}
              strategy={verticalListSortingStrategy} // Use a strategy suitable for grids if needed, though vertical might be ok
            >
              {/* The grid structure IS responsive */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 auto-rows-min">
                {enabledWidgets.map((widget) => (
                  <DashboardWidget
                    key={widget.id}
                    id={widget.id}
                    type={widget.type}
                    size={widget.size}
                    // *** Corrected onResize prop passing ***
                    // Pass only the newSize object as expected by DashboardWidget
                    // The widget.id is already known in the closure here
                    onResize={(newSize) => dispatch(resizeWidget({ id: widget.id, size: newSize }))}
                    onRemove={() => dispatch(toggleWidget(widget.type))}
                  >
                    <Card shadow="lg" className="h-full flex flex-col">
                      <CardBody className="p-4 sm:p-6 flex-grow">
                        {widgetComponents[widget.type as WidgetType] ?? <div>Widget type '{widget.type}' not found.</div>}
                      </CardBody>
                    </Card>
                  </DashboardWidget>
                ))}
              </div>
            </SortableContext>
          </DndContext>

           {/* Message if no widgets are enabled */}
           {enabledWidgets.length === 0 && !isWidgetMenuOpen && (
               <div className="text-center py-10 bg-card rounded-lg shadow-md">
                   <p className="text-muted-foreground mb-4">No widgets enabled.</p>
                   <button
                      onClick={() => setIsWidgetMenuOpen(true)}
                      className="bg-primary text-primary-foreground px-4 py-2 rounded-md flex items-center justify-center gap-2 text-sm hover:bg-primary/90 transition-colors mx-auto"
                   >
                       <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                       <span>Add Widget</span>
                   </button>
               </div>
           )}

        </div>
      </div>
    </main>
  );
};

export default Dashboard;