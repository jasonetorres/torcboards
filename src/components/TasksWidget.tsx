import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Circle, CheckCircle2, ArrowUpCircle, MinusCircle, ArrowDownCircle } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useSelector } from 'react-redux'; // Import useSelector
import type { Database } from '../lib/supabase-types';

type Task = Database['public']['Tables']['tasks']['Row'];

export function TasksWidget() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const user = useSelector((state: any) => state.auth.user); // Use useSelector

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  const fetchTasks = async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user!.id)
      .order('due_date', { ascending: true })
      .limit(5); // Limiting to 5 for the widget

    if (data) setTasks(data);
  };

  const toggleComplete = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';

    const { error } = await supabase
      .from('tasks')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', task.id);

    if (!error) {
      // Update calendar event if it exists
      if (task.due_date) {
        await supabase
          .from('calendar_events')
          .update({
            completed: newStatus === 'completed'
          })
          .eq('user_id', user!.id)
          .eq('title', `Task Due: ${task.title}`)
          .eq('event_date', task.due_date);
      }

      fetchTasks();
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <ArrowUpCircle className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <MinusCircle className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <ArrowDownCircle className="h-4 w-4 text-green-500" />;
      default:
        return null;
    }
  };

  return (
    <>
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <CheckSquare className="h-5 w-5" />
        Recent Tasks
      </h2>
      <div className="space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`p-3 bg-muted rounded-md ${
              task.status === 'completed' ? 'opacity-75' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <button
                onClick={() => toggleComplete(task)}
                className="mt-1"
              >
                {task.status === 'completed' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Circle className="h-4 w-4 text-yellow-500" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <h3 className={`font-medium truncate ${
                  task.status === 'completed' ? 'line-through text-muted-foreground' : ''
                }`}>
                  {task.title}
                </h3>
                {task.due_date && (
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <span>Due: {format(new Date(task.due_date), 'MMM d')}</span>
                    {getPriorityIcon(task.priority)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <Link to="/tasks" className="text-primary hover:underline text-sm block mt-4">
        View all tasks →
      </Link>
    </>
  );
}

export default TasksWidget;