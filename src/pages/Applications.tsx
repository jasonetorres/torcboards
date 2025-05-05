import React, { useState, useEffect } from 'react';
import { Plus, Calendar as CalendarIcon } from 'lucide-react';
import DatePicker from 'react-datepicker';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabase';
import { useSelector } from 'react-redux'; // Import useSelector
import { generateSmartReminders } from '../lib/openai';
import type { Database } from '../lib/supabase-types';
import "react-datepicker/dist/react-datepicker.css";

type Application = Database['public']['Tables']['applications']['Row'];
type Company = Database['public']['Tables']['companies']['Row'];

// Define an extended type for Application that includes nested company data
type ApplicationWithCompany = Application & {
  companies: Pick<Company, 'name' | 'website'> | null; // Allow company to be null if join fails or is optional
};


const Applications = () => {
  // State declarations
  const [applications, setApplications] = useState<ApplicationWithCompany[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]); // State to hold companies list
  const [formData, setFormData] = useState({
    company_name: '',
    position: '',
    status: 'draft',
    applied_date: null as Date | null,
    notes: '',
    next_follow_up: null as Date | null
  });
  const user = useSelector((state: any) => state.auth.user); // Use useSelector

  // Fetch data on component mount if user exists
  useEffect(() => {
    if (user) {
      fetchApplications();
      fetchCompanies(); // Fetch companies on load
    }
  }, [user]); // Dependency array ensures this runs when user state changes

  // Fetch job applications for the current user
  const fetchApplications = async () => {
    if (!user) return; // Ensure user exists before fetching

    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        companies (
          name,
          website
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching applications:", error);
      return;
    }

    if (data) {
      const typedData = data as ApplicationWithCompany[];
      setApplications(typedData);
    }
  };

  // Fetch companies associated with the current user
  const fetchCompanies = async () => {
     if (!user) return; // Ensure user exists before fetching

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error("Error fetching companies:", error);
      return;
    }
    if (data) {
        setCompanies(data); // Populate the companies state
    }
  };

  // Generate smart reminders using OpenAI and update application notes
  // ** CORRECTED VERSION USING 'companies' STATE **
  const generateReminders = async (application: Application) => {
    // Check if user is logged in and if the companies state has been populated
    if (!user || !companies || companies.length === 0) {
      console.error("User logged out or companies data not yet loaded. Skipping reminder generation.");
      return; // Exit if necessary data isn't available
    }

    try {
      // Use the 'companies' state variable directly
      const reminders = await generateSmartReminders(new Date(), [application], companies);

      // Update the application notes with the generated reminders
      const { error } = await supabase
        .from('applications')
        .update({
          // Append reminders, ensuring notes field exists
          notes: application.notes ? `${application.notes}\n\n**Smart Reminders:**\n${reminders}` : `**Smart Reminders:**\n${reminders}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', application.id);

      if (error) {
        console.error('Error updating application with reminders:', error);
      } else {
         console.log('Reminders generated and application updated.');
         // Consider fetching applications again only if this function runs independently
         // fetchApplications();
      }
    } catch (error) {
      console.error('Error generating or saving reminders:', error);
    }
  };

  // Handle form submission for adding or editing applications
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      // Find or create the company associated with the application
      const { data: existingCompanies, error: findError } = await supabase
        .from('companies')
        .select('id, name')
        .eq('name', formData.company_name.trim())
        .eq('user_id', user.id)
        .limit(1);

       if (findError) {
         console.error("Error finding company:", findError);
         throw findError;
       }

      let company_id;

      if (!existingCompanies || existingCompanies.length === 0) {
        // Create company if it doesn't exist
        const { data: newCompany, error: createError } = await supabase
          .from('companies')
          .insert([{
            name: formData.company_name.trim(),
            user_id: user.id,
            status: 'interested' // Default status
          }])
          .select('id') // Only select the ID
          .single();

        if (createError) {
          console.error("Error creating company:", createError);
          throw createError;
        }
        company_id = newCompany.id;
        fetchCompanies(); // Refresh company list state if a new one was added
      } else {
        company_id = existingCompanies[0].id;
      }

      // Prepare application data
      const applicationData = {
        position: formData.position,
        status: formData.status,
        applied_date: formData.applied_date ? formData.applied_date.toISOString() : null,
        next_follow_up: formData.next_follow_up ? formData.next_follow_up.toISOString() : null,
        notes: formData.notes,
        company_id,
        user_id: user.id
      };

      let savedApplication: Application | null = null;

      // Update existing application or insert a new one
      if (editingId) {
        const { error: updateError, data: updatedData } = await supabase
          .from('applications')
          .update({
            ...applicationData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId)
          .select()
          .single();

        if (updateError) throw updateError;
        savedApplication = updatedData;
        setEditingId(null);

      } else {
        const { error: insertError, data: insertedData } = await supabase
          .from('applications')
          .insert([applicationData])
          .select()
          .single();

        if (insertError) throw insertError;
        savedApplication = insertedData;
        setIsAdding(false);
      }

      // Generate reminders if the save/update was successful
      if (savedApplication) {
          generateReminders(savedApplication);
      }

      fetchApplications(); // Refresh the list of applications

      // Reset form state
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
      // Optionally: display an error message to the user
    }
  };

  // Populate form for editing an existing application
  const handleEdit = (application: ApplicationWithCompany) => {
    setEditingId(application.id);
    setFormData({
      company_name: application.companies?.name ?? '',
      position: application.position,
      status: application.status,
      applied_date: application.applied_date ? new Date(application.applied_date) : null,
      notes: application.notes || '',
      next_follow_up: application.next_follow_up ? new Date(application.next_follow_up) : null
    });
    setIsAdding(true); // Show the form
  };

  // Delete an application
  const handleDelete = async (id: string) => {
    // Optional: Add confirmation dialog
    // if (!confirm("Are you sure you want to delete this application?")) return;

    const { error } = await supabase
      .from('applications')
      .delete()
      .eq('id', id);

    if (error) {
        console.error("Error deleting application:", error);
    } else {
        fetchApplications(); // Refresh the list
    }
  };

  // Determine badge color based on application status
  const getStatusColor = (status: string): string => {
    const colors: { [key: string]: string } = {
      draft: 'bg-gray-200 text-gray-800',
      applied: 'bg-blue-200 text-blue-800',
      interviewing: 'bg-yellow-200 text-yellow-800',
      offered: 'bg-green-200 text-green-800',
      rejected: 'bg-red-200 text-red-800',
      accepted: 'bg-purple-200 text-purple-800',
      withdrawn: 'bg-indigo-200 text-indigo-800',
    };
    return colors[status] || colors.draft;
  };

  // Component rendering (JSX)
  return (
    <main className="min-h-screen w-full relative flex flex-col items-start justify-start p-4">
      {/* Background Image and Overlay */}
      <div className="fixed inset-0 z-0">
        <img
          src="https://img.heroui.chat/image/landscape?w=1920&h=1080&u=1" // Consider making this configurable
          className="w-full h-full object-cover"
          alt="Dashboard Background"
        />
        {/* Ensure this class provides the desired overlay effect */}
        <div className="absolute inset-0 bg-background/" />
      </div>

      {/* Content Area */}
      <div className="w-full max-w-7xl z-10">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Job Applications</h1>
          <button
            onClick={() => { setIsAdding(true); setEditingId(null); setFormData({ company_name: '', position: '', status: 'draft', applied_date: null, notes: '', next_follow_up: null }); }}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md items-center gap-2 mt-4 inline-flex"
          >
            <Plus className="h-5 w-5" />
            Add Application
          </button>
        </div>

        {/* Add/Edit Form (Conditional) */}
        {isAdding && (
          <div className="bg-card text-card-foreground p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4 text-foreground">
              {editingId ? 'Edit Application' : 'Add New Application'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Company Name */}
              <div>
                <label htmlFor="company_name" className="block text-sm font-medium mb-1 text-foreground">
                  Company Name
                </label>
                <input
                  id="company_name"
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full p-2 rounded border border-input bg-background text-foreground"
                  required
                />
              </div>
              {/* Position */}
              <div>
                <label htmlFor="position" className="block text-sm font-medium mb-1 text-foreground">
                  Position
                </label>
                <input
                  id="position"
                  type="text"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full p-2 rounded border border-input bg-background text-foreground"
                  required
                />
              </div>
              {/* Status */}
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
                  <option value="draft">Draft</option>
                  <option value="applied">Applied</option>
                  <option value="interviewing">Interviewing</option>
                  <option value="offered">Offered</option>
                  <option value="rejected">Rejected</option>
                  <option value="accepted">Accepted</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </div>

              {/* Date Fields (Side-by-side) */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                  <label htmlFor="applied_date" className="block text-sm font-medium mb-1 text-foreground">
                    Applied Date
                  </label>
                  <DatePicker
                    selected={formData.applied_date}
                    onChange={(date) => setFormData({ ...formData, applied_date: date })}
                    className="w-full p-2 rounded border border-input bg-background text-foreground"
                    dateFormat="MMM d, yyyy"
                    isClearable
                    placeholderText="Select date"
                  />
                </div>
                <div>
                  <label htmlFor="next_follow_up" className="block text-sm font-medium mb-1 text-foreground">
                    Next Follow-up
                  </label>
                  <DatePicker
                    selected={formData.next_follow_up}
                    onChange={(date) => setFormData({ ...formData, next_follow_up: date })}
                    className="w-full p-2 rounded border border-input bg-background text-foreground"
                    dateFormat="MMM d, yyyy"
                    isClearable
                    placeholderText="Select date"
                  />
                 </div>
               </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className="block text-sm font-medium mb-1 text-foreground">
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-2 rounded border border-input bg-background text-foreground"
                  rows={4}
                />
              </div>

              {/* Form Actions */}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md"
                >
                  {editingId ? 'Update' : 'Add'} Application
                </button>
                <button
                  type="button"
                  onClick={() => { setIsAdding(false); setEditingId(null); /* Reset form handled in onClick above */ }}
                  className="bg-muted text-muted-foreground px-4 py-2 rounded-md"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Applications List */}
        <div className="space-y-4">
          {applications.map((application) => (
            <div key={application.id} className="bg-card text-card-foreground p-6 rounded-lg shadow-md w-full">
               <div className="flex flex-col sm:flex-row items-start justify-between">
                 {/* Main content */}
                 <div className="flex-1 mb-4 sm:mb-0 sm:mr-4">
                   <h2 className="text-xl font-semibold text-foreground">{application.position}</h2>
                   <p className="text-muted-foreground">{application.companies?.name ?? 'Unknown Company'}</p>
                   {/* Dates */}
                   <div className="flex items-center gap-4 mt-2 flex-wrap">
                       {application.applied_date && (
                         <div className="flex items-center gap-1 text-sm text-muted-foreground">
                           <CalendarIcon className="h-4 w-4" />
                           Applied: {format(new Date(application.applied_date), 'MMM d, yyyy')}
                         </div>
                       )}
                       {application.next_follow_up && (
                         <div className="flex items-center gap-1 text-sm text-muted-foreground">
                           <CalendarIcon className="h-4 w-4" />
                           Follow-up: {format(new Date(application.next_follow_up), 'MMM d, yyyy')}
                         </div>
                       )}
                     </div>
                 </div>

                 {/* Status Badge and Actions */}
                  <div className="flex flex-col items-start sm:items-end space-y-2">
                     <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(application.status)}`}>
                       {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                     </span>
                    <div className="flex gap-2 mt-2 sm:mt-0">
                      <button
                        onClick={() => handleEdit(application)}
                        className="text-primary hover:text-primary/80 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(application.id)}
                        className="text-destructive hover:text-destructive/80 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
               </div>

              {/* Notes Section */}
              {application.notes && (
                 <div className="prose prose-sm max-w-none mt-4 text-foreground prose-p:text-foreground prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground prose-strong:text-foreground">
                   <ReactMarkdown>{application.notes}</ReactMarkdown>
                 </div>
               )}
            </div>
          ))}
        </div> {/* End Applications List */}
      </div> {/* End Content Area */}
    </main> // End Main Page Container
  );
};

export default Applications;