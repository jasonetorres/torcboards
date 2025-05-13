import React, { useState, useEffect, useRef, useCallback } from 'react';
// --- Corrected Lucide Icons Import ---
import {
    Plus, Calendar as CalendarIcon, AlertCircle, CheckCircle2, Circle,
    ArrowUpCircle, ArrowDownCircle, MinusCircle, // Added missing priority icons
    Edit, Trash2, Filter, X as ClearFilterIcon
} from 'lucide-react';
// -------------------------------------
import DatePicker from 'react-datepicker';
import { format, isValid, isPast, isToday } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import type { Database } from '../lib/supabase-types';
import "react-datepicker/dist/react-datepicker.css";
import { cn } from '../lib/utils';

// --- Type Definitions ---
type TaskDbRow = Database['public']['Tables']['tasks']['Row'];
type Task = TaskDbRow & {
    source?: string;
};

type TaskPriorityValue = 'low' | 'medium' | 'high';
type TaskPriorityFilter = 'all' | TaskPriorityValue;

type TaskStatusValue = 'pending' | 'completed';
type TaskStatusFilter = 'all' | TaskStatusValue | 'overdue';

type TaskSourceFilter = 'all' | 'manual' | 'voice_command_task' | 'voice_calendar_event' | 'ai_reminder' | 'ai_schedule' | 'ai_generated' | string;

interface TaskFormData {
    title: string;
    description: string;
    due_date: Date | null;
    priority: TaskPriorityValue;
    status: TaskStatusValue;
}

// Helper function for safe date formatting
const safeFormatDate = (dateInput: string | null | undefined, formatString: string): string | null => {
    if (!dateInput) return null;
    try {
      const date = new Date(dateInput);
      if (!isValid(date)) { return 'Invalid Date'; }
      return format(date, formatString);
    } catch (e) { return 'Format Error'; }
};

const Tasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const user = useSelector((state: RootState) => state.auth.user);
  const formRef = useRef<HTMLDivElement>(null);

  const initialFormData: TaskFormData = {
    title: '', description: '', due_date: null, priority: 'medium', status: 'pending'
  };
  const [formData, setFormData] = useState<TaskFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof TaskFormData, string>>>({});

  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriorityFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<TaskSourceFilter>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<{ start: Date | null, end: Date | null }>({ start: null, end: null });
  const [showFilters, setShowFilters] = useState(false);

  const sourceOptions: {value: TaskSourceFilter, label: string}[] = [
    { value: 'all', label: 'All Sources' }, { value: 'manual', label: 'Manual' },
    { value: 'voice_command_task', label: 'Voice (Direct Task)' }, { value: 'voice_calendar_event', label: 'Voice (From Calendar)' },
    { value: 'ai_reminder', label: 'AI Reminder' }, { value: 'ai_schedule', label: 'AI Schedule' },
    { value: 'ai_generated', label: 'AI Other' },
  ];

  const fetchTasks = useCallback(async () => {
    // ... (fetchTasks logic remains the same as previous correct version) ...
    if (!user) return;
    try {
      let query = supabase.from('tasks').select('*').eq('user_id', user.id);
      if (statusFilter !== 'all') {
        if (statusFilter === 'overdue') { query = query.eq('status', 'pending').lt('due_date', format(new Date(), 'yyyy-MM-dd')); }
        else { query = query.eq('status', statusFilter); }
      }
      if (priorityFilter !== 'all') { query = query.eq('priority', priorityFilter); }
      if (sourceFilter !== 'all') { query = query.eq('source', sourceFilter); }
      if (dateRangeFilter.start) { query = query.gte('due_date', format(dateRangeFilter.start, 'yyyy-MM-dd')); }
      if (dateRangeFilter.end) { query = query.lte('due_date', format(dateRangeFilter.end, 'yyyy-MM-dd')); }
      query = query.order('status', { ascending: true }).order('due_date', { ascending: true, nullsFirst: false });
      const { data, error } = await query;
      if (error) throw error;
      setTasks(data || []);
    } catch (error) { console.error("Error fetching tasks:", error); alert(`Failed to load tasks: ${(error as Error).message}`); setTasks([]); }
  }, [user, statusFilter, priorityFilter, sourceFilter, dateRangeFilter]);

  useEffect(() => { if (user) { fetchTasks(); } }, [user, fetchTasks]);

  const validateForm = (): boolean => { /* ... */ return true; };

  const handleSubmit = async (e: React.FormEvent) => {
    // ... (handleSubmit logic remains the same as previous correct version) ...
    e.preventDefault();
    if (!user || !validateForm()) return;
    const taskDataPayload: Partial<Task> = { title: formData.title.trim(), description: formData.description.trim() || null, due_date: formData.due_date ? format(formData.due_date, 'yyyy-MM-dd') : null, priority: formData.priority, status: formData.status, user_id: user.id, };
    if (!editingId) { taskDataPayload.source = 'manual'; }
    try {
      let error: any = null; let savedTask: Task | null = null;
      if (editingId) {
        const { error: updateError, data: updatedData } = await supabase.from('tasks').update({ ...taskDataPayload, updated_at: new Date().toISOString() }).eq('id', editingId).select().single();
        error = updateError; savedTask = updatedData;
      } else {
        const { error: insertError, data: insertedData } = await supabase.from('tasks').insert([taskDataPayload as TaskDbRow]).select().single();
        error = insertError; savedTask = insertedData;
      }
      if (error) throw error;
      if (savedTask && formData.due_date && formData.title /* Ensure title exists */) {
          const calendarEvent = { user_id: user.id, title: `Task Due: ${formData.title.trim()}`, description: formData.description.trim() || '', event_date: format(formData.due_date, 'yyyy-MM-dd'), event_type: 'task', completed: savedTask.status === 'completed', related_task_id: savedTask.id };
          const { error: calendarError } = await supabase.from('calendar_events').upsert(calendarEvent, { onConflict: 'user_id, title, event_date' });
          if(calendarError) console.error("Error upserting calendar event:", calendarError);
      }
      handleCancel(); fetchTasks();
    } catch (error) { console.error('Error saving task:', error); alert(`Failed to save task: ${(error as Error).message}`); }
  };
  const handleEdit = (task: Task) => { /* ... */ setIsAdding(true); setFormData({title: task.title ?? '', description: task.description ?? '', due_date: task.due_date ? new Date(task.due_date) : null, priority: (task.priority as TaskPriorityValue) ?? 'medium', status: (task.status === 'overdue' ? 'pending' : task.status as TaskStatusValue) ?? 'pending'}); setEditingId(task.id); setFormErrors({}); formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const handleDelete = async (id: string) => { /* ... */ if (!window.confirm("Are you sure?")) return; try { const { error } = await supabase.from('tasks').delete().eq('id', id); if (error) throw error; fetchTasks(); if (id === editingId) handleCancel(); } catch (error) { console.error("Error deleting task:", error); alert(`Failed to delete task: ${(error as Error).message}`); } };
  const toggleComplete = async (task: Task) => { /* ... */ if (!user) return; const newStatus = task.status === 'completed' ? 'pending' : 'completed'; try { const { error } = await supabase.from('tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', task.id); if (error) throw error; if (task.due_date && task.title) { await supabase.from('calendar_events').update({ completed: newStatus === 'completed' }).eq('user_id', user.id).eq('title', `Task Due: ${task.title}`).eq('event_date', format(new Date(task.due_date), 'yyyy-MM-dd')); } fetchTasks(); } catch (error) { console.error("Error toggling task status:", error); alert(`Failed to update task status: ${(error as Error).message}`); } };
  const handleCancel = () => { /* ... */ setIsAdding(false); setEditingId(null); setFormData(initialFormData); setFormErrors({}); };


  // --- Corrected getPriorityIcon with specific type and correct icons ---
  const getPriorityIcon = (priority: TaskPriorityValue | string | null): React.ReactNode => {
    switch (priority) {
      case 'high':
        return <ArrowUpCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
      case 'medium':
        return <MinusCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />;
      case 'low':
        return <ArrowDownCircle className="h-4 w-4 text-green-500 flex-shrink-0" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400 flex-shrink-0" />;
    }
  };

  const getStatusIconAndColor = (status: Task['status'], dueDate: string | null): { icon: React.ReactNode, colorClass: string, label: string } => {
    // Ensure dueDate is valid before using isPast/isToday
    const validDueDate = dueDate && isValid(new Date(dueDate)) ? new Date(dueDate) : null;
    const effectiveStatus = (status === 'pending' && validDueDate && isPast(validDueDate) && !isToday(validDueDate)) ? 'overdue' : status;

    switch (effectiveStatus) {
      case 'completed': return { icon: <CheckCircle2 className="h-5 w-5 text-green-500" />, colorClass: 'text-muted-foreground line-through', label: 'Completed' };
      case 'pending': return { icon: <Circle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />, colorClass: 'text-foreground', label: 'Pending' };
      case 'overdue': return { icon: <AlertCircle className="h-5 w-5 text-red-500" />, colorClass: 'text-red-600 dark:text-red-400 font-medium', label: 'Overdue' };
      default: return { icon: <Circle className="h-5 w-5 text-gray-400" />, colorClass: 'text-foreground', label: String(status) };
    }
  };
  const clearFilters = () => { setStatusFilter('all'); setPriorityFilter('all'); setSourceFilter('all'); setDateRangeFilter({ start: null, end: null }); };

  // --- Return JSX (structure remains the same, ensure form elements and task list items have consistent styling) ---
  return (
    <main className="min-h-screen w-full relative flex justify-center px-4 pt-16 pb-16 overflow-y-auto">
      <div className="fixed inset-0 z-0"> <img src="https://img.heroui.chat/image/landscape?w=1920&h=1080&u=1" className="w-full h-full object-cover" alt="Background"/> <div className="absolute inset-0 bg-black/20" /> </div>
      <div className="w-full max-w-4xl z-10">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-bold text-white mix-blend-screen">Tasks</h1>
            <div className="flex gap-2 items-center">
              <button onClick={() => setShowFilters(!showFilters)} className="bg-muted/70 hover:bg-muted text-foreground px-3 py-2 rounded-md flex items-center gap-1.5 text-sm transition-colors shadow-sm" title={showFilters ? "Hide Filters" : "Show Filters"} > <Filter className="h-4 w-4" /> <span>Filters</span> </button>
              {!isAdding && ( <button onClick={() => { setIsAdding(true); setEditingId(null); setFormData(initialFormData); setFormErrors({}); formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md flex items-center justify-center gap-2 text-sm transition-colors shadow-sm" title="Add a new task" > <Plus className="h-5 w-5" /> <span>Add Task</span> </button> )}
            </div>
          </div>

          {/* Filter Section */}
          {showFilters && (
            <div className="bg-card/80 backdrop-blur-sm shadow-md border-border/50 p-4 rounded-lg text-card-foreground space-y-4">
              <h3 className="text-lg font-semibold mb-2 text-card-foreground">Filter Tasks</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
                <div> <label htmlFor="statusFilter" className="block text-xs font-medium mb-1 text-card-foreground/80">Status</label> <select id="statusFilter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TaskStatusFilter)} className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm capitalize appearance-none bg-chevron-down bg-no-repeat bg-right"> <option value="all">All Statuses</option> <option value="pending">Pending</option> <option value="completed">Completed</option> <option value="overdue">Overdue</option> </select> </div>
                <div> <label htmlFor="priorityFilter" className="block text-xs font-medium mb-1 text-card-foreground/80">Priority</label> <select id="priorityFilter" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as TaskPriorityFilter)} className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm capitalize appearance-none bg-chevron-down bg-no-repeat bg-right"> <option value="all">All Priorities</option> <option value="low">Low</option> <option value="medium">Medium</option> <option value="high">High</option> </select> </div>
                <div> <label htmlFor="sourceFilter" className="block text-xs font-medium mb-1 text-card-foreground/80">Source</label> <select id="sourceFilter" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as TaskSourceFilter)} className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm capitalize appearance-none bg-chevron-down bg-no-repeat bg-right"> {sourceOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> </div>
                <div className="relative"> <label htmlFor="startDateFilter" className="block text-xs font-medium mb-1 text-card-foreground/80">Due After</label> <DatePicker id="startDateFilter" selected={dateRangeFilter.start} onChange={(date) => setDateRangeFilter(prev => ({...prev, start: date}))} className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm" wrapperClassName="w-full" popperClassName="z-30" dateFormat="MMM d, yyyy" isClearable placeholderText="Start Date"/> </div>
                <div className="relative"> <label htmlFor="endDateFilter" className="block text-xs font-medium mb-1 text-card-foreground/80">Due Before</label> <DatePicker id="endDateFilter" selected={dateRangeFilter.end} onChange={(date) => setDateRangeFilter(prev => ({...prev, end: date}))} className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm" wrapperClassName="w-full" popperClassName="z-30" dateFormat="MMM d, yyyy" isClearable placeholderText="End Date"/> </div>
                <div className="flex items-end"> <button onClick={clearFilters} className="bg-muted hover:bg-muted/80 text-muted-foreground px-3 py-2 rounded-md flex items-center gap-1.5 text-xs transition-colors w-full justify-center"> <ClearFilterIcon className="h-3.5 w-3.5" /> Clear Filters </button> </div>
              </div>
            </div>
          )}

          {/* Add/Edit Form */}
          <div ref={formRef}> {isAdding && ( <div className="bg-card/80 backdrop-blur-sm shadow-lg border-border/50 p-6 rounded-lg text-card-foreground"> <h2 className="text-xl font-semibold mb-4">{editingId ? 'Edit Task' : 'Add New Task'}</h2> <form onSubmit={handleSubmit} className="space-y-4"> <div><label htmlFor="title_form" className="block text-sm font-medium mb-1 text-card-foreground/80"> Title * </label><input id="title_form" type="text" value={formData.title} onChange={(e) => { setFormData({ ...formData, title: e.target.value }); setFormErrors({...formErrors, title: undefined}); }} className={cn("w-full p-2 rounded border bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm", formErrors.title ? 'border-red-500' : 'border-input')} required aria-describedby={formErrors.title ? "title-error" : undefined} /> {formErrors.title && <p id="title-error" className="text-xs text-red-500 mt-1">{formErrors.title}</p>}</div><div><label htmlFor="description_form" className="block text-sm font-medium mb-1 text-card-foreground/80"> Description </label><textarea id="description_form" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm min-h-[80px]" rows={3} /></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="relative"><label htmlFor="due_date_form" className="block text-sm font-medium mb-1 text-card-foreground/80"> Due Date </label><DatePicker id="due_date_form" selected={formData.due_date} onChange={(date) => setFormData({ ...formData, due_date: date })} className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm" wrapperClassName="w-full" popperClassName="z-30" dateFormat="MMM d, yyyy" isClearable placeholderText="Optional"/></div><div><label htmlFor="priority_form" className="block text-sm font-medium mb-1 text-card-foreground/80"> Priority </label><select id="priority_form" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriorityValue })} className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm capitalize appearance-none bg-chevron-down bg-no-repeat bg-right"> <option value="low">Low</option> <option value="medium">Medium</option> <option value="high">High</option> </select></div><div><label htmlFor="status_form" className="block text-sm font-medium mb-1 text-card-foreground/80"> Status </label><select id="status_form" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatusValue })} className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm capitalize appearance-none bg-chevron-down bg-no-repeat bg-right"> <option value="pending">Pending</option> <option value="completed">Completed</option> </select></div></div><div className="flex gap-2 pt-2"><button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md transition-colors text-sm font-medium shadow-sm">{editingId ? 'Update Task' : 'Add Task'}</button><button type="button" onClick={handleCancel} className="bg-muted hover:bg-muted/80 text-muted-foreground px-4 py-2 rounded-md transition-colors text-sm font-medium">Cancel</button></div></form> </div> )} </div>

          {/* Task List */}
          {!isAdding && tasks.length === 0 && ( <div className="bg-card/80 backdrop-blur-sm shadow-lg border-border/50 p-6 rounded-lg  text-center text-muted-foreground"> No tasks match your current filters. Try adjusting them or click "Add Task" to create one! </div> )}
          <div className="space-y-3">
            {tasks.map((task) => {
               const { icon: statusIcon, colorClass: statusColorClass, label: statusLabel } = getStatusIconAndColor(task.status as TaskStatusValue, task.due_date);
               const priorityIconDisplay = getPriorityIcon(task.priority as TaskPriorityValue);
               return (
                  <div key={task.id} className={cn( "bg-card/80 backdrop-blur-sm shadow-lg border-l-4 rounded-lg text-card-foreground transition-all hover:shadow-primary/10", task.priority === 'high' ? 'border-red-500' : task.priority === 'medium' ? 'border-yellow-500' : task.priority === 'low' ? 'border-green-500' : 'border-border/50', task.status === 'completed' ? 'opacity-60' : '' )} >
                    <div className="p-4 flex items-start gap-3 sm:gap-4">
                       <button onClick={() => toggleComplete(task)} className="mt-1 flex-shrink-0" title={`Mark as ${statusLabel === 'Completed' ? 'pending' : 'completed'}`}> {statusIcon} </button>
                       <div className="flex-grow min-w-0">
                         <h3 className={cn("text-base font-medium", statusColorClass)}> {task.title} </h3>
                         {task.description && ( <p className="text-sm text-muted-foreground mt-1">{task.description}</p> )}
                         <div className="flex items-center gap-x-4 gap-y-1 mt-2 flex-wrap">
                           {task.due_date && ( <div className={cn("flex items-center gap-1 text-xs", statusColorClass === 'text-foreground' ? 'text-muted-foreground' : statusColorClass )}> <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0" /> Due: {safeFormatDate(task.due_date, 'MMM d, yyyy')} </div> )}
                           <div className="flex items-center gap-1 text-xs text-muted-foreground capitalize"> {priorityIconDisplay} {task.priority} </div>
                           {task.source && ( <div className="flex items-center gap-1 text-xs text-muted-foreground capitalize border border-dashed border-border/30 px-1.5 py-0.5 rounded-sm"> {task.source.replace(/_/g, ' ')} </div> )}
                         </div>
                       </div>
                       <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => handleEdit(task)} className="text-muted-foreground hover:text-primary p-1 rounded-full hover:bg-primary/10 transition-colors" title="Edit Task" > <Edit className="h-4 w-4" /> </button>
                          <button onClick={() => handleDelete(task.id)} className="text-muted-foreground hover:text-destructive p-1 rounded-full hover:bg-destructive/10 transition-colors" title="Delete Task" > <Trash2 className="h-4 w-4" /> </button>
                        </div>
                    </div>
                  </div>
               );
            })}
          </div>
        </div>
      </div>
    </main>
  );
};

export default Tasks;