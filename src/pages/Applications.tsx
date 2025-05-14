// src/pages/Applications.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Calendar as CalendarIcon, Edit, Trash2, LinkIcon, FileText } from 'lucide-react'; // Added LinkIcon, FileText
import DatePicker from 'react-datepicker';
import { format, isValid } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabase';
import { useSelector } from 'react-redux';
import { generateSmartReminders } from '../lib/openai';
import type { Database } from '../lib/supabase-types';
import { RootState } from '../store';
import "react-datepicker/dist/react-datepicker.css";
import { cn } from '../lib/utils';

// Update Application type to include new fields
type Application = Database['public']['Tables']['applications']['Row'] & {
  job_posting_url?: string | null;      // NEW
  job_description_text?: string | null; // NEW
};

type Company = Database['public']['Tables']['companies']['Row'];

type ApplicationWithCompany = Application & {
  companies: Pick<Company, 'name' | 'website'> | null;
};

type ApplicationStatus =
  | 'draft'
  | 'applied'
  | 'interviewing'
  | 'offered'
  | 'rejected'
  | 'accepted'
  | 'withdrawn';

const safeFormatDate = (dateInput: string | null | undefined, formatString: string): string | null => {
    if (!dateInput) return null;
    try {
      const date = new Date(dateInput);
      if (!isValid(date)) {
         console.warn("Invalid date value encountered:", dateInput);
         return 'Invalid Date';
      }
      return format(date, formatString);
    } catch (e) {
        console.error("Error formatting date:", dateInput, e);
        return 'Format Error';
    }
};

const Applications = () => {
  const [applications, setApplications] = useState<ApplicationWithCompany[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const formRef = useRef<HTMLDivElement>(null);

  // Add new fields to initialFormData and formData state
  const initialFormData = {
      company_name: '',
      position: '',
      status: 'draft' as ApplicationStatus,
      applied_date: null as Date | null,
      notes: '',
      next_follow_up: null as Date | null,
      job_posting_url: '',      // NEW
      job_description_text: ''  // NEW
  };
  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof typeof formData, string>>>({});
  const user = useSelector((state: RootState) => state.auth.user);

  useEffect(() => {
    if (user) {
      fetchApplications();
      fetchCompanies();
    } else {
        setApplications([]);
        setCompanies([]);
        setIsAdding(false);
        setEditingId(null);
        setFormData(initialFormData);
        setFormErrors({});
    }
  }, [user]);

  const fetchApplications = async () => {
    if (!user) return;
    try {
        // Ensure new fields are selected if you want to display them later
        const { data, error } = await supabase
          .from('applications')
          .select(`*, companies ( name, website ), job_posting_url, job_description_text`) // Added new fields
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (error) throw error;
        if (data) setApplications(data as ApplicationWithCompany[]);
    } catch (error: any) {
        console.error("Error fetching applications:", error);
        alert(`Failed to load applications: ${error.message}`);
    }
  };

  const fetchCompanies = async () => {
     if (!user) return;
     try {
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .eq('user_id', user.id)
          .order('name', { ascending: true });
        if (error) throw error;
        if (data) setCompanies(data);
     } catch (error: any) {
         console.error("Error fetching companies:", error);
     }
  };
  

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof typeof formData, string>> = {};
    if (!formData.company_name.trim()) errors.company_name = 'Company name is required.';
    if (!formData.position.trim()) errors.position = 'Position is required.';
    if (formData.job_posting_url.trim() && !formData.job_posting_url.startsWith('http')) {
        errors.job_posting_url = 'Please enter a valid URL (e.g., http://... or https://...).';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  

  const generateReminders = async (application: Application) => {
    // ... (generateReminders function remains the same)
    if (!user || !companies || companies.length === 0 || !generateSmartReminders) {
      console.warn("User not logged in, companies not loaded, or generateSmartReminders not available.");
      return;
    }
    try {
      await generateSmartReminders(new Date(), [application], companies);
      console.log('Reminder generation requested for application:', application.id);
    } catch (error: any) {
      console.error('Error triggering reminder generation:', error);
      alert(`Failed to generate reminders: ${error.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !validateForm()) return;

    let company_id: string | null = null;
    try {
        const trimmedCompanyName = formData.company_name.trim();
        const existingCompany = companies.find(c => c.name.toLowerCase() === trimmedCompanyName.toLowerCase());
        if (existingCompany) {
            company_id = existingCompany.id;
        } else {
            const { data: newCompany, error: createError } = await supabase
                .from('companies')
                .insert([{ name: trimmedCompanyName, user_id: user.id, status: 'researching' }])
                .select('id')
                .single();
            if (createError) throw createError;
            company_id = newCompany!.id; // newCompany should have id
            await fetchCompanies();
        }

      const applicationData = {
        position: formData.position.trim(),
        status: formData.status,
        applied_date: formData.applied_date ? format(formData.applied_date, 'yyyy-MM-dd') : null,
        next_follow_up: formData.next_follow_up ? format(formData.next_follow_up, 'yyyy-MM-dd') : null,
        notes: formData.notes.trim() || null,
        company_id: company_id,
        user_id: user.id,
        job_posting_url: formData.job_posting_url.trim() || null,      // NEW
        job_description_text: formData.job_description_text.trim() || null // NEW
      };

      let savedApplication: Application | null = null;
      if (editingId) {
        const { data, error } = await supabase
          .from('applications')
          .update({ ...applicationData, updated_at: new Date().toISOString() })
          .eq('id', editingId)
          .select() // Select all fields to get the full application object back
          .single();
        if (error) throw error;
        savedApplication = data;
      } else {
        const { data, error } = await supabase
          .from('applications')
          .insert([applicationData])
          .select()
          .single();
        if (error) throw error;
        savedApplication = data;
      }

      if (savedApplication) {
        generateReminders(savedApplication);
      }
      handleCancel();
      fetchApplications();

    } catch (error: any) {
      console.error('Error saving application:', error);
      alert(`Failed to save application: ${error.message}`);
    }
  };

  const handleEdit = (application: ApplicationWithCompany) => {
    setEditingId(application.id);
    setFormData({
      company_name: application.companies?.name ?? '',
      position: application.position ?? '',
      status: (application.status as ApplicationStatus) ?? 'draft',
      applied_date: application.applied_date ? new Date(application.applied_date) : null,
      notes: application.notes ?? '',
      next_follow_up: application.next_follow_up ? new Date(application.next_follow_up) : null,
      job_posting_url: application.job_posting_url ?? '',          // NEW
      job_description_text: application.job_description_text ?? '' // NEW
    });
    setFormErrors({});
    setIsAdding(true);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDelete = async (id: string) => {
    // ... (handleDelete function remains the same)
     if (!window.confirm("Are you sure you want to delete this application?")) return;
     try {
        const { error } = await supabase.from('applications').delete().eq('id', id);
        if (error) throw error;
        fetchApplications();
        if (id === editingId) handleCancel();
     } catch (error: any) {
         console.error("Error deleting application:", error);
         alert(`Failed to delete application: ${error.message}`);
     }
  };

   const handleCancel = () => {
     setIsAdding(false);
     setEditingId(null);
     setFormData(initialFormData);
     setFormErrors({});
  };

  const getStatusColor = (status: ApplicationStatus): string => {
    // ... (getStatusColor function remains the same)
    const colorMap: Record<ApplicationStatus, string> = {
      draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      applied: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      interviewing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      offered: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      accepted: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      withdrawn: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    };
    return colorMap[status] || colorMap.draft;
  };

  return (
    <main className="min-h-screen w-full relative flex justify-center px-4 pt-16 pb-16 overflow-y-auto">
      <div className="fixed inset-0 z-0">
        <img
          src="https://img.heroui.chat/image/landscape?w=1920&h=1080&u=1"
          className="w-full h-full object-cover"
          alt="Background"
        />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <div className="w-full max-w-7xl z-10">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-bold text-white mix-blend-screen">Job Applications</h1>
             {!isAdding && (
                <button
                  onClick={() => { setIsAdding(true); setEditingId(null); setFormData(initialFormData); setFormErrors({}); formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md flex items-center justify-center gap-2 text-sm transition-colors shadow-sm"
                  title="Log a new application"
                >
                  <Plus className="h-5 w-5" />
                  Add Application
                </button>
             )}
          </div>

           <div ref={formRef}>
               {isAdding && (
                 <div className="bg-card/80 backdrop-blur-sm shadow-lg border-border/50 p-6 rounded-lg text-card-foreground">
                   <h2 className="text-xl font-semibold mb-4">
                     {editingId ? 'Edit Application' : 'Add New Application'}
                   </h2>
                   <form onSubmit={handleSubmit} className="space-y-4">
                     {/* --- Form Grid for better layout --- */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Company Name Input */}
                        <div>
                          <label htmlFor="company_name" className="block text-sm font-medium mb-1 text-card-foreground/80"> Company Name * </label>
                          <input
                            id="company_name" type="text" list="company-suggestions" value={formData.company_name}
                            onChange={(e) => {setFormData({ ...formData, company_name: e.target.value }); setFormErrors({...formErrors, company_name: undefined})}}
                            className={cn("w-full p-2 rounded border bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm", formErrors.company_name ? 'border-red-500' : 'border-input')}
                            required aria-describedby={formErrors.company_name ? "company-error" : undefined}
                          />
                           <datalist id="company-suggestions"> {companies.map(c => <option key={c.id} value={c.name} />)} </datalist>
                          {formErrors.company_name && <p id="company-error" className="text-xs text-red-500 mt-1">{formErrors.company_name}</p>}
                        </div>
                        {/* Position Input */}
                        <div>
                          <label htmlFor="position" className="block text-sm font-medium mb-1 text-card-foreground/80"> Position * </label>
                          <input
                            id="position" type="text" value={formData.position}
                            onChange={(e) => {setFormData({ ...formData, position: e.target.value }); setFormErrors({...formErrors, position: undefined})}}
                            className={cn("w-full p-2 rounded border bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm", formErrors.position ? 'border-red-500' : 'border-input')}
                            required aria-describedby={formErrors.position ? "position-error" : undefined}
                          />
                          {formErrors.position && <p id="position-error" className="text-xs text-red-500 mt-1">{formErrors.position}</p>}
                        </div>
                        {/* Status Select */}
                        <div>
                          <label htmlFor="status" className="block text-sm font-medium mb-1 text-card-foreground/80"> Status </label>
                          <select
                            id="status" value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value as ApplicationStatus })}
                            className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm capitalize appearance-none bg-chevron-down bg-no-repeat bg-right"
                          >
                            <option value="draft">Draft</option> <option value="applied">Applied</option> <option value="interviewing">Interviewing</option> <option value="offered">Offered</option> <option value="accepted">Accepted</option> <option value="rejected">Rejected</option> <option value="withdrawn">Withdrawn</option>
                          </select>
                        </div>
                        {/* Applied Date */}
                        <div className="relative">
                          <label htmlFor="applied_date" className="block text-sm font-medium mb-1 text-card-foreground/80"> Applied Date </label>
                          <DatePicker
                            id="applied_date" selected={formData.applied_date}
                            onChange={(date) => setFormData({ ...formData, applied_date: date })}
                            className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                            wrapperClassName="w-full" popperClassName="z-30" dateFormat="MMM d, yyyy" isClearable placeholderText="Select date"
                          />
                        </div>
                        {/* Next Follow Up Date */}
                        <div className="md:col-span-2"> {/* Spans full width on md+ or keep separate */}
                           <label htmlFor="next_follow_up" className="block text-sm font-medium mb-1 text-card-foreground/80"> Next Follow-up </label>
                           <DatePicker
                             id="next_follow_up" selected={formData.next_follow_up}
                             onChange={(date) => setFormData({ ...formData, next_follow_up: date })}
                             className="w-full sm:w-1/2 md:w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm" // Adjust width as needed
                             wrapperClassName="w-full sm:w-1/2 md:w-full"
                             popperClassName="z-30" dateFormat="MMM d, yyyy" isClearable placeholderText="Select date"
                           />
                        </div>
                     </div> {/* End Form Grid */}

                     {/* --- NEW: Job Posting URL Input --- */}
                     <div className="mt-4">
                       <label htmlFor="job_posting_url" className="block text-sm font-medium mb-1 text-card-foreground/80">
                         Job Posting URL (Optional)
                       </label>
                       <div className="relative">
                           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                               <LinkIcon className="h-4 w-4 text-gray-400" />
                           </div>
                           <input
                             id="job_posting_url"
                             type="url"
                             value={formData.job_posting_url}
                             onChange={(e) => {setFormData({ ...formData, job_posting_url: e.target.value }); setFormErrors({...formErrors, job_posting_url: undefined})}}
                             placeholder="https://example.com/job-posting"
                             className={cn("w-full p-2 pl-10 rounded border bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm", formErrors.job_posting_url ? 'border-red-500' : 'border-input')}
                             aria-describedby={formErrors.job_posting_url ? "url-error" : undefined}
                           />
                       </div>
                        {formErrors.job_posting_url && <p id="url-error" className="text-xs text-red-500 mt-1">{formErrors.job_posting_url}</p>}
                     </div>

                     {/* --- NEW: Job Description Textarea --- */}
                     <div className="mt-4">
                       <label htmlFor="job_description_text" className="block text-sm font-medium mb-1 text-card-foreground/80">
                         Pasted Job Description (Optional)
                       </label>
                       <div className="relative">
                            <div className="absolute top-2 left-0 pl-3 flex items-start pointer-events-none">
                               <FileText className="h-4 w-4 text-gray-400 mt-1" />
                           </div>
                           <textarea
                             id="job_description_text"
                             value={formData.job_description_text}
                             onChange={(e) => setFormData({ ...formData, job_description_text: e.target.value })}
                             placeholder="Paste the full job description text here..."
                             className="w-full p-2 pl-10 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm min-h-[120px]"
                             rows={5}
                           />
                       </div>
                     </div>

                     {/* Notes Textarea */}
                     <div className="mt-4">
                       <label htmlFor="notes" className="block text-sm font-medium mb-1 text-card-foreground/80"> Notes (Supports Markdown) </label>
                       <textarea
                         id="notes" value={formData.notes}
                         onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                         className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm min-h-[100px]"
                         rows={4}
                       />
                     </div>

                     <div className="flex gap-2 pt-2">
                       <button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md transition-colors text-sm font-medium shadow-sm">
                         {editingId ? 'Update Application' : 'Save Application'}
                       </button>
                       <button type="button" onClick={handleCancel} className="bg-muted hover:bg-muted/80 text-muted-foreground px-4 py-2 rounded-md transition-colors text-sm font-medium">
                         Cancel
                       </button>
                     </div>
                   </form>
                 </div>
               )}
           </div>

          {!isAdding && applications.length === 0 && (
            <div className="bg-card/80 backdrop-blur-sm shadow-lg border-border/50 p-6 rounded-lg text-center text-muted-foreground">
                You haven't logged any job applications yet. Click "Add Application" to start!
            </div>
          )}

          <div className="space-y-4">
            {applications.map((application) => (
              <div key={application.id} className="bg-card/80 backdrop-blur-sm shadow-lg border-border/50 p-4 sm:p-6 rounded-lg text-card-foreground transition-shadow hover:shadow-primary/10">
                 <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                   <div className="flex-1 min-w-0">
                     <h2 className="text-lg sm:text-xl font-semibold truncate" title={application.position}>{application.position}</h2>
                     <p className="text-sm text-muted-foreground truncate" title={application.companies?.name ?? ''}>{application.companies?.name ?? 'Unknown Company'}</p>
                     <div className="flex items-center gap-3 mt-2 flex-wrap">
                         {application.applied_date && (
                           <div className="flex items-center gap-1 text-xs text-muted-foreground"> <CalendarIcon className="h-3.5 w-3.5" /> Applied: {safeFormatDate(application.applied_date, 'MMM d, yyyy')} </div>
                         )}
                         {application.next_follow_up && (
                           <div className="flex items-center gap-1 text-xs text-muted-foreground"> <CalendarIcon className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" /> Follow-up: {safeFormatDate(application.next_follow_up, 'MMM d, yyyy')} </div>
                         )}
                       </div>
                   </div>
                    <div className="flex flex-col items-start sm:items-end space-y-2 flex-shrink-0">
                       <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(application.status as ApplicationStatus)}`}>
                         {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                       </span>
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => handleEdit(application)} className="text-muted-foreground hover:text-primary p-1 rounded hover:bg-primary/10 transition-colors" title="Edit Application"> <Edit className="h-4 w-4" /> </button>
                        <button onClick={() => handleDelete(application.id)} className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/10 transition-colors" title="Delete Application"> <Trash2 className="h-4 w-4" /> </button>
                      </div>
                    </div>
                 </div>
                {application.notes && (
                   <div className="mt-4 pt-4 border-t border-border/50 text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-a:text-primary hover:prose-a:underline prose-strong:font-semibold max-h-32 overflow-y-auto">
                     <ReactMarkdown>{application.notes}</ReactMarkdown>
                   </div>
                 )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
};

export default Applications;