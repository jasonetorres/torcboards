import React, { useState, useEffect } from 'react';
import { Plus, Calendar as CalendarIcon } from 'lucide-react';
import DatePicker from 'react-datepicker';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { generateSmartReminders } from '../lib/openai';
import type { Database } from '../lib/supabase-types';
import "react-datepicker/dist/react-datepicker.css";

type Application = Database['public']['Tables']['applications']['Row'];

const Applications = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    company_name: '',
    position: '',
    status: 'draft',
    applied_date: null as Date | null,
    notes: '',
    next_follow_up: null as Date | null
  });
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (user) {
      fetchApplications();
    }
  }, [user]);

  const fetchApplications = async () => {
    const { data } = await supabase
      .from('applications')
      .select(`
        *,
        companies (
          name,
          website
        )
      `)
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (data) setApplications(data);
  };

  const generateReminders = async (application: Application) => {
    try {
      const reminders = await generateSmartReminders(new Date(), [application]);
      const { error } = await supabase
        .from('applications')
        .update({
          notes: application.notes ? `${application.notes}\n\n${reminders}` : reminders,
          updated_at: new Date().toISOString()
        })
        .eq('id', application.id);

      if (!error) {
        fetchApplications();
      }
    } catch (error) {
      console.error('Error generating reminders:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      // First, create or find the company
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .eq('name', formData.company_name)
        .eq('user_id', user.id);

      let company_id;
      
      if (!companies || companies.length === 0) {
        // Company doesn't exist, create it
        const { data: newCompany, error: createError } = await supabase
          .from('companies')
          .insert([{
            name: formData.company_name,
            user_id: user.id,
            status: 'interested'
          }])
          .select()
          .single();

        if (createError) throw createError;
        company_id = newCompany.id;
      } else {
        company_id = companies[0].id;
      }

      const applicationData = {
        position: formData.position,
        status: formData.status,
        applied_date: formData.applied_date?.toISOString(),
        next_follow_up: formData.next_follow_up?.toISOString(),
        notes: formData.notes,
        company_id,
        user_id: user.id
      };

      if (editingId) {
        const { error: updateError, data } = await supabase
          .from('applications')
          .update({
            ...applicationData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId)
          .select()
          .single();

        if (!updateError && data) {
          setEditingId(null);
          generateReminders(data);
          fetchApplications();
        }
      } else {
        const { error: insertError, data } = await supabase
          .from('applications')
          .insert([applicationData])
          .select()
          .single();

        if (!insertError && data) {
          setIsAdding(false);
          generateReminders(data);
          fetchApplications();
        }
      }

      setFormData({
        company_name: '',
        position: '',
        status: 'draft',
        applied_date: null,
        notes: '',
        next_follow_up: null
      });
    } catch (error) {
      console.error('Error saving application:', error);
    }
  };

  const handleEdit = (application: any) => {
    setEditingId(application.id);
    setFormData({
      company_name: application.companies.name,
      position: application.position,
      status: application.status,
      applied_date: application.applied_date ? new Date(application.applied_date) : null,
      notes: application.notes || '',
      next_follow_up: application.next_follow_up ? new Date(application.next_follow_up) : null
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('applications')
      .delete()
      .eq('id', id);

    if (!error) {
      fetchApplications();
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-gray-200 text-gray-800',
      applied: 'bg-blue-200 text-blue-800',
      interviewing: 'bg-yellow-200 text-yellow-800',
      offered: 'bg-green-200 text-green-800',
      rejected: 'bg-red-200 text-red-800',
      accepted: 'bg-purple-200 text-purple-800',
      withdrawn: 'bg-gray-200 text-gray-800'
    };
    return colors[status as keyof typeof colors] || colors.draft;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Job Applications</h1>
        <button
          onClick={() => setIsAdding(true)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Add Application
        </button>
      </div>

      {isAdding && (
        <div className="bg-card text-card-foreground p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? 'Edit Application' : 'Add New Application'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="company_name" className="block text-sm font-medium mb-1">
                Company Name
              </label>
              <input
                id="company_name"
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full p-2 rounded border border-input bg-background"
                required
              />
            </div>
            <div>
              <label htmlFor="position" className="block text-sm font-medium mb-1">
                Position
              </label>
              <input
                id="position"
                type="text"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="w-full p-2 rounded border border-input bg-background"
                required
              />
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium mb-1">
                Status
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full p-2 rounded border border-input bg-background"
              >
                <option value="draft">Draft</option>
                <option value="applied">Applied</option>
                <option value="interviewing">Interviewing</option>
                <option value="offered">Offered</option>
                <option value="rejected">Rejected</option>
                <option value="accepted">Accepted</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>
            <div>
              <label htmlFor="applied_date" className="block text-sm font-medium mb-1">
                Applied Date
              </label>
              <DatePicker
                selected={formData.applied_date}
                onChange={(date) => setFormData({ ...formData, applied_date: date })}
                className="w-full p-2 rounded border border-input bg-background"
                dateFormat="MMM d, yyyy"
                isClearable
              />
            </div>
            <div>
              <label htmlFor="next_follow_up" className="block text-sm font-medium mb-1">
                Next Follow-up
              </label>
              <DatePicker
                selected={formData.next_follow_up}
                onChange={(date) => setFormData({ ...formData, next_follow_up: date })}
                className="w-full p-2 rounded border border-input bg-background"
                dateFormat="MMM d, yyyy"
                isClearable
              />
            </div>
            <div>
              <label htmlFor="notes" className="block text-sm font-medium mb-1">
                Notes
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full p-2 rounded border border-input bg-background"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md"
              >
                {editingId ? 'Update' : 'Add'} Application
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                  setFormData({
                    company_name: '',
                    position: '',
                    status: 'draft',
                    applied_date: null,
                    notes: '',
                    next_follow_up: null
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
        {applications.map((application: any) => (
          <div key={application.id} className="bg-card text-card-foreground p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold">{application.position}</h2>
                <p className="text-muted-foreground">{application.companies.name}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(application.status)}`}>
                  {application.status}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(application)}
                    className="text-primary hover:text-primary/80"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(application.id)}
                    className="text-destructive hover:text-destructive/80"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {application.applied_date && (
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Applied: {format(new Date(application.applied_date), 'MMM d, yyyy')}
                  </span>
                </div>
              )}
              {application.next_follow_up && (
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Follow-up: {format(new Date(application.next_follow_up), 'MMM d, yyyy')}
                  </span>
                </div>
              )}
            </div>
            {application.notes && (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{application.notes}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Applications;