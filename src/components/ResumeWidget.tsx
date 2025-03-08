import React, { useState, useEffect } from 'react';
import { FileText, Upload, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export function ResumeWidget() {
  const [resumeContent, setResumeContent] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [uploading, setUploading] = useState(false);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (user) {
      fetchResume();
    }
  }, [user]);

  const fetchResume = async () => {
    const { data: resume } = await supabase
      .from('resumes')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (resume) {
      setResumeContent(resume.content || '');
      setTargetRole(resume.target_role || '');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const text = await file.text();
      
      await supabase
        .from('resumes')
        .upsert({
          user_id: user.id,
          content: text,
          target_role: targetRole,
          updated_at: new Date().toISOString()
        });

      setResumeContent(text);
    } catch (error) {
      console.error('Error uploading resume:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <FileText className="h-5 w-5" />
        Resume
      </h2>

      {resumeContent ? (
        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">
              {targetRole ? `Target Role: ${targetRole}` : 'No target role set'}
            </p>
            <p className="text-sm line-clamp-3">
              {resumeContent}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md cursor-pointer hover:bg-primary/90">
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading...' : 'Update'}
              <input
                type="file"
                accept=".txt,.md,.doc,.docx,.pdf"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
            <Link
              to="/resume"
              className="text-primary hover:underline text-sm"
            >
              Edit resume →
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload your resume to get AI-powered suggestions and track your applications.
          </p>
          <label className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md cursor-pointer hover:bg-primary/90 w-fit">
            {uploading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? 'Uploading...' : 'Upload Resume'}
            <input
              type="file"
              accept=".txt,.md,.doc,.docx"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
      )}
    </>
  );
}