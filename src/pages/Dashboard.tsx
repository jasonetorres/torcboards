// src/pages/Dashboard.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

// Components
import { DashboardWidget } from '../components/DashboardWidget';
import AICalendarWidget from '../components/AICalendarWidget';
import { PomodoroWidget } from '../components/PomodoroWidget';
import { VoiceNotesWidget } from '../components/VoiceNotesWidget';
import { ResumeWidget } from '../components/ResumeWidget';
import TasksWidget from '../components/TasksWidget';

// Redux
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import {
    WidgetType,
    type Widget as LayoutWidgetDefinition,
    toggleWidget as toggleWidgetLayoutAction,
    reorderWidgets as reorderWidgetsLayoutAction,
    resizeWidget as resizeWidgetLayoutAction,
    fetchDashboardLayout,
    saveDashboardLayout,
    initializeWidgets as initializeLayoutWidgets
} from '../store/dashboardSlice';

import {
    fetchDashboardQuote,
    fetchDashboardPageData,
    clearDashboardData
} from '../store/dashboardDataSlice';

// Types
import type { Database } from '../lib/supabase-types';

type Company = Database['public']['Tables']['companies']['Row'];
type Application = Database['public']['Tables']['applications']['Row'] & {
    companies?: Partial<Company> | null;
};
type WidgetSize = { cols: number; rows: number };

const safeFormatDate = (dateInput: string | null | undefined, formatString: string): string | null => {
  if (!dateInput) return null;
  try {
    const date = new Date(dateInput);
    if (!isValid(date)) { return 'Invalid Date'; }
    return format(date, formatString, { locale: enUS });
  } catch (e) {
    // console.error("Date formatting error in safeFormatDate:", e, "Input:", dateInput); // Kept one for actual errors
    return 'Format Error';
  }
};

const Dashboard = () => {
  // console.log('--- Dashboard Component Render ---'); // Removed

  const [isWidgetMenuOpen, setIsWidgetMenuOpen] = useState(false);
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);

  const dispatch = useDispatch<AppDispatch>();

  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const widgetLayouts = useSelector((state: RootState) => state.dashboard.widgets);
  const dashboardLayoutLoading = useSelector((state: RootState) => state.dashboard.loading);

  const {
    quote,
    applications,
    companies,
    upcomingFollowUps,
    loading: dashboardDataLoadingStatus,
  } = useSelector((state: RootState) => state.dashboardData || {
    quote: null, applications: [], companies: [], upcomingFollowUps: [],
    loading: 'idle', error: null,
  });

  const layoutFetchDispatchedForCurrentUserRef = useRef<string | null>(null);
  const quoteFetchDispatchedForCurrentUserRef = useRef<string | null>(null);
  const pageDataFetchDispatchedForCurrentUserRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (userId) {
      layoutFetchDispatchedForCurrentUserRef.current = null;
      quoteFetchDispatchedForCurrentUserRef.current = null;
      pageDataFetchDispatchedForCurrentUserRef.current = null;
    } else {
      dispatch(clearDashboardData());
      dispatch(initializeLayoutWidgets());
      layoutFetchDispatchedForCurrentUserRef.current = null;
      quoteFetchDispatchedForCurrentUserRef.current = null;
      pageDataFetchDispatchedForCurrentUserRef.current = null;
    }
  }, [userId, dispatch]);

  useEffect(() => {
    if (userId && layoutFetchDispatchedForCurrentUserRef.current !== userId && dashboardLayoutLoading !== 'pending') {
      dispatch(fetchDashboardLayout(userId));
      layoutFetchDispatchedForCurrentUserRef.current = userId;
    }
  }, [userId, dispatch, dashboardLayoutLoading]);

  useEffect(() => {
    if (userId) {
      if (quoteFetchDispatchedForCurrentUserRef.current !== userId) {
        dispatch(fetchDashboardQuote());
        quoteFetchDispatchedForCurrentUserRef.current = userId;
      }
      if (pageDataFetchDispatchedForCurrentUserRef.current !== userId && dashboardDataLoadingStatus !== 'pending') {
        dispatch(fetchDashboardPageData(userId));
        pageDataFetchDispatchedForCurrentUserRef.current = userId;
      }
    }
  }, [userId, dispatch, dashboardDataLoadingStatus]);


  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && userId) {
      const currentWidgets = widgetLayouts;
      const oldIndex = currentWidgets.findIndex((w) => w.id === active.id);
      const newIndex = currentWidgets.findIndex((w) => w.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrderedWidgets = arrayMove([...currentWidgets], oldIndex, newIndex);
        dispatch(reorderWidgetsLayoutAction(newOrderedWidgets));
        dispatch(saveDashboardLayout({ userId, widgets: newOrderedWidgets }));
      }
    }
  }, [widgetLayouts, dispatch, userId]);

  const refinedHandleToggleWidget = useCallback((type: WidgetType) => {
    if (userId) {
        const widgetToToggle = widgetLayouts.find(w => w.type === type);
        if (!widgetToToggle) return;
        const updatedWidgets = widgetLayouts.map(w =>
            w.type === type ? { ...w, enabled: !w.enabled } : w
        );
        dispatch(toggleWidgetLayoutAction(type));
        dispatch(saveDashboardLayout({ userId, widgets: updatedWidgets }));
    }
  }, [widgetLayouts, dispatch, userId]);

  const refinedHandleResizeWidget = useCallback((id: string, newSize: WidgetSize) => {
    if (userId) {
        const updatedWidgets = widgetLayouts.map(w =>
            w.id === id ? { ...w, size: newSize } : w
        );
        dispatch(resizeWidgetLayoutAction({ id, size: newSize }));
        dispatch(saveDashboardLayout({ userId, widgets: updatedWidgets }));
    }
  }, [widgetLayouts, dispatch, userId]);

  const quoteToDisplay = quote || { text: "Loading quote...", author: "..." };

  const memoizedWidgetComponents = useMemo(() => ({
    quote: ( <blockquote className="border-l-4 border-primary pl-4 h-full flex flex-col justify-center"> <p className="text-lg italic mb-2">{quoteToDisplay.text}</p> <footer className="text-sm text-muted-foreground">— {quoteToDisplay.author}</footer> </blockquote> ),
    aiCalendar: ( <AICalendarWidget applications={applications || []} companies={companies || []} /> ),
    applications: ( <> <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Briefcase className="h-5 w-5" /> Recent Applications</h2> {dashboardDataLoadingStatus === 'pending' && (!applications || applications.length === 0) && <p className="text-muted-foreground text-sm">Loading applications...</p>} <div className="space-y-3"> {applications && applications.length > 0 ? applications.map((app: Application) => ( <div key={app.id} className="p-3 bg-muted rounded-md"> <h3 className="font-medium">{app.position}</h3> <p className="text-sm text-muted-foreground">{app.companies?.name ?? 'N/A'}</p> <p className="text-sm text-muted-foreground">Applied: {safeFormatDate(app.applied_date, 'MMM d, yy') ?? 'Draft'}</p> </div> )) : (dashboardDataLoadingStatus !== 'pending' && <p className="text-muted-foreground text-sm">No applications loaded.</p>)} </div> <Link to="/applications" className="text-primary hover:underline text-sm block mt-4">View all applications →</Link> </> ),
    companies: ( <> <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Target className="h-5 w-5" /> Target Companies</h2> {dashboardDataLoadingStatus === 'pending' && (!companies || companies.length === 0) && <p className="text-muted-foreground text-sm">Loading companies...</p>} <div className="space-y-3"> {companies && companies.length > 0 ? companies.map((company: Company) => ( <div key={company.id} className="p-3 bg-muted rounded-md"> <h3 className="font-medium">{company.name}</h3> {company.website && (<a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">Visit website →</a>)} </div> )) : (dashboardDataLoadingStatus !== 'pending' && <p className="text-muted-foreground text-sm">No companies loaded.</p>)} </div> <Link to="/target-companies" className="text-primary hover:underline text-sm block mt-4">View all companies →</Link> </> ),
    followUps: ( <> <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Clock className="h-5 w-5" /> Upcoming Follow-ups</h2> {dashboardDataLoadingStatus === 'pending' && (!upcomingFollowUps || upcomingFollowUps.length === 0) && <p className="text-muted-foreground text-sm">Loading follow-ups...</p>} <div className="space-y-3"> {upcomingFollowUps && upcomingFollowUps.length > 0 ? upcomingFollowUps.map((app: Application) => ( <div key={app.id} className="p-3 bg-muted rounded-md"> <h3 className="font-medium">{app.position}</h3> <p className="text-sm text-muted-foreground">{app.companies?.name ?? 'N/A'}</p> <p className="text-sm text-muted-foreground">Follow up: {safeFormatDate(app.next_follow_up, 'MMM d, yy') ?? 'N/A'}</p> </div> )) : (dashboardDataLoadingStatus !== 'pending' && <p className="text-muted-foreground text-sm">No follow-ups loaded.</p>)} </div> <Link to="/applications" className="text-primary hover:underline text-sm block mt-4">View all follow-ups →</Link> </> ),
    pomodoro: ( <PomodoroWidget /> ),
    resume: ( <ResumeWidget /> ),
    tasks: ( <TasksWidget />)
  }), [quoteToDisplay, applications, companies, upcomingFollowUps, dashboardDataLoadingStatus]);

  const enabledWidgets = widgetLayouts.filter((w) => w.enabled).sort((a, b) => a.order - b.order);
  const availableWidgets = widgetLayouts.filter((w) => !w.enabled);

  return (
    <main className="min-h-screen w-full relative flex justify-center px-2 sm:px-4 pt-12 pb-16 overflow-y-auto">
      <div className="fixed inset-0 z-0"> <img src="https://img.heroui.chat/image/landscape?w=1920&h=1080&u=1" className="w-full h-full object-cover" alt="Background" /> <div className="absolute inset-0 bg-black/20" /> </div>
      <div className="w-full max-w-7xl z-10">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"> <h1 className="text-xl sm:text-2xl font-bold text-white mix-blend-screen">Dashboard</h1> <div className="flex items-center gap-2 w-full sm:w-auto"> <button onClick={() => setShowVoiceAssistant(!showVoiceAssistant)} className={`p-1.5 rounded-full transition-colors ${showVoiceAssistant ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary/90'} text-white`} title={showVoiceAssistant ? "Close Voice Assistant" : "Open Voice Assistant"} aria-label={showVoiceAssistant ? "Close Voice Assistant" : "Open Voice Assistant"}> <Mic className="h-4 w-4 sm:h-5 sm:w-5" /> </button> <button onClick={() => setIsWidgetMenuOpen(!isWidgetMenuOpen)} className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-md flex items-center justify-center gap-2 text-sm transition-colors"> <Plus className="h-4 w-4" /> <span>Add Widget</span> </button> </div> </div>
          {isWidgetMenuOpen && ( <div className="bg-card/80 backdrop-blur-sm p-3 rounded-lg shadow-lg text-card-foreground"> <h2 className="text-base font-semibold mb-2">Available Widgets</h2> {availableWidgets.length > 0 ? ( <div className="space-y-1.5 mt-2 max-h-60 overflow-y-auto"> {availableWidgets.map(widget => ( <button key={widget.id} onClick={() => refinedHandleToggleWidget(widget.type)} className="w-full text-left p-2 bg-muted hover:bg-primary/10 hover:text-primary rounded-md transition-colors flex items-center justify-between text-sm group"> <span className="capitalize"> {widget.type.replace(/([A-Z])/g, ' $1').toLowerCase()} </span> <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" /> </button> ))} </div> ) : ( <p className="text-sm text-muted-foreground mt-2"> All available widgets are already displayed. </p> )} <button onClick={() => setIsWidgetMenuOpen(false)} className="mt-3 text-primary hover:underline text-sm"> Close Menu </button> </div> )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}> <SortableContext items={enabledWidgets.map((w) => w.id)} strategy={verticalListSortingStrategy}> <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 auto-rows-min"> {enabledWidgets.map((widgetDef) => ( memoizedWidgetComponents[widgetDef.type] ? ( <DashboardWidget key={widgetDef.id} id={widgetDef.id} type={widgetDef.type} size={widgetDef.size} onResize={(newSize: WidgetSize) => refinedHandleResizeWidget(widgetDef.id, newSize)} onRemove={() => refinedHandleToggleWidget(widgetDef.type)} > {memoizedWidgetComponents[widgetDef.type]} </DashboardWidget> ) : null ))} </div> </SortableContext> </DndContext>
          {enabledWidgets.length === 0 && !isWidgetMenuOpen && ( <div className="col-span-full text-center py-8 text-muted-foreground bg-card/80 backdrop-blur-sm rounded-lg shadow-lg"> <p>No widgets are currently enabled.</p> <p>Click "Add Widget" above to add some!</p> </div> )}
        </div>
      </div>
      {showVoiceAssistant && ( <VoiceNotesWidget onClose={() => setShowVoiceAssistant(false)} /> )}
    </main>
  );
};
export default Dashboard;