import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Clock, Target, Plus, Mic } from 'lucide-react';
import { format } from 'date-fns';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { supabase } from '../lib/supabase';
import { useSelector, useDispatch } from 'react-redux';
import { getRandomQuote } from '../lib/utils';
import { DashboardWidget } from '../components/DashboardWidget';
import AICalendarWidget from '../components/AICalendarWidget';
import { PomodoroWidget } from '../components/PomodoroWidget';
import { VoiceNotesWidget } from '../components/VoiceNotesWidget';
// import TasksWidget from '../components/TasksWidget'; // <-- REMOVED IMPORT
import { ResumeWidget } from '../components/ResumeWidget';
import type { Database } from '../lib/supabase-types';
import { Card, CardBody } from "@heroui/react";
// Ensure WidgetType reflects the updated definition (without 'tasks')
import { WidgetType, toggleWidget, reorderWidgets, resizeWidget, initializeWidgets, resetStore } from '../store/dashboardSlice';
import type { RootState } from '../store';

type Application = Database['public']['Tables']['applications']['Row'];
type Company = Database['public']['Tables']['companies']['Row'];

// Keep this type definition if needed for data fetching, though AICalendarWidget uses its own internal one now.
// interface CalendarEvent { ... }

const Dashboard = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<Application[]>([]);
  const [isWidgetMenuOpen, setIsWidgetMenuOpen] = useState(false);
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);
  const quote = getRandomQuote();
  const user = useSelector((state: RootState) => state.auth.user);
  const widgets = useSelector((state: RootState) => state.dashboard.widgets);
  const dispatch = useDispatch();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, })
  );

  // Fetch initial state only if needed by Dashboard widgets
  // useEffect(() => { dispatch(initializeWidgets()); }, [dispatch]); // Consider if needed or if state persists

  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        try {
           const { data: recentApps, error: appsError } = await supabase.from('applications').select(`*, companies ( name, website )`).eq('user_id', user.id).order('created_at', { ascending: false }).limit(5);
           if (appsError) throw appsError;
           if (recentApps) setApplications(recentApps);

           const { data: targetCompanies, error: compError } = await supabase.from('companies').select('*').eq('user_id', user.id).eq('status', 'interested').limit(5);
           if (compError) throw compError;
           if (targetCompanies) setCompanies(targetCompanies);

           const { data: followUps, error: followUpError } = await supabase.from('applications').select(`*, companies ( name )`).eq('user_id', user.id).gte('next_follow_up', new Date().toISOString().split('T')[0]).order('next_follow_up', { ascending: true }).limit(5);
           if (followUpError) throw followUpError;
           if (followUps) setUpcomingFollowUps(followUps);
        } catch (error) { console.error("Error fetching dashboard data:", error); }
      };
      fetchData();
      // Calendar fetches its own data now
    }
     // Reset state if user logs out (optional)
     else {
        setApplications([]);
        setCompanies([]);
        setUpcomingFollowUps([]);
     }
  }, [user]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = widgets.findIndex((w) => w.id === active.id);
      const newIndex = widgets.findIndex((w) => w.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
          const newOrderedWidgets = arrayMove(widgets, oldIndex, newIndex);
          // Pass the full new array to the reducer to handle order update
          dispatch(reorderWidgets(newOrderedWidgets));
      }
    }
  };

  // Define components, remove the 'tasks' entry
  // Ensure the key 'aiCalendar' matches the WidgetType definition in the slice
  const widgetComponents: Partial<Record<WidgetType, React.ReactNode>> = { // Use Partial to avoid listing ALL types
    quote: (
      <blockquote className="border-l-4 border-primary pl-4">
        <p className="text-lg italic mb-2">{quote.text}</p>
        <footer className="text-sm text-muted-foreground">— {quote.author}</footer>
      </blockquote>
    ),
    // Use the key ('aiCalendar' or 'calendar') that matches your cleaned-up WidgetType
    aiCalendar: (
      <AICalendarWidget applications={applications} companies={companies} />
    ),
    applications: (
       <>
         <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Briefcase className="h-5 w-5" /> Recent Applications</h2>
         <div className="space-y-3">
           {applications.length > 0 ? applications.map((app: any) => (
             <div key={app.id} className="p-3 bg-muted rounded-md">
               <h3 className="font-medium">{app.position}</h3>
               <p className="text-sm text-muted-foreground">{(app as any).companies?.name ?? 'N/A'}</p>
               <p className="text-sm text-muted-foreground">Applied: {app.applied_date ? format(new Date(app.applied_date), 'MMM d, yyyy') : 'Draft'}</p>
             </div>
           )) : <p className="text-muted-foreground text-sm">No recent applications found.</p>}
         </div>
         <Link to="/applications" className="text-primary hover:underline text-sm block mt-4">View all applications →</Link>
       </>
    ),
    companies: (
       <>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Target className="h-5 w-5" /> Target Companies</h2>
        <div className="space-y-3">
           {companies.length > 0 ? companies.map((company) => (
             <div key={company.id} className="p-3 bg-muted rounded-md">
               <h3 className="font-medium">{company.name}</h3>
               {company.website && (<a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">Visit website →</a>)}
             </div>
           )) : <p className="text-muted-foreground text-sm">No target companies found.</p>}
        </div>
        <Link to="/target-companies" className="text-primary hover:underline text-sm block mt-4">View all companies →</Link>
       </>
    ),
    followUps: (
       <>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Clock className="h-5 w-5" /> Upcoming Follow-ups</h2>
        <div className="space-y-3">
           {upcomingFollowUps.length > 0 ? upcomingFollowUps.map((app: any) => (
             <div key={app.id} className="p-3 bg-muted rounded-md">
               <h3 className="font-medium">{app.position}</h3>
               <p className="text-sm text-muted-foreground">{(app as any).companies?.name ?? 'N/A'}</p>
               <p className="text-sm text-muted-foreground">Follow up: {app.next_follow_up ? format(new Date(app.next_follow_up), 'MMM d, yyyy') : 'N/A'}</p>
             </div>
           )) : <p className="text-muted-foreground text-sm">No upcoming follow-ups.</p>}
        </div>
        <Link to="/applications" className="text-primary hover:underline text-sm block mt-4">View all follow-ups →</Link>
       </>
    ),
    pomodoro: ( <PomodoroWidget /> ),
    voiceNotes: ( <VoiceNotesWidget /> ),
    // tasks: ( <TasksWidget /> ), // <-- REMOVED TASKS WIDGET MAPPING
    resume: ( <ResumeWidget /> ),
    aiSchedule: <div>AI Schedule Placeholder</div>, // Keep if type exists
  };

  // Filter and sort widgets based on Redux state BEFORE rendering
  const enabledWidgets = widgets.filter((w) => w.enabled).sort((a, b) => a.order - b.order);
  const availableWidgets = widgets.filter((w) => !w.enabled);

  return (
    <main className="min-h-screen w-full relative flex justify-center px-4 pt-16 pb-16 overflow-x-hidden">
      <div className="fixed inset-0 z-0">
        <img src="https://img.heroui.chat/image/landscape?w=1920&h=1080&u=1" className="w-full h-full object-cover" alt="Dashboard Background" />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <div className="w-full max-w-7xl z-10">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-white mix-blend-screen">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
               <button onClick={() => setShowVoiceAssistant(!showVoiceAssistant)} className={`p-2 rounded-full transition-colors ${showVoiceAssistant ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary/90'} text-white`} title={showVoiceAssistant ? "Close Job Buddy" : "Open Job Buddy"} aria-label={showVoiceAssistant ? "Close Job Buddy Voice Assistant" : "Open Job Buddy Voice Assistant"}> <Mic className="h-5 w-5 sm:h-6 sm:w-6" /> </button>
            </div>
             <button onClick={() => setIsWidgetMenuOpen(!isWidgetMenuOpen)} className="w-full sm:w-auto bg-white/80 backdrop-blur-sm text-black px-4 py-2 rounded-md flex items-center justify-center gap-2 text-sm hover:bg-white/95 transition-colors"> <Plus className="h-4 w-4 sm:h-5 sm:w-5" /> <span>Add Widget</span> </button>
          </div>

          {/* Voice Assistant Panel */}
          {showVoiceAssistant && ( /* ... voice assistant JSX ... */ )}

          {/* Available Widgets Menu */}
          {isWidgetMenuOpen && ( /* ... available widgets JSX ... */ )}

          {/* Drag and Drop Widget Grid */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={enabledWidgets.map((w) => w.id)} strategy={verticalListSortingStrategy} >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 auto-rows-min">
                {enabledWidgets.map((widget) => (
                  // Ensure widgetComponents lookup uses the correct type from Redux state
                  widgetComponents[widget.type as WidgetType] ? (
                     <DashboardWidget key={widget.id} id={widget.id} type={widget.type} size={widget.size} onResize={(newSize) => dispatch(resizeWidget({ id: widget.id, size: newSize }))} onRemove={() => dispatch(toggleWidget(widget.type))} >
                        <Card className="h-full flex flex-col bg-card/80 backdrop-blur-sm shadow-lg border-border/50">
                           <CardBody className="p-4 sm:p-6 flex-grow overflow-hidden">
                             {widgetComponents[widget.type as WidgetType]}
                           </CardBody>
                        </Card>
                     </DashboardWidget>
                  ) : null // Render nothing if component mapping doesn't exist
                ))}
              </div>
            </SortableContext>
          </DndContext>

           {/* Message if no widgets enabled */}
           {enabledWidgets.length === 0 && !isWidgetMenuOpen && ( /* ... no widgets message JSX ... */ )}
        </div>
      </div>
    </main>
  );
};

export default Dashboard;