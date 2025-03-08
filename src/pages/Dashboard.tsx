import React, { useState, useEffect } from 'react';
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
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useDashboardStore, type WidgetType } from '../store/useDashboardStore';
import { getRandomQuote } from '../lib/utils';
import { DashboardWidget } from '../components/DashboardWidget';
import { AICalendarWidget } from '../components/AICalendarWidget';
import { PomodoroWidget } from '../components/PomodoroWidget';
import { VoiceNotesWidget } from '../components/VoiceNotesWidget';
import { TasksWidget } from '../components/TasksWidget';
import { ResumeWidget } from '../components/ResumeWidget';
import type { Database } from '../lib/supabase-types';

type Application = Database['public']['Tables']['applications']['Row'];
type Company = Database['public']['Tables']['companies']['Row'];

const Dashboard = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<Application[]>([]);
  const [isWidgetMenuOpen, setIsWidgetMenuOpen] = useState(false);
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);
  const quote = getRandomQuote();
  const user = useAuthStore((state) => state.user);
  const { widgets, toggleWidget, reorderWidgets, resizeWidget, initializeWidgets, resetStore } = useDashboardStore();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (widgets.length === 0) {
      resetStore();
      initializeWidgets();
    }
  }, [widgets.length, initializeWidgets, resetStore]);

  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        // Fetch recent applications
        const { data: recentApps } = await supabase
          .from('applications')
          .select(`
            *,
            companies (
              name,
              website
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (recentApps) setApplications(recentApps);

        // Fetch target companies
        const { data: targetCompanies } = await supabase
          .from('companies')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'interested')
          .limit(5);

        if (targetCompanies) setCompanies(targetCompanies);

        // Fetch upcoming follow-ups
        const { data: followUps } = await supabase
          .from('applications')
          .select(`
            *,
            companies (
              name
            )
          `)
          .eq('user_id', user.id)
          .gte('next_follow_up', new Date().toISOString())
          .order('next_follow_up', { ascending: true })
          .limit(5);

        if (followUps) setUpcomingFollowUps(followUps);
      };

      fetchData();
    }
  }, [user]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = widgets.findIndex((w) => w.id === active.id);
      const newIndex = widgets.findIndex((w) => w.id === over.id);

      const newWidgets = arrayMove(widgets, oldIndex, newIndex).map((widget, index) => ({
        ...widget,
        order: index,
      }));

      reorderWidgets(newWidgets);
    }
  };

  const widgetComponents: Record<WidgetType, React.ReactNode> = {
    quote: (
      <blockquote className="border-l-4 border-primary pl-4">
        <p className="text-lg italic mb-2">{quote.text}</p>
        <footer className="text-sm text-muted-foreground">— {quote.author}</footer>
      </blockquote>
    ),
    calendar: null,
    applications: (
      <>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Recent Applications
        </h2>
        <div className="space-y-3">
          {applications.map((app: any) => (
            <div key={app.id} className="p-3 bg-muted rounded-md">
              <h3 className="font-medium">{app.position}</h3>
              <p className="text-sm text-muted-foreground">
                {app.companies?.name}
              </p>
              <p className="text-sm text-muted-foreground">
                Applied: {app.applied_date ? format(new Date(app.applied_date), 'MMM d, yyyy') : 'Draft'}
              </p>
            </div>
          ))}
        </div>
        <Link to="/applications" className="text-primary hover:underline text-sm block mt-4">
          View all applications →
        </Link>
      </>
    ),
    companies: (
      <>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Target className="h-5 w-5" />
          Target Companies
        </h2>
        <div className="space-y-3">
          {companies.map((company) => (
            <div key={company.id} className="p-3 bg-muted rounded-md">
              <h3 className="font-medium">{company.name}</h3>
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Visit website →
                </a>
              )}
            </div>
          ))}
        </div>
        <Link to="/target-companies" className="text-primary hover:underline text-sm block mt-4">
          View all companies →
        </Link>
      </>
    ),
    followUps: (
      <>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Upcoming Follow-ups
        </h2>
        <div className="space-y-3">
          {upcomingFollowUps.map((app: any) => (
            <div key={app.id} className="p-3 bg-muted rounded-md">
              <h3 className="font-medium">{app.position}</h3>
              <p className="text-sm text-muted-foreground">
                {app.companies?.name}
              </p>
              <p className="text-sm text-muted-foreground">
                Follow up: {format(new Date(app.next_follow_up!), 'MMM d, yyyy')}
              </p>
            </div>
          ))}
        </div>
        <Link to="/applications" className="text-primary hover:underline text-sm block mt-4">
          View all follow-ups →
        </Link>
      </>
    ),
    pomodoro: (
      <PomodoroWidget />
    ),
    aiCalendar: (
      <AICalendarWidget applications={applications} companies={companies} />
    ),
    aiSchedule: (
      <div>AI Schedule Widget</div>
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
  };

  const enabledWidgets = widgets.filter((w) => w.enabled).sort((a, b) => a.order - b.order);
  const availableWidgets = widgets.filter((w) => !w.enabled);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
        <div className="flex items-center gap-4">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>

          <button
            onClick={() => setShowVoiceAssistant(!showVoiceAssistant)}
            className={`p-2 rounded-full ${
              showVoiceAssistant
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-primary hover:bg-primary/90'
            } text-white`}
            title="Job Buddy Voice Assistant"
          >
            <Mic className="h-6 w-6" />
          </button>
        </div>
        <button
          onClick={() => setIsWidgetMenuOpen(!isWidgetMenuOpen)}
          className="w-full sm:w-auto bg-primary text-primary-foreground px-4 py-2 rounded-md flex items-center justify-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Add Widget
        </button>
      </div>

      {showVoiceAssistant && (
        <div className="fixed inset-x-0 bottom-0 p-4 sm:p-6 bg-card border-t border-border shadow-lg z-50">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Job Buddy Voice Assistant</h2>
              <button
                onClick={() => setShowVoiceAssistant(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <VoiceNotesWidget />
          </div>
        </div>
      )}

      {isWidgetMenuOpen && availableWidgets.length > 0 && (
        <div className="bg-card text-card-foreground p-4 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-3">Available Widgets</h2>
          <div className="flex flex-wrap gap-2">
            {availableWidgets.map((widget) => (
              <button
                key={widget.id}
                onClick={() => {
                  toggleWidget(widget.type);
                  setIsWidgetMenuOpen(false);
                }}
                className="bg-muted hover:bg-muted/80 px-3 py-1 rounded-md text-sm"
              >
                {widget.type.charAt(0).toUpperCase() + widget.type.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={enabledWidgets.map((w) => w.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 auto-rows-min">
            {enabledWidgets.map((widget) => (
              <DashboardWidget
                key={widget.id}
                id={widget.id}
                type={widget.type}
                size={widget.size}
                onResize={(size) => resizeWidget(widget.id, size)}
                onRemove={() => toggleWidget(widget.type)}
              >
                {widgetComponents[widget.type]}
              </DashboardWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default Dashboard;