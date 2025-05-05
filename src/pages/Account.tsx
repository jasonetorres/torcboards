import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings, Lock, Mail, UserCircle, Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSelector } from 'react-redux'; // Import useSelector


const Account = () => {
  const user = useSelector((state: any) => state.auth.user); // Use useSelector
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [emailPreferences, setEmailPreferences] = useState({
    weekly_recap: true
  });

  const [formData, setFormData] = useState({
    firstName: user?.user_metadata?.first_name || '',
    lastName: user?.user_metadata?.last_name || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    } else {
      fetchEmailPreferences();
    }
  }, [user, navigate]);

  const fetchEmailPreferences = async () => {
    if (!user) return;

    try {
      // First try to get existing preferences
      const { data: existingPrefs, error } = await supabase
        .from('email_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existingPrefs && !error) {
        // Create default preferences if none exist
        const { data: newPrefs } = await supabase
          .from('email_preferences')
          .insert([{
            user_id: user.id,
            weekly_recap: true
          }])
          .select()
          .single();

        if (newPrefs) {
          setEmailPreferences(newPrefs);
        }
      } else if (existingPrefs) {
        setEmailPreferences(existingPrefs);
      }
    } catch (error) {
      console.error('Error fetching email preferences:', error);
    }
  };

  const updateEmailPreferences = async (weekly_recap: boolean) => {
    if (!user) return;

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('email_preferences')
        .upsert({
          user_id: user.id,
          weekly_recap,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setEmailPreferences({ weekly_recap });
      setMessage({
        type: 'success',
        text: 'Email preferences updated successfully!'
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error updating email preferences. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: formData.firstName,
          last_name: formData.lastName,
        }
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Profile updated successfully!'
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error updating profile. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (formData.newPassword !== formData.confirmPassword) {
      setMessage({
        type: 'error',
        text: 'New passwords do not match.'
      });
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.newPassword
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Password updated successfully!'
      });

      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error updating password. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user?.email || '', {
        redirectTo: `${window.location.origin}/account?tab=security`,
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Password reset email sent! Please check your inbox.'
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error sending reset email. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="h-8 w-8" />
        <h1 className="text-3xl font-bold">Account Settings</h1>
      </div>

      <div className="bg-card text-card-foreground rounded-lg shadow-md">
        <div className="border-b border-border">
          <div className="flex">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-6 py-4 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'profile'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <User className="h-4 w-4" />
              Profile
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`px-6 py-4 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'security'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Lock className="h-4 w-4" />
              Security
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`px-6 py-4 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'notifications'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Bell className="h-4 w-4" />
              Notifications
            </button>
          </div>
        </div>

        <div className="p-6">
          {message && (
            <div
              className={`mb-6 p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              }`}
            >
              {message.text}
            </div>
          )}

          {activeTab === 'profile' && (
            <form onSubmit={updateProfile} className="space-y-6">
              <div className="flex items-center gap-4 mb-8">
                <div className="bg-muted rounded-full p-6">
                  <UserCircle className="h-12 w-12 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">
                    {user?.user_metadata?.first_name} {user?.user_metadata?.last_name}
                  </h2>
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {user?.email}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="w-full p-2 rounded border border-input bg-background"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="w-full p-2 rounded border border-input bg-background"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  className="w-full p-2 rounded border border-input bg-background"
                  disabled
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Contact support to change your email address
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}

          {activeTab === 'security' && (
            <form onSubmit={updatePassword} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, newPassword: e.target.value })
                  }
                  className="w-full p-2 rounded border border-input bg-background"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  className="w-full p-2 rounded border border-input bg-background"
                  required
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
                <button
                  type="button"
                  onClick={resetPassword}
                  disabled={loading}
                  className="bg-muted text-muted-foreground px-4 py-2 rounded-md hover:bg-muted/80 disabled:opacity-50"
                >
                  Send Password Reset Email
                </button>
              </div>
            </form>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Email Notifications</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <h3 className="font-medium">Weekly Recap</h3>
                    <p className="text-sm text-muted-foreground">
                      Receive a weekly summary of your job search progress, upcoming interviews, and tasks.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailPreferences.weekly_recap}
                      onChange={(e) => updateEmailPreferences(e.target.checked)}
                      className="sr-only peer"
                      disabled={loading}
                    />
                    <div className={`
                      w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4
                      peer-focus:ring-primary/20 rounded-full peer
                      peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full
                      peer-checked:after:border-white after:content-[''] after:absolute
                      after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300
                      after:border after:rounded-full after:h-5 after:w-5 after:transition-all
                      peer-checked:bg-primary
                    `}></div>
                  </label>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>Weekly recaps are sent every Monday at 9am UTC.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Account;