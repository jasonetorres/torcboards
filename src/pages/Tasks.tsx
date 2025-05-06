import React, { useState, useEffect, useRef } from 'react'; // Added useRef
import { Plus, Calendar as CalendarIcon, AlertCircle, CheckCircle2, Circle, ArrowUpCircle, ArrowDownCircle, MinusCircle, Edit, Trash2 } from 'lucide-react'; // Added Edit, Trash2
import DatePicker from 'react-datepicker';
import { format, isPast, isToday, isValid } from 'date-fns'; // Added date-fns helpers
import { supabase } from '../lib/supabase';
import { useSelector } from 'react-redux';
import { RootState } from '../store'; // Import RootState
import type { Database } from '../lib/supabase-types';
import "react-datepicker/dist/react-datepicker.css"; // Keep datepicker CSS
import { cn } from '../lib/utils'; // Import cn utility

type Task = Database['public']['Tables']['tasks']['Row'];
type TaskStatus = 'pending' | 'completed' | 'overdue'; // Define status type
type TaskPriority = 'low' | 'medium' | 'high'; // Define priority type

// Interface for form data
interface TaskFormData {
    title: string;
    description: string;
    due_date: Date | null;
    priority: TaskPriority;
    status: TaskStatus; // Use TaskStatus type
}

// Helper function for safe date formatting (Optional but recommended)
const safeFormatDate = (dateInput: string | null | undefined, formatString: string): string | null => {
    if (!dateInput) return null;
    try {
      const date = new Date(dateInput);
      if (!isValid(date)) {
         console.warn("Invalid date value encountered in Tasks:", dateInput);
         return 'Invalid Date';
      }
      return format(date, formatString);
    } catch (e) {
        console.error("Error formatting date in Tasks:", dateInput, e);
        return 'Format Error';
    }
};

const Tasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const user = useSelector((state: RootState) => state.auth.user); // Use RootState
  const formRef = useRef<HTMLDivElement>(null); // Ref for scrolling form into view

  const initialFormData: TaskFormData = {
    title: '',
    description: '',
    due_date: null,
    priority: 'medium',
    status: 'pending'
  };

  const [formData, setFormData] = useState<TaskFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof TaskFormData, string>>>({});

  // --- Data Fetching and State ---
  useEffect(() => {
    if (user) {
      fetchTasks();
    } else {
        setTasks([]);
        setIsAdding(false);
        setEditingId(null);
        setFormData(initialFormData);
        setFormErrors({});
    }
  }, [user]);

  const fetchTasks = async () => {
    if (!user) return;
    try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', user.id)
          .order('status', { ascending: true })
          .order('due_date', { ascending: true, nullsFirst: false });

        if (error) throw error;
        if (data) {
            // No auto-updating status here, handle in display logic
            setTasks(data);
        } else {
            setTasks([]);
        }
    } catch (error) {
        console.error("Error fetching tasks:", error);
        alert(`Failed to load tasks: ${(error as Error).message}`);
    }
  };

  // --- Form Validation ---
  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof TaskFormData, string>> = {};
    if (!formData.title.trim()) errors.title = 'Task title is required.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // --- Form and Task Actions ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !validateForm()) return;

    // Ensure status is valid before saving
    const currentStatus = formData.status === 'overdue' ? 'pending' : formData.status; // Don't save 'overdue' directly

    const taskData = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      // Format date for DB (YYYY-MM-DD) or ISO string depending on column type
      due_date: formData.due_date ? format(formData.due_date, 'yyyy-MM-dd') : null,
      priority: formData.priority,
      status: currentStatus,
      user_id: user.id,
    };

    try {
      let error: any = null;
      let savedTask: Task | null = null;

      if (editingId) {
        const { error: updateError, data: updatedData } = await supabase
          .from('tasks')
          .update({ ...taskData, updated_at: new Date().toISOString() })
          .eq('id', editingId)
          .select()
          .single();
        error = updateError;
        savedTask = updatedData;
      } else {
        const { error: insertError, data: insertedData } = await supabase
          .from('tasks')
          .insert([taskData])
          .select()
          .single();
        error = insertError;
        savedTask = insertedData;
      }

      if (error) throw error;

      // Add/Update calendar event if due date exists and task saved
      if (savedTask && formData.due_date) {
          const calendarEvent = {
              user_id: user.id,
              title: `Task Due: ${formData.title.trim()}`,
              description: formData.description.trim() || '',
              event_date: format(formData.due_date, 'yyyy-MM-dd'),
              event_type: 'task',
              completed: savedTask.status === 'completed',
              related_task_id: savedTask.id // Add this if you have the column
          };
          // Use a stable onConflict target if possible (like related_task_id)
          const { error: calendarError } = await supabase
              .from('calendar_events')
              .upsert(calendarEvent, { onConflict: 'user_id, title, event_date' }); // Adjust onConflict if needed
          if(calendarError) console.error("Error upserting calendar event:", calendarError);
      } else if (editingId && savedTask && !formData.due_date) {
          // If due date was removed, potentially delete related calendar event
          // await supabase.from('calendar_events').delete().eq('related_task_id', editingId); // Example
      }


      handleCancel();
      fetchTasks();

    } catch (error) {
      console.error('Error saving task:', error);
      alert(`Failed to save task: ${(error as Error).message}`);
    }
  };

  const handleEdit = (task: Task) => {
    setEditingId(task.id);
    setFormData({
      title: task.title ?? '',
      description: task.description ?? '',
      due_date: task.due_date ? new Date(task.due_date) : null,
      priority: (task.priority as TaskPriority) ?? 'medium',
      // Load current status, even if calculated display might be 'overdue'
      status: (task.status as TaskStatus) ?? 'pending'
    });
    setFormErrors({});
    setIsAdding(true);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDelete = async (id: string) => {
     if (!window.confirm("Are you sure you want to delete this task?")) return;
     try {
        const { error } = await supabase.from('tasks').delete().eq('id', id);
        if (error) throw error;
        // Optionally delete related calendar event here
        fetchTasks();
        if (id === editingId) handleCancel();
     } catch (error) {
         console.error("Error deleting task:", error);
         alert(`Failed to delete task: ${(error as Error).message}`);
     }
  };

  const toggleComplete = async (task: Task) => {
    if (!user) return;
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';

    try {
        const { error } = await supabase
          .from('tasks')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', task.id);
        if (error) throw error;

        // Update related calendar event if identification is reliable
        if (task.due_date) {
           const { error: calendarError } = await supabase
             .from('calendar_events')
             .update({ completed: newStatus === 'completed' })
             .eq('user_id', user.id)
             // Use a more reliable identifier if possible, e.g., related_task_id
             .eq('title', `Task Due: ${task.title}`)
             .eq('event_date', format(new Date(task.due_date), 'yyyy-MM-dd'));
            if(calendarError) console.warn("Could not update related calendar event status:", calendarError);
        }

        fetchTasks();
    } catch (error) {
        console.error("Error toggling task status:", error);
        alert(`Failed to update task status: ${(error as Error).message}`);
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData(initialFormData);
    setFormErrors({});
 };

  // --- Icon Logic (Functional) ---
  const getPriorityIcon = (priority: TaskPriority) => {
    switch (priority) {
      case 'high': return <ArrowUpCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
      case 'medium': return <MinusCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />;
      case 'low': return <ArrowDownCircle className="h-4 w-4 text-green-500 flex-shrink-0" />;
      default: return <MinusCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />;
    }
  };

  const getStatusIconAndColor = (status: TaskStatus, dueDate: string | null): { icon: React.ReactNode, colorClass: string } => {
     const isOverdue = status === 'pending' && dueDate && isPast(new Date(dueDate)) && !isToday(new Date(dueDate));
     const displayStatus = isOverdue ? 'overdue' : status;

     switch (displayStatus) {
      case 'completed': return { icon: <CheckCircle2 className="h-5 w-5 text-green-500" />, colorClass: 'text-muted-foreground line-through' };
      case 'pending': return { icon: <Circle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />, colorClass: 'text-foreground' };
      case 'overdue': return { icon: <AlertCircle className="h-5 w-5 text-red-500" />, colorClass: 'text-red-600 dark:text-red-400 font-medium' }; // Make overdue text stand out
      default: return { icon: <Circle className="h-5 w-5 text-gray-400" />, colorClass: 'text-foreground' };
    }
  };
  // ---------------------------------------------------------

  return (
    // --- Main Layout Wrapper (Corrected) ---
    <main className="min-h-screen w-full relative flex justify-center px-4 pt-16 pb-16 overflow-y-auto">
      {/* Background Image and Overlay (Corrected) */}
      <div className="fixed inset-0 z-0">
        <img
          src="https://img.heroui.chat/image/landscape?w=1920&h=1080&u=1"
          className="w-full h-full object-cover"
          alt="Background"
        />
        <div className="absolute inset-0 bg-black/20" /> {/* Correct overlay */}
      </div>

      {/* Content Area (Corrected) */}
      <div className="w-full max-w-4xl z-10"> {/* Adjusted max-width for Tasks list */}
        <div className="space-y-6"> {/* Added consistent spacing */}

          {/* Header Section (Already Fixed) */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-bold text-white mix-blend-screen">Tasks</h1>
            {!isAdding && (
                <button
                  onClick={() => { setIsAdding(true); setEditingId(null); setFormData(initialFormData); setFormErrors({}); formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md flex items-center justify-center gap-2 text-sm transition-colors shadow-sm"
                  title="Add a new task"
                >
                  <Plus className="h-5 w-5" />
                  <span>Add Task</span>
                </button>
            )}
          </div>
          {/* End Header Section */}


          {/* Add/Edit Form (Conditional & Styled Card) */}
          <div ref={formRef}>
              {isAdding && (
                // --- Styled Form Card ---
                <div className="bg-card/80 backdrop-blur-sm shadow-lg border-border/50 p-6 rounded-lg text-card-foreground">
                  <h2 className="text-xl font-semibold mb-4">
                    {editingId ? 'Edit Task' : 'Add New Task'}
                  </h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Title Input */}
                    <div>
                      <label htmlFor="title" className="block text-sm font-medium mb-1 text-card-foreground/80"> Title * </label>
                      <input
                        id="title" type="text" value={formData.title}
                        onChange={(e) => { setFormData({ ...formData, title: e.target.value }); setFormErrors({...formErrors, title: undefined}); }}
                        className={cn("w-full p-2 rounded border bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm", formErrors.title ? 'border-red-500' : 'border-input')}
                        required aria-describedby={formErrors.title ? "title-error" : undefined}
                      />
                       {formErrors.title && <p id="title-error" className="text-xs text-red-500 mt-1">{formErrors.title}</p>}
                    </div>
                    {/* Description Textarea */}
                    <div>
                      <label htmlFor="description" className="block text-sm font-medium mb-1 text-card-foreground/80"> Description </label>
                      <textarea
                        id="description" value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm min-h-[80px]"
                        rows={3}
                      />
                    </div>
                    {/* Grid for Due Date, Priority, Status */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="relative">
                        <label htmlFor="due_date" className="block text-sm font-medium mb-1 text-card-foreground/80"> Due Date </label>
                        <DatePicker
                          id="due_date" selected={formData.due_date}
                          onChange={(date) => setFormData({ ...formData, due_date: date })}
                          className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm" // Consistent style
                          wrapperClassName="w-full"
                          popperClassName="z-30"
                          dateFormat="MMM d, yyyy"
                          isClearable placeholderText="Optional"
                        />
                      </div>
                      <div>
                        <label htmlFor="priority" className="block text-sm font-medium mb-1 text-card-foreground/80"> Priority </label>
                        <select
                          id="priority" value={formData.priority}
                          onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                          className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm capitalize appearance-none bg-chevron-down bg-no-repeat bg-right" // Consistent style
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="status" className="block text-sm font-medium mb-1 text-card-foreground/80"> Status </label>
                        <select
                          id="status" value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                          className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm capitalize appearance-none bg-chevron-down bg-no-repeat bg-right" // Consistent style
                        >
                          <option value="pending">Pending</option>
                          <option value="completed">Completed</option>
                          {/* Don't allow setting overdue manually */}
                        </select>
                      </div>
                    </div>
                    {/* Form Actions */}
                    <div className="flex gap-2 pt-2">
                      <button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md transition-colors text-sm font-medium shadow-sm" >
                        {editingId ? 'Update Task' : 'Add Task'}
                      </button>
                      <button type="button" onClick={handleCancel} className="bg-muted hover:bg-muted/80 text-muted-foreground px-4 py-2 rounded-md transition-colors text-sm font-medium" >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
          </div>
          {/* End Add/Edit Form */}


           {/* Message When No Tasks */}
           {!isAdding && tasks.length === 0 && (
             <div className="bg-card/80 backdrop-blur-sm shadow-lg border-border/50 p-6 rounded-lg text-center text-muted-foreground">
                 No tasks found. Click "Add Task" to create one!
             </div>
           )}

          {/* Task List (Styled Cards) */}
          <div className="space-y-3"> {/* Consistent spacing for list items */}
            {tasks.map((task) => {
               const { icon: statusIcon, colorClass: statusColorClass } = getStatusIconAndColor(task.status as TaskStatus, task.due_date);
               return (
                  // --- Styled Task Card ---
                  <div
                    key={task.id}
                    className={cn(
                        "bg-card/80 backdrop-blur-sm shadow-lg border-l-4 rounded-lg text-card-foreground transition-all hover:shadow-primary/10",
                        task.priority === 'high' ? 'border-red-500' : task.priority === 'medium' ? 'border-yellow-500' : task.priority === 'low' ? 'border-green-500' : 'border-border/50',
                        task.status === 'completed' ? 'opacity-60' : ''
                    )}
                  >
                    <div className="p-4 flex items-start gap-3 sm:gap-4"> {/* Consistent padding & gap */}
                       {/* Status Toggle Button */}
                       <button onClick={() => toggleComplete(task)} className="mt-1 flex-shrink-0" title={`Mark as ${task.status === 'completed' ? 'pending' : 'completed'}`}>
                         {statusIcon}
                       </button>
                        {/* Task Details */}
                       <div className="flex-grow min-w-0"> {/* Allow text to wrap/truncate */}
                         <h3 className={cn("text-base font-medium", statusColorClass)}>
                           {task.title}
                         </h3>
                         {task.description && (
                           <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                         )}
                         <div className="flex items-center gap-4 mt-2 flex-wrap"> {/* Wrap details on small screens */}
                           {task.due_date && (
                             <div className={cn("flex items-center gap-1 text-xs", statusColorClass === 'text-foreground' ? 'text-muted-foreground' : statusColorClass )}> {/* Inherit color unless default */}
                               <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0" />
                               Due: {safeFormatDate(task.due_date, 'MMM d, yyyy')}
                             </div>
                           )}
                           <div className="flex items-center gap-1 text-xs text-muted-foreground capitalize">
                             {getPriorityIcon(task.priority as TaskPriority)}
                             {task.priority}
                           </div>
                         </div>
                       </div>
                       {/* Action Buttons (Icons) */}
                       <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => handleEdit(task)} className="text-muted-foreground hover:text-primary p-1 rounded-full hover:bg-primary/10 transition-colors" title="Edit Task" >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(task.id)} className="text-muted-foreground hover:text-destructive p-1 rounded-full hover:bg-destructive/10 transition-colors" title="Delete Task" >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                    </div>
                  </div>
               );
            })}
          </div>
          {/* End Task List */}

        </div> {/* End Space Y */}
      </div> {/* End Content Area */}
    </main> // End Main Page Container
  );
};

export default Tasks;