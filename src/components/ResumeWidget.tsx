import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Upload, RefreshCw, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase'; // Ensure this path is correct
import { useSelector } from 'react-redux';

// Helper to format date
const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return null;
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (e) {
    console.warn("Invalid date string for formatDate:", dateString);
    return "Invalid Date";
  }
};

export function ResumeWidget() {
  const [resumeContent, setResumeContent] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const user = useSelector((state: any) => state.auth.user);

  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const fetchResume = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setResumeContent('');
      setTargetRole('');
      setLastUpdatedAt(null);
      return;
    }
    setIsLoading(true);
    clearMessages();
    try {
      const { data: resume, error: fetchError } = await supabase
        .from('resumes')
        .select('content, target_role, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (resume) {
        setResumeContent(resume.content || '');
        setTargetRole(resume.target_role || '');
        setLastUpdatedAt(resume.updated_at);
      } else {
        setResumeContent('');
        setTargetRole('');
        setLastUpdatedAt(null);
      }
    } catch (err: any) {
      console.error('Error fetching resume:', err);
      setError(`Failed to load resume: ${err.message || 'Unknown error'}`);
      setResumeContent('');
      setTargetRole('');
      setLastUpdatedAt(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchResume();
  }, [fetchResume]);

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    clearMessages();
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    } else {
      setSelectedFile(null);
    }
    event.target.value = ''; // Reset file input value
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !user) return;

    setUploading(true);
    clearMessages();

    try {
      let operationMessage = 'Resume processed and updated successfully!'; // Default success message

      if (selectedFile.type === "text/plain" || selectedFile.type === "text/markdown") {
        console.log("Processing plain text or markdown file...");
        const textContent = await selectedFile.text();
        if (textContent.trim() === "") {
          throw new Error("The selected text file appears to be empty.");
        }

        const newUpdatedAt = new Date().toISOString();
        const { error: upsertError } = await supabase
          .from('resumes')
          .upsert({
            user_id: user.id,
            content: textContent,
            target_role: targetRole, // Preserves current targetRole from state
            updated_at: newUpdatedAt,
          });
        if (upsertError) throw upsertError;

        setResumeContent(textContent); // Optimistic update
        setLastUpdatedAt(newUpdatedAt);

      } else if (selectedFile.type === "application/pdf") {
        console.log("PDF selected. Uploading to storage and invoking Edge Function...");
        operationMessage = 'PDF submitted for processing. Content will update upon completion.';

        const filePath = `resumes/${user.id}/${Date.now()}_${selectedFile.name}`;
        const { data: storageData, error: storageError } = await supabase.storage
          .from('resume-files') // Your Supabase storage bucket name
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: false, // Usually false for new uploads to avoid accidental overwrites by same name
          });

        if (storageError) {
          console.error('Supabase Storage Error:', storageError);
          throw new Error(`Failed to upload PDF to storage: ${storageError.message}`);
        }
        console.log('File uploaded to storage:', storageData.path);

        const { data: functionResult, error: functionError } = await supabase.functions.invoke(
          'parse-resume', // Your Edge Function name
          {
            body: {
              filePath: storageData.path,
              userId: user.id,
              targetRole: targetRole,
            },
          }
        );

        if (functionError) {
          console.error('Supabase Function Error:', functionError);
          const specificError = functionError.context?.error?.message || functionError.message || "Unknown function error";
          throw new Error(`Failed to process resume via Edge Function: ${specificError}`);
        }
        
        console.log('Edge Function Result:', functionResult);
        await fetchResume(); // Re-fetch to get the latest content updated by the Edge Function

      } else if (
        selectedFile.type === "application/msword" || // .doc
        selectedFile.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" // .docx
      ) {
        // Placeholder for DOC/DOCX - requires similar server-side parsing logic
        console.error(`Attempting to process file type: ${selectedFile.type}. This requires a dedicated server-side parser.`);
        throw new Error(`Server-side parsing for ${selectedFile.type.toUpperCase()} documents is not yet implemented. Please use a .txt, .md, or .pdf file for now.`);
      } else {
        throw new Error(`Unsupported file type: ${selectedFile.type}. Please upload a .txt, .md, or .pdf file.`);
      }

      setSelectedFile(null); // Clear selected file after successful processing
      setSuccessMessage(operationMessage);

    } catch (err: any) {
      console.error('Error in handleFileUpload:', err);
      setError(`${err.message || 'Could not process file.'}`);
    } finally {
      setUploading(false);
    }
  };

  const fileInputAccept = ".txt,.md,.pdf,.doc,.docx";

  if (isLoading) {
    return (
      <div className="p-4 rounded-lg animate-pulse"> {/* Adjusted for blended background */}
        <div className="h-6 bg-muted rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-muted rounded w-full mb-2"></div>
        <div className="h-4 bg-muted rounded w-full mb-2"></div>
        <div className="h-4 bg-muted rounded w-3/4"></div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg text-card-foreground"> {/* Adjusted for blended background */}
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <FileText className="h-5 w-5" />
        Resume
      </h2>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm">{error}</p>
        </div>
      )}
      {successMessage && (
        <div className="mb-4 p-3 rounded-md bg-green-500/10 text-green-700 flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          <p className="text-sm">{successMessage}</p>
        </div>
      )}

      {resumeContent ? (
        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg"> {/* bg-muted should respect your theme */}
            {targetRole && (
              <p className="text-sm text-muted-foreground mb-1">
                Target Role: {targetRole}
              </p>
            )}
            <p className="text-sm line-clamp-3">{resumeContent}</p>
            {lastUpdatedAt && (
              <p className="text-xs text-muted-foreground mt-2">
                Last updated: {formatDate(lastUpdatedAt)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            {selectedFile && (
              <div className="text-sm text-muted-foreground">
                Selected: {selectedFile.name} ({selectedFile.type || 'unknown type'})
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className={`flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md cursor-pointer hover:bg-primary/90 ${uploading || !user ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {uploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? 'Processing...' : (selectedFile ? 'Confirm Update' : 'Choose File to Update')}
                <input
                  type="file"
                  accept={fileInputAccept}
                  onChange={handleFileSelection}
                  className="hidden"
                  disabled={uploading || !user}
                />
              </label>
              {selectedFile && !uploading && user && (
                <button
                  onClick={handleFileUpload}
                  className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/90"
                  disabled={uploading}
                >
                  Upload Now
                </button>
              )}
            </div>
          </div>
           <Link
              to="/resume"
              className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              View & Edit Full Resume <ExternalLink className="h-3 w-3" />
            </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {user ? 'No resume found.' : 'Please log in to manage your resume.'} Upload your resume to get AI-powered suggestions and track your applications.
          </p>
          {selectedFile && (
            <div className="text-sm text-muted-foreground">
              Selected: {selectedFile.name} ({selectedFile.type || 'unknown type'})
            </div>
          )}
          { user && (
            <div>
              <label className={`w-fit flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md cursor-pointer hover:bg-primary/90 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {uploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? 'Processing...' : (selectedFile ? 'Confirm Upload' : 'Choose Resume File')}
                <input
                  type="file"
                  accept={fileInputAccept}
                  onChange={handleFileSelection}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
              {selectedFile && !uploading && (
                  <button
                    onClick={handleFileUpload}
                    className="mt-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/90"
                    disabled={uploading}
                  >
                    Upload Now
                  </button>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}