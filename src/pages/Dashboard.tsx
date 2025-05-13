import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Clock, Target, Plus, Mic } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { enUS } from 'date-fns/locale';
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
import { ResumeWidget } from '../components/ResumeWidget';
import type { Database } from '../lib/supabase-types';
import { WidgetType, toggleWidget, reorderWidgets, resizeWidget, fetchDashboardLayout, saveDashboardLayout } from '../store/dashboardSlice';
import type { RootState } from '../store';
import TasksWidget from '../components/TasksWidget';

type Application = Database['public']['Tables']['applications']['Row'];
type Company = Database['public']['Tables']['companies']['Row'];
type WidgetSize = { cols: number; rows: number };

const safeFormatDate = (dateInput: string | null | undefined, formatString: string): string | null => {
  if (!dateInput) return null;
  try {
    const date = new Date(dateInput);
    if (!isValid(date)) {
       return 'Invalid Date';
    }
    return format(date, formatString, { locale: enUS });
  } catch (e) {
      return 'Format Error';
  }
};

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
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (user) {
      dispatch(fetchDashboardLayout(user.id));
      const fetchData = async () => {
        try {
          const { data: recentApps, error: appsError } = await supabase
            .from('applications')
            .select(`*, companies ( name, website )`)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);
          if (appsError) throw appsError;
          if (recentApps) setApplications(recentApps as Application[]);

          const { data: targetCompanies, error: compError } = await supabase
            .from('companies')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'interested')
            .limit(5);
          if (compError) throw compError;
          if (targetCompanies) setCompanies(targetCompanies as Company[]);

          const { data: followUps, error: followUpError } = await supabase
            .from('applications')
            .select(`*, companies ( name )`)
            .eq('user_id', user.id)
            .gte('next_follow_up', new Date().toISOString().split('T')[0])
            .order('next_follow_up', { ascending: true })
            .limit(5);
          if (followUpError) throw followUpError;
          if (followUps) setUpcomingFollowUps(followUps as Application[]);
        } catch (error) {
          console.error("Error fetching dashboard data:", error);
        }
      };
      fetchData();
    } else {
      setApplications([]);
      setCompanies([]);
      setUpcomingFollowUps([]);
    }
  }, [user, dispatch]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && user) {
      const oldIndex = widgets.findIndex((w) => w.id === active.id);
      const newIndex = widgets.findIndex((w) => w.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrderedWidgets = arrayMove(widgets, oldIndex, newIndex);
        dispatch(reorderWidgets(newOrderedWidgets));
        dispatch(saveDashboardLayout({ userId: user.id, widgets: newOrderedWidgets }));
      }
    }
  }, [widgets, dispatch, user]);

  const handleToggleWidget = useCallback((type: WidgetType) => {
    if (user) {
      dispatch(toggleWidget(type));
      const updatedWidgets = widgets.map(w => 
        w.type === type ? { ...w, enabled: !w.enabled } : w
      );
      dispatch(saveDashboardLayout({ userId: user.id, widgets: updatedWidgets }));
    }
  }, [widgets, dispatch, user]);

  const handleResizeWidget = useCallback((id: string, newSize: WidgetSize) => {
    if (user) {
      dispatch(resizeWidget({ id, size: newSize }));
      const updatedWidgets = widgets.map(w => 
        w.id === id ? { ...w, size: newSize } : w
      );
      dispatch(saveDashboardLayout({ userId: user.id, widgets: updatedWidgets }));
    }
  }, [widgets, dispatch, user]);

  const widgetComponents: Partial<Record<WidgetType, React.ReactNode>> = {
    quote: ( <blockquote className="border-l-4 border-primary pl-4 h-full flex flex-col justify-center"> <p className="text-lg italic mb-2">{quote.text}</p> <footer className="text-sm text-muted-foreground">— {quote.author}</footer> </blockquote> ),
    aiCalendar: ( <AICalendarWidget applications={applications} companies={companies} /> ),
    applications: (
       <>
         <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Briefcase className="h-5 w-5" /> Recent Applications</h2>
         <div className="space-y-3">
           {applications.length > 0 ? applications.map((app) => (
             <div key={app.id} className="p-3 bg-muted rounded-md">
               <h3 className="font-medium">{app.position}</h3>
               <p className="text-sm text-muted-foreground">{(app as any).companies?.name ?? 'N/A'}</p>
               <p className="text-sm text-muted-foreground">Applied: {safeFormatDate(app.applied_date, 'MMM d, yyyy') ?? 'Draft'}</p>
             </div>
           )) : <p className="text-muted-foreground text-sm">No recent applications found.</p>}
         </div>
         <Link to="/applications" className="text-primary hover:underline text-sm block mt-4">View all applications →</Link>
       </>
    ),
    companies: ( <> <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Target className="h-5 w-5" /> Target Companies</h2> <div className="space-y-3"> {companies.length > 0 ? companies.map((company) => ( <div key={company.id} className="p-3 bg-muted rounded-md"> <h3 className="font-medium">{company.name}</h3> {company.website && (<a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">Visit website →</a>)} </div> )) : <p className="text-muted-foreground text-sm">No target companies found.</p>} </div> <Link to="/target-companies" className="text-primary hover:underline text-sm block mt-4">View all companies →</Link> </> ),
    followUps: (
       <>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Clock className="h-5 w-5" /> Upcoming Follow-ups</h2>
        <div className="space-y-3">
           {upcomingFollowUps.length > 0 ? upcomingFollowUps.map((app) => (
             <div key={app.id} className="p-3 bg-muted rounded-md">
               <h3 className="font-medium">{app.position}</h3>
               <p className="text-sm text-muted-foreground">{(app as any).companies?.name ?? 'N/A'}</p>
               <p className="text-sm text-muted-foreground">Follow up: {safeFormatDate(app.next_follow_up, 'MMM d, yyyy') ?? 'N/A'}</p>
             </div>
           )) : <p className="text-muted-foreground text-sm">No upcoming follow-ups.</p>}
        </div>
        <Link to="/applications" className="text-primary hover:underline text-sm block mt-4">View all follow-ups →</Link>
       </>
    ),
    pomodoro: ( <PomodoroWidget /> ),
    resume: ( <ResumeWidget /> ),
    tasks: ( <TasksWidget />)
  };

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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-white mix-blend-screen">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
               <button onClick={() => setShowVoiceAssistant(!showVoiceAssistant)} className={`p-2 rounded-full transition-colors ${showVoiceAssistant ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary/90'} text-white`} title={showVoiceAssistant ? "Close Voice Assistant" : "Open Voice Assistant"} aria-label={showVoiceAssistant ? "Close Voice Assistant" : "Open Voice Assistant"}>
                   <Mic className="h-5 w-5 sm:h-6 sm:w-6" />
               </button>
            </div>
             <button onClick={() => setIsWidgetMenuOpen(!isWidgetMenuOpen)} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-md flex items-center justify-center gap-2 text-sm transition-colors">
                 <Plus className="h-4 w-4 sm:h-5 sm:w-5" /> <span>Add Widget</span>
            </button>
          </div>

          {isWidgetMenuOpen && (
             <div className="bg-card/80 backdrop-blur-sm p-4 rounded-lg shadow-lg text-card-foreground">
                <h2 className="text-lg font-semibold mb-3">Available Widgets</h2>
                {availableWidgets.length > 0 ? (
                  <div className="space-y-2 mt-2 max-h-60 overflow-y-auto">
                    {availableWidgets.map(widget => (
                      <button
                        key={widget.id}
                        onClick={() => handleToggleWidget(widget.type)}
                        className="w-full text-left p-3 bg-muted hover:bg-primary/10 hover:text-primary rounded-md transition-colors flex items-center justify-between text-sm group"
                      >
                        <span className="capitalize">
                          {widget.type.replace(/([A-Z])/g, ' $1').toLowerCase()}
                        </span>
                        <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">
                    All available widgets are already displayed.
                  </p>
                )}
                <button onClick={() => setIsWidgetMenuOpen(false)} className="mt-4 text-primary hover:underline text-sm">Close Menu</button>
             </div>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={enabledWidgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 auto-rows-min">
                {enabledWidgets.map((widget) => (
                  widgetComponents[widget.type] ? (
                     <DashboardWidget
                        key={widget.id}
                        id={widget.id}
                        type={widget.type}
                        size={widget.size}
                        onResize={(newSize: WidgetSize) => handleResizeWidget(widget.id, newSize)}
                        onRemove={() => handleToggleWidget(widget.type)}
                     >
                        {widgetComponents[widget.type]}
                     </DashboardWidget>
                  ) : (
                      <div key={widget.id} className="p-4 bg-red-100 text-red-700 rounded shadow">
                          Widget type "{widget.type}" component not found.
                      </div>
                  )
                ))}
              </div>
            </SortableContext>
          </DndContext>

           {enabledWidgets.length === 0 && !isWidgetMenuOpen && (
              <div className="col-span-full text-center py-10 text-muted-foreground bg-card/80 backdrop-blur-sm rounded-lg shadow-lg">
                 <p>No widgets are currently enabled.</p>
                 <p>Click "Add Widget" above to add some!</p>
              </div>
           )}
        </div>
      </div>

       {showVoiceAssistant && (
           <VoiceNotesWidget onClose={() => setShowVoiceAssistant(false)} />
       )}
    </main>
  );
};

export default Dashboard;