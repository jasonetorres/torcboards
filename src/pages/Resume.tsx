import React, { useState, useEffect, useRef } from 'react'; // Added useRef
import { Save, RefreshCw, Wand2, Upload, Copy, ExternalLink } from 'lucide-react'; // Added Copy icon
import Editor from '@monaco-editor/react';
import { supabase } from '../lib/supabase';
import { useSelector } from 'react-redux';
import { analyzeResume } from '../lib/openai'; // Assuming this exists and works
import ReactMarkdown from 'react-markdown';
import { v4 as uuidv4 } from 'uuid';
import { RootState } from '../store'; // Import RootState
import { cn } from '../lib/utils'; // Import cn utility

// Define types for component clarity
type ResumeData = {
  id: string;
  content: string;
  target_role: string | null; // Allow null target_role
};

const Resume = () => {
  const [resumes, setResumes] = useState<ResumeData[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  // Use state for editor content to avoid direct manipulation issues
  const [editorContent, setEditorContent] = useState<string>('');
  const [targetRole, setTargetRole] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [loadingAnalysis, setLoadingAnalysis] = useState(false); // Separate loading states
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const user = useSelector((state: RootState) => state.auth.user);
  const editorRef = useRef<any>(null); // Ref for Monaco Editor instance

  // Theme for editor based on app theme
  const appTheme = useSelector((state: RootState) => state.theme.theme);
  const editorTheme = appTheme === 'dark' ? 'vs-dark' : 'light';

  // Fetch resumes on mount or user change
  useEffect(() => {
    if (user) {
      fetchResumes();
    } else {
        setResumes([]);
        setSelectedResumeId(null);
        setEditorContent('');
        setTargetRole('');
        setAnalysis('');
    }
  }, [user]);

  // Update editor content and target role when selectedResumeId changes
  useEffect(() => {
    const selectedResume = resumes.find(r => r.id === selectedResumeId);
    setEditorContent(selectedResume?.content || '');
    setTargetRole(selectedResume?.target_role || '');
    setAnalysis(''); // Clear analysis when switching resumes
  }, [selectedResumeId, resumes]);


  const fetchResumes = async () => {
    if (!user) return;
    try {
        const { data, error } = await supabase
          .from('resumes')
          .select('id, content, target_role')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false }); // Order by updated

        if (error) throw error;

        if (data) {
          setResumes(data as ResumeData[]);
          // Select the first resume by default if none is selected or the current selection is invalid
          if (data.length > 0 && !selectedResumeId) {
            setSelectedResumeId(data[0].id);
          } else if (data.length === 0) {
            setSelectedResumeId(null); // No resumes exist
          }
        } else {
            setResumes([]);
            setSelectedResumeId(null);
        }
    } catch (error) {
        console.error("Error fetching resumes:", error);
        setMessage({ type: 'error', text: `Failed to load resumes: ${(error as Error).message}`});
    }
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  const saveResume = async () => {
    if (!user) return;

    const contentToSave = editorContent; // Use state variable
    const roleToSave = targetRole.trim() || null; // Save empty as null

    // Use existing ID or generate a new one if "New Resume" is implicitly selected
    const isNewResume = !selectedResumeId;
    const resumeIdToSave = selectedResumeId || uuidv4();

    setSaving(true);
    setMessage(null);

    try {
      const upsertData = {
        id: resumeIdToSave,
        user_id: user.id,
        content: contentToSave,
        target_role: roleToSave,
        updated_at: new Date().toISOString(),
      };

      // If it's a new resume, ensure created_at is set (handled by DB default or include here if needed)
      if (isNewResume) {
          // upsertData.created_at = new Date().toISOString(); // Only if DB doesn't handle it
      }

      const { error } = await supabase
        .from('resumes')
        .upsert(upsertData, { onConflict: 'id' }); // Upsert based on ID

      if (error) throw error;

      showMessage('Resume saved successfully!', 'success');

      // Refresh list and ensure the saved/new resume is selected
      await fetchResumes(); // Re-fetch data
      setSelectedResumeId(resumeIdToSave); // Ensure the saved one is selected

    } catch (error) {
        console.error("Error saving resume:", error);
        showMessage(`Error saving resume: ${(error as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const analyzeForRole = async () => {
    const currentContent = editorContent;
    if (!currentContent || !targetRole) {
        showMessage('Please select a resume, enter content, and specify a target role to analyze.', 'error');
        return;
    };
    if (!analyzeResume) {
        showMessage('AI analysis feature not available.', 'error');
        return;
    }

    setLoadingAnalysis(true);
    setAnalysis(''); // Clear previous analysis
    setMessage(null);

    try {
      const result = await analyzeResume(currentContent); // Call your OpenAI function
      setAnalysis(result || 'AI analysis did not return any content.');

      // Log analysis event (optional)
      if (user && result) {
        await supabase.from('ai_analyses').insert({
          user_id: user.id, type: 'resume', input: `Role: ${targetRole}\n\n${currentContent.substring(0, 500)}...`, result, // Log role + truncated input
        }).then(({ error }) => { if (error) console.error("Error logging AI analysis:", error); });
      }
      showMessage('Analysis complete.', 'success');
    } catch (error) {
        console.error("Error analyzing resume:", error);
        showMessage(`Error analyzing resume: ${(error as Error).message}`, 'error');
        setAnalysis('An error occurred during analysis.');
    } finally {
      setLoadingAnalysis(false);
    }
  };


  const handleEditorChange = (value: string | undefined) => {
     setEditorContent(value || '');
  };

  // Monaco editor mount handler
  const handleEditorDidMount = (editor: any, _monaco: any) => {
    editorRef.current = editor;
    // You can add editor specific configurations here if needed
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFileContent(file);
       // Reset file input value to allow uploading the same file again
       e.target.value = '';
    }
  };

  const readFileContent = (file: File) => {
    // Basic check for large files (e.g., > 1MB)
    if (file.size > 1024 * 1024) {
        showMessage('File is too large (max 1MB).', 'error');
        return;
    }
    // Check file type (more robust checks might be needed depending on expected content)
    if (!['text/plain', 'text/markdown', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
         // Note: Extracting text from PDF/DOCX requires server-side processing or more complex libraries (mammoth.js, pdf.js)
         // This basic FileReader only works well for .txt and potentially .md
         if (file.type.startsWith('text/')) {
            console.log("Reading text file...");
         } else {
             showMessage('Unsupported file type for direct text reading. Please use TXT or MD.', 'error');
             return;
         }
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        // Update content of the currently selected resume (or treat as new if none selected)
         setEditorContent(text);
         showMessage(`Content from ${file.name} loaded into editor. Remember to save.`, 'success');
         // If no resume is selected (meaning "New Resume"), prepare to save as new
         if (!selectedResumeId) {
            setTargetRole(''); // Clear target role for potentially new resume from file
         }
      } else {
          showMessage('Could not read file content.', 'error');
      }
    };
     reader.onerror = (error) => {
        console.error("Error reading file:", error);
        showMessage('Error reading file.', 'error');
     };
    reader.readAsText(file); // Only reads as text
  };

  // Function to generate shareable link (consider security implications)
  const getShareableLink = (resumeId: string | null): string | null => {
    if (!resumeId) return null;
    // Ensure origin is correctly determined (works in most modern browsers)
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/resume-view/${resumeId}`;
  };

  // Function to copy link to clipboard
  const copyShareLink = () => {
    const link = getShareableLink(selectedResumeId);
    if (link && navigator.clipboard) {
        navigator.clipboard.writeText(link)
            .then(() => showMessage('Shareable link copied to clipboard!', 'success'))
            .catch(err => {
                console.error('Failed to copy link: ', err);
                showMessage('Failed to copy link.', 'error');
            });
    } else if (link) {
        // Fallback for older browsers (less common now)
        showMessage('Clipboard copy not supported or no link available.', 'error');
    }
  };

  // Handle selection change for "New Resume"
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      if (value === "new") { // Use a specific value for "New Resume"
          setSelectedResumeId(null);
          setEditorContent('');
          setTargetRole('');
          setAnalysis('');
      } else {
          setSelectedResumeId(value);
          // Content and role will be updated by the useEffect hook listening to selectedResumeId
      }
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

      {/* Content Area */}
      <div className="w-full max-w-7xl z-10">
        <div className="space-y-6">
          {/* --- Page Header (Styled & Restructured) --- */}
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               {/* Title */}
              <h1 className="text-3xl font-bold text-white mix-blend-screen flex items-center gap-2 flex-shrink-0">
                Resume Editor & Analyzer
              </h1>
              {/* Controls Grouped */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-3 w-full md:w-auto">
                 {/* Select Resume */}
                 <div className='min-w-[150px]'>
                    <label htmlFor="resumeSelect" className="block text-xs font-medium mb-1 text-muted-foreground"> Resume Version </label>
                    <select
                      id="resumeSelect"
                      value={selectedResumeId || "new"} // Use "new" as value for the placeholder option
                      onChange={handleSelectChange}
                      className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm appearance-none bg-chevron-down bg-no-repeat bg-right" // Standard input style
                    >
                      {/* Add a dedicated option for creating a new resume */}
                       <option value="new" disabled={!selectedResumeId && editorContent === ''}>-- New Resume --</option>
                      {resumes.map((resume) => (
                        <option key={resume.id} value={resume.id}>
                          {resume.target_role || `Resume (${resume.id.substring(0, 6)})`}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Target Role Input */}
                  <div className='min-w-[180px]'>
                    <label htmlFor="targetRole" className="block text-xs font-medium mb-1 text-muted-foreground"> Target Role </label>
                    <input
                      id="targetRole"
                      type="text"
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      placeholder="e.g., Sr. Software Engineer"
                      className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm" // Standard input style
                    />
                  </div>
                  {/* Action Buttons */}
                    {/* Upload */}
                    <label
                      htmlFor="resumeUpload"
                      className="bg-muted hover:bg-muted/80 text-muted-foreground px-3 py-2 rounded-md flex items-center justify-center gap-2 text-sm cursor-pointer transition-colors h-full" // Use h-full to match input height
                      title='Upload (.txt, .md)'
                    >
                      <Upload className="h-4 w-4" />
                      <span>Upload</span>
                       <input type="file" id="resumeUpload" accept=".txt,.md" onChange={handleFileChange} className="hidden"/>
                    </label>
                    {/* Analyze */}
                    <button
                      onClick={analyzeForRole}
                      disabled={loadingAnalysis || !editorContent || !targetRole}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md flex items-center justify-center gap-2 text-sm disabled:opacity-50 transition-colors h-full"
                      title={!editorContent || !targetRole ? "Enter content and target role first" : "Analyze resume for target role"}
                    >
                      <Wand2 className="h-4 w-4" />
                      {loadingAnalysis ? 'Analyzing...' : 'Analyze'}
                    </button>
                    {/* Save */}
                    <button
                      onClick={saveResume}
                      disabled={saving || !editorContent} // Disable if no content
                      className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-2 rounded-md flex items-center justify-center gap-2 text-sm disabled:opacity-50 transition-colors h-full"
                      title={!editorContent ? "Enter content to save" : "Save resume"}
                    >
                      {saving ? ( <RefreshCw className="h-4 w-4 animate-spin" /> ) : ( <Save className="h-4 w-4" /> )}
                      {saving ? 'Saving...' : 'Save'}
                    </button>
              </div>
           </div>
          {/* --- End Page Header --- */}


            {/* Message Display Area */}
           {message && (
             <div className={cn( "p-3 rounded-lg text-sm", // Base styles
                 message.type === 'success' && 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200 border border-green-200 dark:border-green-700/50',
                 message.type === 'error' && 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200 border border-red-200 dark:border-red-700/50' )} >
               {message.text}
             </div>
           )}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start"> {/* Use items-start */}
            {/* Editor Card */}
            {/* Apply consistent card styling */}
            <div className="bg-card/80 backdrop-blur-sm shadow-lg border-border/50 rounded-lg text-card-foreground overflow-hidden">
              <div className="p-3 border-b border-border/50"> {/* Reduced padding for header */}
                <h2 className="text-base font-semibold">Resume Content (Markdown supported)</h2>
              </div>
              {/* Ensure editor container allows height */}
              <div className="min-h-[400px] h-[50vh] max-h-[600px] text-sm">
                  <Editor
                    // height="100%" // Let container control height
                    defaultLanguage="markdown"
                    value={editorContent}
                    onChange={handleEditorChange}
                    onMount={handleEditorDidMount}
                    theme={editorTheme} // Use dynamic theme
                    options={{
                      minimap: { enabled: false },
                      lineNumbers: 'on', // Keep line numbers for easier editing
                      wordWrap: 'on',
                      wrappingIndent: 'same', // 'same' often looks better
                      fontSize: 13, // Slightly smaller font for editor
                      scrollBeyondLastLine: false,
                      automaticLayout: true, // Helps with resizing
                      padding: { top: 10, bottom: 10 } // Internal padding
                    }}
                  />
              </div>
            </div>

            {/* Analysis Card */}
            {/* Apply consistent card styling */}
            <div className="bg-card/80 backdrop-blur-sm shadow-lg border-border/50 rounded-lg text-card-foreground overflow-hidden min-h-[400px] h-[50vh] max-h-[600px] flex flex-col">
              <div className="p-3 border-b border-border/50 flex-shrink-0">
                <h2 className="text-base font-semibold">AI Analysis {targetRole ? `for "${targetRole}"` : ''}</h2>
              </div>
              <div className="p-4 sm:p-6 flex-grow overflow-y-auto prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-headings:my-2">
                {loadingAnalysis ? (
                  <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    Analyzing...
                  </div>
                ) : analysis ? (
                  <ReactMarkdown>{analysis}</ReactMarkdown>
                ) : (
                  <div className="text-muted-foreground text-center pt-10">
                      Enter resume content and a target role, then click "Analyze" above.
                  </div>
                )}
              </div>
            </div>
          </div>

            {/* Shareable Link Card (Styled) */}
            {selectedResumeId && getShareableLink(selectedResumeId) && (
                <div className="bg-card/80 backdrop-blur-sm shadow-lg border-border/50 rounded-lg text-card-foreground p-4">
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Shareable Link (Read-Only View):
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                       type="text"
                       readOnly
                       value={getShareableLink(selectedResumeId) || ''}
                       className="flex-grow p-1.5 rounded border border-input bg-background text-xs truncate" // Smaller text for link
                    />
                    <button
                       onClick={copyShareLink}
                       className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
                       title="Copy link"
                    >
                       <Copy className="h-4 w-4" />
                    </button>
                     <a
                        href={getShareableLink(selectedResumeId)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
                        title="Open link in new tab"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                  </div>
                </div>
            )}

        </div> {/* End Space Y */}
      </div> {/* End Content Area */}
    </main> // End Main Page Container
  );
};

export default Resume;