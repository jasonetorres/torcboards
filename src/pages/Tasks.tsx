import React, { useState, useEffect } from 'react';
import { Plus, Calendar as CalendarIcon, AlertCircle, CheckCircle2, Circle, ArrowUpCircle, ArrowDownCircle, MinusCircle } from 'lucide-react';
import DatePicker from 'react-datepicker';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useSelector } from 'react-redux'; // Import useSelector
import type { Database } from '../lib/supabase-types';

type Task = Database['public']['Tables']['tasks']['Row'];

const Tasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: null as Date | null,
    priority: 'medium',
    status: 'pending'
  });
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
      .order('due_date', { ascending: true });

    if (data) setTasks(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const taskData = {
      ...formData,
      due_date: formData.due_date?.toISOString(),
      user_id: user.id
    };

    if (editingId) {
      const { error } = await supabase
        .from('tasks')
        .update({
          ...taskData,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingId);

      if (!error) {
        // Add to calendar if there's a due date
        if (formData.due_date) {
          await supabase.from('calendar_events').upsert({
            user_id: user.id,
            title: `Task Due: ${formData.title}`,
            description: formData.description,
            event_date: formData.due_date.toISOString().split('T')[0],
            event_type: 'task',
            completed: false
          }, {
            onConflict: 'user_id,title,event_date'
          });
        }

        setEditingId(null);
        fetchTasks();
      }
    } else {
      const { error, data } = await supabase
        .from('tasks')
        .insert([taskData])
        .select()
        .single();

      if (!error && data) {
        // Add to calendar if there's a due date
        if (formData.due_date) {
          await supabase.from('calendar_events').insert({
            user_id: user.id,
            title: `Task Due: ${formData.title}`,
            description: formData.description,
            event_date: formData.due_date.toISOString().split('T')[0],
            event_type: 'task',
            completed: false
          });
        }

        setIsAdding(false);
        fetchTasks();
      }
    }

    setFormData({
      title: '',
      description: '',
      due_date: null,
      priority: 'medium',
      status: 'pending'
    });
  };

  const handleEdit = (task: Task) => {
    setEditingId(task.id);
    setFormData({
      title: task.title,
      description: task.description || '',
      due_date: task.due_date ? new Date(task.due_date) : null,
      priority: task.priority,
      status: task.status
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (!error) {
      fetchTasks();
    }
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
        return <ArrowUpCircle className="h-5 w-5 text-red-500" />;
      case 'medium':
        return <MinusCircle className="h-5 w-5 text-yellow-500" />;
      case 'low':
        return <ArrowDownCircle className="h-5 w-5 text-green-500" />;
      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'pending':
        return <Circle className="h-5 w-5 text-yellow-500" />;
      case 'overdue':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen w-full relative flex flex-col items-start justify-start p-4">
      <div className="fixed inset-0 z-0">
        <img
          src="https://img.heroui.chat/image/landscape?w=1920&h=1080&u=1"
          className="w-full h-full object-cover"
          alt="Dashboard Background"
        />
        <div className="absolute inset-0 bg-background/" />
      </div>
      <div className="w-full max-w-7xl z-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Tasks</h1>
          <button
            onClick={() => setIsAdding(true)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md items-center gap-2 mt-4 inline-flex"
          >
            <Plus className="h-5 w-5" />
            Add Task
          </button>
        </div>

        {isAdding && (
          <div className="bg-card text-card-foreground p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingId ? 'Edit Task' : 'Add New Task'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium mb-1 text-foreground">
                  Title
                </label>
                <input
                  id="title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full p-2 rounded border border-input bg-background text-foreground"
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium mb-1 text-foreground">
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2 rounded border border-input bg-background text-foreground"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="due_date" className="block text-sm font-medium mb-1 text-foreground">
                    Due Date
                  </label>
                  <DatePicker
                    selected={formData.due_date}
                    onChange={(date) => setFormData({ ...formData, due_date: date })}
                    className="w-full p-2 rounded border border-input bg-background text-foreground"
                    dateFormat="MMM d,yyyy"
                    isClearable
                  />
                </div>

                <div>
                  <label htmlFor="priority" className="block text-sm font-medium mb-1 text-foreground">
                    Priority
                  </label>
                  <select
                    id="priority"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full p-2 rounded border border-input bg-background text-foreground"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-medium mb-1 text-foreground">
                    Status
                  </label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full p-2 rounded border border-input bg-background text-foreground"
                  >
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md"
                >
                  {editingId ? 'Update' : 'Add'} Task
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingId(null);
                    setFormData({
                      title: '',
                      description: '',
                      due_date: null,
                      priority: 'medium',
                      status: 'pending'
                    });
                  }}
                  className="bg-muted text-muted-foreground px-4 py-2 rounded-md"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`bg-card text-card-foreground p-6 rounded-lg shadow-md w-full ${
                task.status === 'completed' ? 'opacity-75' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start justify-between">
                <div className="flex items-start gap-4 mb-2 sm:mb-0">
                  <button
                    onClick={() => toggleComplete(task)}
                    className="mt-1"
                  >
                    {getStatusIcon(task.status)}
                  </button>
                  <div>
                    <h3 className={`text-lg font-medium text-foreground ${
                      task.status === 'completed' ? 'line-through text-muted-foreground' : ''
                    }`}>
                      {task.title}
                    </h3>
                    {task.description && (
                      <p className="text-muted-foreground mt-1">{task.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      {task.due_date && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <CalendarIcon className="h-4 w-4" />
                          {format(new Date(task.due_date), 'MMM d,yyyy')}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        {getPriorityIcon(task.priority)}
                        <span className="text-sm capitalize text-muted-foreground">{task.priority} priority</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(task)}
                    className="text-primary hover:text-primary/80"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="text-destructive hover:text-destructive/80"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
};

export default Tasks;