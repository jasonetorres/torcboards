import React, { useState, useEffect, useRef } from 'react'; // Added useRef
import { useNavigate } from 'react-router-dom';
import { User, Settings, Lock, Mail, UserCircle, Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSelector } from 'react-redux';
import { RootState } from '../store'; // Import RootState type
import { cn } from '../lib/utils'; // Import cn utility

const Account = () => {
  const user = useSelector((state: RootState) => state.auth.user); // Use RootState
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // State for form data - initialize safely after ensuring user exists or with defaults
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    currentPassword: '', // Not used in Supabase password update, but might be for custom flows
    newPassword: '',
    confirmPassword: '',
  });

  // State for email preferences
  const [emailPreferences, setEmailPreferences] = useState<{ weekly_recap: boolean | null }>({
    weekly_recap: null // Initialize as null to indicate loading/not fetched
  });

  // Ref for initial focus or scrolling if needed
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Effect to redirect if not logged in, or fetch data/set form defaults if logged in
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    } else {
      // Set form data based on user object once available
      setFormData(prev => ({
          ...prev,
          firstName: user.user_metadata?.first_name || '',
          lastName: user.user_metadata?.last_name || '',
          email: user.email || '',
          // Clear password fields on user change/load
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
      }));
      fetchEmailPreferences();
    }
  }, [user, navigate]);

  const fetchEmailPreferences = async () => {
    if (!user) return;
    setLoading(true); // Indicate loading prefs

    try {
      const { data: existingPrefs, error } = await supabase
        .from('email_preferences')
        .select('weekly_recap') // Select only needed field
        .eq('user_id', user.id)
        .maybeSingle(); // Use maybeSingle to handle no existing row

      if (error) throw error;

      if (existingPrefs) {
        setEmailPreferences({ weekly_recap: existingPrefs.weekly_recap });
      } else {
        // If no preferences found, assume default (e.g., true) and maybe insert it
        setEmailPreferences({ weekly_recap: true }); // Set default display state
         // Optionally insert the default if you want it persisted immediately
         await supabase.from('email_preferences').insert([{ user_id: user.id, weekly_recap: true }]);
         console.log("Default email preferences created for user.");
      }
    } catch (error) {
      console.error('Error fetching/creating email preferences:', error);
      // Optionally show error to user
      setEmailPreferences({ weekly_recap: null }); // Indicate error state
    } finally {
        setLoading(false); // Done loading prefs
    }
  };

  const updateEmailPreferences = async (newPrefValue: boolean) => {
    if (!user || emailPreferences.weekly_recap === null) return; // Prevent update if not loaded

    // Optimistically update UI
    const oldPrefs = { ...emailPreferences };
    setEmailPreferences({ weekly_recap: newPrefValue });
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('email_preferences')
        .upsert({
          user_id: user.id, // user_id is the primary key or part of it
          weekly_recap: newPrefValue,
          updated_at: new Date().toISOString()
        }, {
            // If user_id is the primary key, onConflict isn't needed for single row upsert by PK
            // If you have a different PK or unique constraint, specify it here
             onConflict: 'user_id' // Assuming user_id is the PK or unique constraint
        });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Email preferences updated.' });
    } catch (error) {
      console.error("Error updating email prefs:", error);
      // Revert optimistic update on error
      setEmailPreferences(oldPrefs);
      setMessage({ type: 'error', text: 'Error updating preferences.' });
    } finally {
      setLoading(false);
      // Clear message after a few seconds
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { // Only include fields allowed in 'data'
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          // Add other metadata fields here if needed
        }
      });

      if (error) throw error;

      // Important: Supabase doesn't automatically update the user object in your Redux store
      // after updateUser metadata changes. You might need to re-fetch the user or dispatch an update manually
      // based on the 'data.user' returned IF it contains the updated metadata.
      // Check Supabase docs for what `updateUser` returns in `data.user`.
      // For now, just show success message. User might need to refresh for Navbar name update.
      console.log("Update user response:", data); // Check what's returned

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error) {
        console.error("Error updating profile:", error)
      setMessage({ type: 'error', text: `Error updating profile: ${(error as Error).message}` });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setMessage(null);

    if (!formData.newPassword || formData.newPassword.length < 6) {
         setMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
         setLoading(false);
         return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.newPassword
      });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Password updated successfully!' });
      setFormData(prev => ({ ...prev, newPassword: '', confirmPassword: '' })); // Clear fields

    } catch (error) {
      console.error("Error updating password:", error);
      setMessage({ type: 'error', text: `Error updating password: ${(error as Error).message}` });
    } finally {
      setLoading(false);
       setTimeout(() => setMessage(null), 4000);
    }
  };

  const resetPassword = async () => {
    if (!user?.email) return;
    setLoading(true);
    setMessage(null);

    try {
      // Redirect URL should point to where the user can handle the reset confirmation,
      // often the login page or a dedicated reset page. Let's use account page for now.
      const redirectUrl = `${window.location.origin}/account?tab=security`; // Ensure this matches Supabase settings

      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Password reset email sent! Check your inbox (and spam folder).' });
    } catch (error) {
      console.error("Error sending password reset:", error);
      setMessage({ type: 'error', text: `Error sending reset email: ${(error as Error).message}` });
    } finally {
      setLoading(false);
      // Don't auto-clear this message
    }
  };

  // Render loading state or null if user data isn't ready yet
  if (!user) {
    return null; // Or a loading spinner, handled by App.tsx usually
  }

  return (
    // --- Main Layout Wrapper ---
    <main className="min-h-screen w-full relative flex justify-center px-4 pt-16 pb-16 overflow-y-auto">
       {/* Background Image and Overlay */}
       <div className="fixed inset-0 z-0">
         <img
           src="https://img.heroui.chat/image/landscape?w=1920&h=1080&u=1"
           className="w-full h-full object-cover"
           alt="Background"
         />
         <div className="absolute inset-0 bg-black/20" />
       </div>

       {/* Content Area - Using max-w-4xl for settings */}
       <div className="w-full max-w-4xl z-10" ref={mainContentRef}>
         <div className="space-y-6">
            {/* --- Page Header (Styled) --- */}
            <div className="flex items-center gap-3">
                {/* Use text-white directly if mix-blend doesn't work well here */}
                <Settings className="h-8 w-8 text-white" />
                <h1 className="text-3xl font-bold text-white">Account Settings</h1>
            </div>

           {/* --- Main Settings Card (Styled) --- */}
           <div className="bg-card/80 backdrop-blur-sm shadow-lg border-border/50 rounded-lg text-card-foreground">
             {/* Tabs */}
             <div className="border-b border-border/50">
               <div className="flex space-x-1 px-2 sm:px-4"> {/* Added padding */}
                 <button
                   onClick={() => setActiveTab('profile')}
                   className={cn(
                       "px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors",
                       activeTab === 'profile'
                         ? 'border-primary text-primary'
                         : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                   )}
                 >
                   <User className="h-4 w-4" />
                   Profile
                 </button>
                 <button
                   onClick={() => setActiveTab('security')}
                   className={cn(
                       "px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors",
                       activeTab === 'security'
                         ? 'border-primary text-primary'
                         : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                    )}
                 >
                   <Lock className="h-4 w-4" />
                   Security
                 </button>
                 <button
                   onClick={() => setActiveTab('notifications')}
                   className={cn(
                       "px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors",
                       activeTab === 'notifications'
                         ? 'border-primary text-primary'
                         : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                   )}
                 >
                   <Bell className="h-4 w-4" />
                   Notifications
                 </button>
               </div>
             </div>

             {/* Tab Content */}
             <div className="p-6">
               {/* Message Display */}
               {message && (
                 <div
                   className={cn(
                       "mb-6 p-4 rounded-lg text-sm", // Base styles
                       message.type === 'success' && 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200 border border-green-200 dark:border-green-700/50',
                       message.type === 'error' && 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200 border border-red-200 dark:border-red-700/50'
                   )}
                 >
                   {message.text}
                 </div>
               )}

               {/* Profile Tab */}
               {activeTab === 'profile' && (
                 <form onSubmit={updateProfile} className="space-y-6">
                   <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
                     <div className="bg-muted rounded-full p-4 flex-shrink-0"> {/* Adjusted padding */}
                       <UserCircle className="h-16 w-16 text-muted-foreground" /> {/* Larger icon */}
                     </div>
                     <div className='text-center sm:text-left'>
                       <h2 className="text-lg font-semibold">
                          {/* Use form data for display consistency, fallback to user */}
                         {formData.firstName || user?.user_metadata?.first_name || ''} {formData.lastName || user?.user_metadata?.last_name || ''}
                       </h2>
                       <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1 mt-1">
                         <Mail className="h-4 w-4" />
                         {formData.email || user?.email || 'No email'}
                       </p>
                     </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                       <label htmlFor='firstName' className="block text-sm font-medium mb-1 text-card-foreground/80"> First Name * </label>
                       <input
                         id='firstName'
                         type="text"
                         value={formData.firstName}
                         onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                         className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                         required
                       />
                     </div>
                     <div>
                       <label htmlFor='lastName' className="block text-sm font-medium mb-1 text-card-foreground/80"> Last Name * </label>
                       <input
                          id='lastName'
                         type="text"
                         value={formData.lastName}
                         onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                         className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                         required
                       />
                     </div>
                   </div>

                   <div>
                     <label htmlFor='email' className="block text-sm font-medium mb-1 text-card-foreground/80"> Email Address </label>
                     <input
                       id='email'
                       type="email"
                       value={formData.email}
                       className="w-full p-2 rounded border border-input bg-background text-muted-foreground cursor-not-allowed" // Style as disabled
                       disabled // Disable email editing
                       readOnly
                     />
                     <p className="text-xs text-muted-foreground mt-1">
                       Email address cannot be changed here.
                     </p>
                   </div>

                   <button
                     type="submit"
                     disabled={loading}
                     className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md disabled:opacity-50 transition-colors text-sm font-medium shadow-sm"
                   >
                     {loading ? 'Saving...' : 'Save Profile Changes'}
                   </button>
                 </form>
               )}

               {/* Security Tab */}
               {activeTab === 'security' && (
                 <form onSubmit={updatePassword} className="space-y-6">
                   <h2 className="text-lg font-semibold">Change Password</h2>
                   <div>
                     <label htmlFor='newPassword' className="block text-sm font-medium mb-1 text-card-foreground/80"> New Password </label>
                     <input
                       id='newPassword'
                       type="password"
                       value={formData.newPassword}
                       onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                       className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                       minLength={6} // Enforce min length
                       required
                     />
                       <p className="text-xs text-muted-foreground mt-1">Minimum 6 characters.</p>
                   </div>

                   <div>
                     <label htmlFor='confirmPassword' className="block text-sm font-medium mb-1 text-card-foreground/80"> Confirm New Password </label>
                     <input
                       id='confirmPassword'
                       type="password"
                       value={formData.confirmPassword}
                       onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                       className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                       required
                     />
                   </div>

                   <div className="flex flex-col sm:flex-row gap-4 items-center pt-2">
                     <button
                       type="submit"
                       disabled={loading}
                       className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md disabled:opacity-50 transition-colors text-sm font-medium shadow-sm w-full sm:w-auto"
                     >
                       {loading ? 'Updating...' : 'Update Password'}
                     </button>
                     <p className="text-sm text-muted-foreground hidden sm:block">or</p>
                     <button
                       type="button"
                       onClick={resetPassword}
                       disabled={loading}
                       className="bg-muted hover:bg-muted/80 text-muted-foreground px-4 py-2 rounded-md transition-colors text-sm font-medium w-full sm:w-auto"
                     >
                       Send Password Reset Email
                     </button>
                   </div>
                 </form>
               )}

               {/* Notifications Tab */}
               {activeTab === 'notifications' && (
                 <div className="space-y-6">
                   <h2 className="text-lg font-semibold">Email Notifications</h2>

                   {emailPreferences.weekly_recap === null ? (
                       <p className='text-sm text-muted-foreground'>Loading preferences...</p>
                   ) : (
                       <div className="space-y-4">
                         <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-muted/50 border border-border/50 rounded-lg">
                           <div className='mb-2 sm:mb-0 sm:mr-4'>
                             <h3 className="font-medium">Weekly Recap Email</h3>
                             <p className="text-sm text-muted-foreground mt-1">
                               Receive a summary of your job search activity every Monday.
                             </p>
                           </div>
                           {/* Styled Toggle Switch */}
                           <label htmlFor="weekly_recap_toggle" className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                             <input
                               type="checkbox"
                               id="weekly_recap_toggle"
                               checked={!!emailPreferences.weekly_recap} // Use !! to ensure boolean
                               onChange={(e) => updateEmailPreferences(e.target.checked)}
                               className="sr-only peer"
                               disabled={loading}
                             />
                             <div className={cn(
                                 "w-11 h-6 rounded-full peer",
                                 "bg-input", // Use input background for off state
                                 "peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50", // Focus ring
                                 "peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white",
                                 "after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all",
                                 "peer-checked:bg-primary" // Primary color for on state
                             )}></div>
                             <span className="ms-3 text-sm font-medium text-muted-foreground">{loading ? 'Updating...' : (emailPreferences.weekly_recap ? 'On' : 'Off')}</span>
                           </label>
                         </div>
                       </div>
                   )}

                   {/* <div className="text-sm text-muted-foreground">
                     <p>More notification options coming soon!</p>
                   </div> */}
                 </div>
               )}
             </div> {/* End Tab Content */}
           </div> {/* End Main Settings Card */}

         </div> {/* End Space Y */}
       </div> {/* End Content Area */}
    </main> // End Main Page Container
  );
};

export default Account;