import React, { useState, useEffect, useRef } from 'react';
import { Plus, ExternalLink, Pencil, Trash2, User, BrainCircuit } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabase';
import { useSelector } from 'react-redux';
import { suggestNetworkingActions } from '../lib/openai';
import type { Database } from '../lib/supabase-types';
import { RootState } from '../store';
import { Card, CardBody, CardHeader, CardFooter } from '@heroui/react'; // Using HeroUI Card components
import { cn } from '../lib/utils';

type Company = Database['public']['Tables']['companies']['Row'];

// Define possible company statuses more explicitly
type CompanyStatus =
  | 'interested'
  | 'researching'
  | 'applying'
  | 'applied'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'not_interested';

// Interface for form data
interface CompanyFormData {
    name: string;
    website: string;
    notes: string;
    status: CompanyStatus;
    contact_name: string;
    contact_email: string;
    contact_phone: string;
    contact_role: string;
}

const TargetCompanies = () => {
  // State variables 'applications' and 'companies' hold the full lists
  const [companies, setCompanies] = useState<Company[]>([]);
  const [applications, setApplications] = useState<Database['public']['Tables']['applications']['Row'][]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState<Record<string, boolean>>({});
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CompanyFormData, string>>>({});

  const initialFormData: CompanyFormData = {
    name: '',
    website: '',
    notes: '',
    status: 'interested',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    contact_role: ''
  };

  const [formData, setFormData] = useState<CompanyFormData>(initialFormData);
  const user = useSelector((state: RootState) => state.auth.user);
  const formRef = useRef<HTMLDivElement>(null); // Ref for scrolling

  // Effects and data fetching functions (remain the same)
  useEffect(() => {
    if (user) {
      fetchCompanies();
      fetchAllApplicationsForAIContext();
    } else {
      setCompanies([]);
      setApplications([]);
      setIsAdding(false);
      setEditingId(null);
      setFormData(initialFormData);
      setFormErrors({});
    }
  }, [user]);

  const fetchCompanies = async () => {
    if (!user) return;
    try {
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (error) throw error;
        if (data) setCompanies(data);
    } catch(error) {
        console.error("Error fetching companies:", error);
        alert(`Failed to load companies: ${(error as Error).message}`);
    }
  };

  const fetchAllApplicationsForAIContext = async () => {
      if (!user) return;
      try {
          const { data, error } = await supabase
              .from('applications')
              .select(`*, companies ( name )`) // Adjust select as needed
              .eq('user_id', user.id)
              .order('created_at', { ascending: false });
          if (error) throw error;
          if (data) setApplications(data);
      } catch (error) {
          console.error("Error fetching applications for AI context:", error);
      }
  };

  const validateForm = (): boolean => {
      const errors: Partial<Record<keyof CompanyFormData, string>> = {};
      if (!formData.name.trim()) {
          errors.name = 'Company name is required.';
      }
      if (formData.website && !formData.website.match(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i)) {
           errors.website = 'Please enter a valid URL.';
      }
       if (formData.contact_email && !formData.contact_email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
           errors.contact_email = 'Please enter a valid email address.';
       }
      setFormErrors(errors);
      return Object.keys(errors).length === 0;
  };

  const generateNetworkingSuggestions = async (companyTrigger: Company) => {
    if (!suggestNetworkingActions) {
        console.warn("suggestNetworkingActions function not available.");
        alert("AI suggestion feature is not available at the moment.");
        return;
    }
    setLoadingSuggestions(prev => ({ ...prev, [companyTrigger.id]: true }));
    try {
      const suggestions = await suggestNetworkingActions(applications, companies);
      if (!suggestions) {
          console.log("No suggestions returned by AI.");
          alert("AI did not return any suggestions for this company.");
          return;
      }
      const updatedNotes = companyTrigger.notes
        ? `${companyTrigger.notes}\n\n---\n**Networking Suggestions (AI):**\n${suggestions}`
        : `**Networking Suggestions (AI):**\n${suggestions}`;

      const { error } = await supabase
        .from('companies')
        .update({
          notes: updatedNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', companyTrigger.id);

      if (error) throw error;
      fetchCompanies();
    } catch (error) {
      console.error('Error in generateNetworkingSuggestions (TargetCompanies.tsx):', error);
      alert(`Failed to get AI suggestions: ${(error as Error).message}`);
    } finally {
       setLoadingSuggestions(prev => ({ ...prev, [companyTrigger.id]: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !validateForm()) return;
    // ... (rest of submit logic unchanged) ...
    const dataToSave = Object.fromEntries(
       Object.entries(formData).map(([key, value]) => [key, typeof value === 'string' ? value.trim() || null : value])
    ) as Omit<CompanyFormData, 'status'> & { status: CompanyStatus; website: string | null; notes: string | null; contact_name: string | null; contact_email: string | null; contact_phone: string | null; contact_role: string | null; };

    const saveData = { ...dataToSave, updated_at: new Date().toISOString() };

    try {
      if (editingId) {
        const { error } = await supabase.from('companies').update(saveData).eq('id', editingId);
        if (error) throw error;
        setEditingId(null);
      } else {
        const { error } = await supabase.from('companies').insert([{ ...saveData, user_id: user.id }]);
        if (error) throw error;
        setIsAdding(false);
      }
       setFormData(initialFormData);
       setFormErrors({});
       fetchCompanies();
    } catch (error) {
       console.error('Error saving company:', error);
       alert(`Failed to save company: ${(error as Error).message}`);
    }
  };

  const handleEdit = (company: Company) => {
    // ... (edit logic unchanged) ...
    setEditingId(company.id);
    setFormData({
      name: company.name ?? '',
      website: company.website ?? '',
      notes: company.notes ?? '',
      status: company.status as CompanyStatus ?? 'interested',
      contact_name: company.contact_name ?? '',
      contact_email: company.contact_email ?? '',
      contact_phone: company.contact_phone ?? '',
      contact_role: company.contact_role ?? ''
    });
    setIsAdding(true);
    setFormErrors({});
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDelete = async (id: string) => {
    // ... (delete logic unchanged, includes foreign key handling) ...
    if (!window.confirm("Are you sure you want to delete this company? This action cannot be undone.")) { return; }
    try {
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) { throw error; }
      fetchCompanies();
      if (editingId === id) { handleCancel(); }
    } catch (error: any) {
       console.error("Error deleting company:", error);
       if (error && error.code === '23503') {
          alert( "Deletion Failed: This company cannot be deleted because it is still linked to one or more job applications.\n\nPlease delete or reassign the associated applications first." );
       } else {
          alert(`Failed to delete company: ${error?.message || 'Unknown error'}`);
       }
    }
  };

  const handleCancel = () => {
    // ... (cancel logic unchanged) ...
     setIsAdding(false);
     setEditingId(null);
     setFormData(initialFormData);
     setFormErrors({});
  };

  const getStatusBadgeClasses = (status: CompanyStatus): string => {
    // ... (badge logic unchanged) ...
     switch (status) {
         case 'interested': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
         case 'researching': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
         case 'applying': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
         case 'applied': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
         case 'interviewing': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200';
         case 'offer': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
         case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
         case 'not_interested': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
         default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
     }
  }

  // --- Render Logic ---
  return (
    <main className="min-h-screen w-full relative flex justify-center px-4 pt-16 pb-16 overflow-y-auto">
      {/* Background (unchanged) */}
      <div className="fixed inset-0 z-0">
        <img src="https://img.heroui.chat/image/landscape?w=1920&h=1080&u=1" className="w-full h-full object-cover" alt="Background" />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* Content Area (unchanged) */}
      <div className="w-full max-w-7xl z-10">
        <div className="space-y-6">
          {/* Header (unchanged) */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-bold text-white mix-blend-screen">Target Companies</h1>
            {!isAdding && ( <button onClick={() => { setIsAdding(true); setEditingId(null); setFormData(initialFormData); setFormErrors({}); formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md flex items-center justify-center gap-2 text-sm transition-colors shadow-sm" title="Add a new target company" > <Plus className="h-5 w-5" /> Add Company </button> )}
          </div>

          {/* Add/Edit Form (unchanged) */}
          <div ref={formRef}> {isAdding && ( <Card className="bg-card/80 backdrop-blur-sm shadow-lg border-border/50 text-card-foreground"> <CardHeader className="border-b border-border/50"> <h2 className="text-xl font-semibold"> {editingId ? 'Edit Company' : 'Add New Company'} </h2> </CardHeader> <CardBody> <form onSubmit={handleSubmit} className="space-y-4"> <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3"> <div> <label htmlFor="name" className="block text-sm font-medium mb-1 text-card-foreground/80"> Company Name * </label> <input id="name" type="text" value={formData.name} onChange={(e) => {setFormData({ ...formData, name: e.target.value }); setFormErrors({...formErrors, name: undefined})}} className={cn("w-full p-2 rounded border bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm", formErrors.name ? 'border-red-500' : 'border-input')} required aria-describedby={formErrors.name ? "name-error" : undefined}/> {formErrors.name && <p id="name-error" className="text-xs text-red-500 mt-1">{formErrors.name}</p>} </div> <div> <label htmlFor="website" className="block text-sm font-medium mb-1 text-card-foreground/80"> Website </label> <input id="website" type="url" placeholder="https://example.com" value={formData.website} onChange={(e) => {setFormData({ ...formData, website: e.target.value }); setFormErrors({...formErrors, website: undefined})}} className={cn("w-full p-2 rounded border bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm", formErrors.website ? 'border-red-500' : 'border-input')} aria-describedby={formErrors.website ? "website-error" : undefined}/> {formErrors.website && <p id="website-error" className="text-xs text-red-500 mt-1">{formErrors.website}</p>} </div> <div> <label htmlFor="contact_name" className="block text-sm font-medium mb-1 text-card-foreground/80"> Contact Name </label> <input id="contact_name" type="text" value={formData.contact_name} onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })} className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm" /> </div> <div> <label htmlFor="contact_role" className="block text-sm font-medium mb-1 text-card-foreground/80"> Contact Role </label> <input id="contact_role" type="text" value={formData.contact_role} onChange={(e) => setFormData({ ...formData, contact_role: e.target.value })} className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm" /> </div> <div> <label htmlFor="contact_email" className="block text-sm font-medium mb-1 text-card-foreground/80"> Contact Email </label> <input id="contact_email" type="email" value={formData.contact_email} onChange={(e) => {setFormData({ ...formData, contact_email: e.target.value }); setFormErrors({...formErrors, contact_email: undefined})}} className={cn("w-full p-2 rounded border bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm", formErrors.contact_email ? 'border-red-500' : 'border-input')} aria-describedby={formErrors.contact_email ? "email-error" : undefined}/> {formErrors.contact_email && <p id="email-error" className="text-xs text-red-500 mt-1">{formErrors.contact_email}</p>} </div> <div> <label htmlFor="contact_phone" className="block text-sm font-medium mb-1 text-card-foreground/80"> Contact Phone </label> <input id="contact_phone" type="tel" value={formData.contact_phone} onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })} className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm" /> </div> </div> <div> <label htmlFor="notes" className="block text-sm font-medium mb-1 text-card-foreground/80"> Notes (Supports Markdown) </label> <textarea id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm min-h-[80px]" rows={4} /> </div> <div> <label htmlFor="status" className="block text-sm font-medium mb-1 text-card-foreground/80"> Status </label> <select id="status" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as CompanyStatus })} className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm capitalize appearance-none bg-chevron-down bg-no-repeat bg-right" > <option value="interested">Interested</option> <option value="researching">Researching</option> <option value="applying">Applying</option> <option value="applied">Applied</option> <option value="interviewing">Interviewing</option> <option value="offer">Offer Received</option> <option value="rejected">Rejected</option> <option value="not_interested">Not Interested</option> </select> </div> <div className="flex gap-2 pt-2"> <button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md transition-colors text-sm font-medium shadow-sm"> {editingId ? 'Update Company' : 'Save Company'} </button> <button type="button" onClick={handleCancel} className="bg-muted hover:bg-muted/80 text-muted-foreground px-4 py-2 rounded-md transition-colors text-sm font-medium"> Cancel </button> </div> </form> </CardBody> </Card> )} </div>

          {/* Empty State (unchanged) */}
          {!isAdding && companies.length === 0 && ( <Card className="bg-card/80 backdrop-blur-sm shadow-lg border-border/50"> <CardBody className="text-center text-muted-foreground p-10"> You haven't added any target companies yet. <br /> Click "Add Company" above to get started tracking your prospects! </CardBody> </Card> )}

          {/* --- MODIFIED Company List Container --- */}
          {/* Removed grid classes, added space-y for vertical list layout */}
          <div className="space-y-4">
            {companies.map((companyFromMap) => (
              <Card key={companyFromMap.id} className="bg-card/80 backdrop-blur-sm shadow-lg border-border/50 flex flex-col hover:shadow-primary/10 transition-shadow duration-300 text-card-foreground"> {/* Note: shadow-primary/10 might not exist, adjust if needed */}
                <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2"> {/* Allow stacking header on small screens */}
                  {/* Company Name and Edit/Delete Buttons */}
                   <div className="flex justify-between items-center w-full">
                       <h2 className="text-lg font-semibold pr-2 break-words">{companyFromMap.name}</h2>
                       <div className="flex gap-1 flex-shrink-0">
                         <button onClick={() => handleEdit(companyFromMap)} className="text-muted-foreground hover:text-primary p-1 rounded-full hover:bg-primary/10 transition-colors" title="Edit"> <Pencil className="h-4 w-4" /> </button>
                         <button onClick={() => handleDelete(companyFromMap.id)} className="text-muted-foreground hover:text-destructive p-1 rounded-full hover:bg-destructive/10 transition-colors" title="Delete"> <Trash2 className="h-4 w-4" /> </button>
                       </div>
                   </div>
                  {/* Status Badge (moved to header on larger screens for visibility) */}
                   <span className={cn(
                       `text-xs font-medium capitalize px-2 py-0.5 rounded-full mt-2 sm:mt-0 flex-shrink-0`,
                       getStatusBadgeClasses(companyFromMap.status as CompanyStatus)
                   )}>
                       {companyFromMap.status.replace('_', ' ')}
                   </span>
                </CardHeader>
                <CardBody className="flex-grow pt-2 text-sm space-y-3"> {/* Added space-y */}
                  {/* Website Link */}
                  {companyFromMap.website && (
                    <a href={!companyFromMap.website.startsWith('http') ? `https://${companyFromMap.website}` : companyFromMap.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm flex items-center gap-1.5 break-all" title={companyFromMap.website}>
                       <ExternalLink className="h-4 w-4 flex-shrink-0" /> <span className="truncate">{companyFromMap.website.replace(/^https?:\/\//, '')}</span>
                    </a>
                  )}
                  {/* Contact Info */}
                  {(companyFromMap.contact_name || companyFromMap.contact_email || companyFromMap.contact_phone || companyFromMap.contact_role) && (
                    <div className="border-t border-border/50 pt-3 mt-3 text-sm space-y-1.5"> {/* Increased font size, spacing */}
                      <h3 className="text-sm font-medium flex items-center gap-1.5 mb-1 text-muted-foreground"> {/* Increased gap */}
                        <User className="h-4 w-4" /> Point of Contact
                      </h3>
                      {companyFromMap.contact_name && ( <p> <span className="font-medium">Name:</span> {companyFromMap.contact_name} {companyFromMap.contact_role && `(${companyFromMap.contact_role})`} </p> )}
                      {companyFromMap.contact_email && ( <p> <span className="font-medium">Email:</span> <a href={`mailto:${companyFromMap.contact_email}`} className="text-primary hover:underline break-all">{companyFromMap.contact_email}</a> </p> )}
                      {companyFromMap.contact_phone && ( <p> <span className="font-medium">Phone:</span> <a href={`tel:${companyFromMap.contact_phone}`} className="text-primary hover:underline">{companyFromMap.contact_phone}</a> </p> )}
                    </div>
                  )}
                  {/* Notes Section */}
                   <div className={cn("text-muted-foreground text-sm mt-3 prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-a:text-primary hover:prose-a:underline prose-strong:font-semibold max-h-40 overflow-y-auto", /* Increased max-h */ (companyFromMap.contact_name || companyFromMap.contact_email || companyFromMap.contact_phone) ? "border-t border-border/50 pt-3" : "")}> {/* Increased font size, pt, mt */}
                     {companyFromMap.notes ? (
                         <ReactMarkdown components={{ a: ({node, ...props}) => <a target="_blank" rel="noopener noreferrer" {...props} /> }}>
                             {companyFromMap.notes}
                         </ReactMarkdown>
                     ) : (
                         <p className="italic text-muted-foreground/60">No notes added.</p>
                     )}
                   </div>
                </CardBody>
                {/* Footer only contains AI button now */}
                <CardFooter className="flex justify-end items-center pt-2 border-t border-border/50">
                   {/* Status Badge moved to header */}
                   {/* AI Suggestions Button */}
                   <button
                      onClick={() => generateNetworkingSuggestions(companyFromMap)}
                      disabled={loadingSuggestions[companyFromMap.id]}
                      className="text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed p-1 rounded-full hover:bg-primary/10 transition-colors"
                      title="Generate Networking Suggestions (AI)"
                    >
                      {loadingSuggestions[companyFromMap.id] ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      ) : (
                        <BrainCircuit className="h-4 w-4" />
                      )}
                    </button>
                </CardFooter>
              </Card>
            ))}
          </div>
           {/* --- End MODIFIED Company List Container --- */}

        </div>
      </div>
    </main>
  );
};

export default TargetCompanies;