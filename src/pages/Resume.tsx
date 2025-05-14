import React, { useState, useEffect, useRef } from 'react';
import { Save, RefreshCw, Wand2, Upload, Copy, ExternalLink, CheckSquare, Trash2, Download } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { supabase } from '../lib/supabase';
import { useSelector } from 'react-redux';
import { analyzeResume, EnhancedAnalysisResult } from '../lib/openai';
import ReactMarkdown from 'react-markdown';
import { v4 as uuidv4 } from 'uuid';
import { RootState } from '../store';
import { cn } from '../lib/utils';

import * as pdfjsLib from 'pdfjs-dist'; 

import jsPDF from 'jspdf';

// --- PDFjs Worker Configuration ---
// Use the imported pdfjsLib object to get the version for the CDN path
pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;


// --- Type Definitions ---
type ResumeData = {
  id: string;
  content: string;
  target_role: string | null;
};

// --- Component ---
const Resume = () => {
  const [resumes, setResumes] = useState<ResumeData[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [targetRole, setTargetRole] = useState('');
  const [analysisResult, setAnalysisResult] = useState<EnhancedAnalysisResult | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const user = useSelector((state: RootState) => state.auth.user);
  const editorRef = useRef<any>(null);

  const appTheme = useSelector((state: RootState) => state.theme.theme);
  const editorTheme = appTheme === 'dark' ? 'vs-dark' : 'light';

  // --- Effects ---
  useEffect(() => {
    if (user) {
      fetchResumes();
    } else {
      setResumes([]);
      setSelectedResumeId(null);
      setEditorContent('');
      setTargetRole('');
      setAnalysisResult(null);
    }
  }, [user]);

  useEffect(() => {
    const selectedResume = resumes.find(r => r.id === selectedResumeId);
    setEditorContent(selectedResume?.content || '');
    setTargetRole(selectedResume?.target_role || '');
    setAnalysisResult(null);
  }, [selectedResumeId, resumes]);

  // --- Data Fetching ---
  const fetchResumes = async () => {
     if (!user) return;
     try {
         const { data, error } = await supabase
           .from('resumes')
           .select('id, content, target_role')
           .eq('user_id', user.id)
           .order('updated_at', { ascending: false });

         if (error) throw error;

         if (data) {
           setResumes(data as ResumeData[]);
           if (data.length > 0 && (!selectedResumeId || !data.find(r => r.id === selectedResumeId))) {
             setSelectedResumeId(data[0].id);
           } else if (data.length === 0) {
             setSelectedResumeId(null);
             setEditorContent('');
             setTargetRole('');
           }
         } else {
             setResumes([]);
             setSelectedResumeId(null);
             setEditorContent('');
             setTargetRole('');
         }
     } catch (error) {
         console.error("Error fetching resumes:", error);
         showMessage(`Failed to load resumes: ${(error as Error).message}`, 'error');
     }
  };

  // --- UI Messages ---
  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // --- Core Actions ---
  const saveResume = async () => {
     if (!user) return;
     const contentToSave = editorContent;
     const roleToSave = targetRole.trim() || null;
     const isNewResume = !selectedResumeId;
     const resumeIdToSave = selectedResumeId || uuidv4();
     setSaving(true);
     setMessage(null);
     try {
       const upsertData: any = {
         id: resumeIdToSave,
         user_id: user.id,
         content: contentToSave,
         target_role: roleToSave,
         updated_at: new Date().toISOString(),
       };
       const { error } = await supabase.from('resumes').upsert(upsertData, { onConflict: 'id' });
       if (error) throw error;
       showMessage('Resume saved successfully!', 'success');
       const currentResumes = [...resumes];
       const resumeIndex = currentResumes.findIndex(r => r.id === resumeIdToSave);
       if (isNewResume || resumeIndex === -1) {
           await fetchResumes();
           setSelectedResumeId(resumeIdToSave);
       } else {
           currentResumes[resumeIndex] = { ...currentResumes[resumeIndex], content: contentToSave, target_role: roleToSave };
           setResumes(currentResumes);
           setSelectedResumeId(resumeIdToSave);
       }
     } catch (error) {
         console.error("Error saving resume:", error);
         showMessage(`Error saving resume: ${(error as Error).message}`, 'error');
     } finally {
       setSaving(false);
     }
  };

  const deleteResume = async () => {
     if (!selectedResumeId || !user) {
       showMessage('Please select a resume to delete.', 'error');
       return;
     }
     const resumeToDelete = resumes.find(r => r.id === selectedResumeId);
     const resumeIdentifier = resumeToDelete?.target_role || `ID: ${selectedResumeId.substring(0,6)}`;
     if (!window.confirm(`Are you sure you want to permanently delete this resume version?\n(${resumeIdentifier})`)) {
         return;
     }
     setDeleting(true);
     setMessage(null);
     try {
       const { error } = await supabase.from('resumes').delete().match({ id: selectedResumeId, user_id: user.id });
       if (error) throw error;
       showMessage('Resume deleted successfully!', 'success');
       const currentlySelected = selectedResumeId;
       setSelectedResumeId(null);
       setEditorContent('');
       setTargetRole('');
       setAnalysisResult(null);
       setResumes(prevResumes => prevResumes.filter(r => r.id !== currentlySelected));
       await fetchResumes();
     } catch (error) {
       console.error("Error deleting resume:", error);
       showMessage(`Error deleting resume: ${(error as Error).message}`, 'error');
     } finally {
       setDeleting(false);
     }
  };

  const analyzeForRole = async () => {
     const currentContent = editorContent;
     if (!currentContent || !targetRole) {
       showMessage('Please enter resume content and specify a target role to analyze.', 'error');
       return;
     }
     if (!analyzeResume) {
       showMessage('AI analysis feature not available.', 'error');
       return;
     }
     setLoadingAnalysis(true);
     setAnalysisResult(null);
     setMessage(null);
     try {
       const result = await analyzeResume(currentContent, targetRole);
       setAnalysisResult(result);
       if (user && result?.suggestionsMarkdown) {
         await supabase.from('ai_analyses').insert({
           user_id: user.id, type: 'resume', input: `Role: ${targetRole}\n\n${currentContent.substring(0, 500)}...`,
           result: result.suggestionsMarkdown,
         }).then(({ error }) => { if (error) console.error("Error logging AI analysis:", error); });
       }
       showMessage('Analysis complete.', 'success');
     } catch (error) {
       console.error("Error analyzing resume:", error);
       const errorMsg = `Error analyzing resume: ${(error as Error).message}`;
       showMessage(errorMsg, 'error');
       setAnalysisResult({ suggestionsMarkdown: `An error occurred during analysis: ${errorMsg}` });
     } finally {
       setLoadingAnalysis(false);
     }
  };

  const applyCorrectedResume = () => {
     if (analysisResult?.correctedResumeMarkdown) {
       setEditorContent(analysisResult.correctedResumeMarkdown);
       showMessage('AI corrected version applied to editor. Review and save.', 'success');
     } else {
       showMessage('No AI corrected version available to apply.', 'error');
     }
  };

  // --- Download Function ---
  const downloadResume = () => {
    if (!editorContent) {
      showMessage('Nothing to download. Editor is empty.', 'error');
      return;
    }
    const filenameBase = targetRole || (selectedResumeId ? `resume-${selectedResumeId.substring(0,6)}` : 'resume');
    const filename = `${filenameBase.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'letter' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 40;
      const usableWidth = pageWidth - 2 * margin;
      let yPos = margin;
      const lines = doc.splitTextToSize(editorContent, usableWidth);
      lines.forEach((line: string) => {
          if (yPos + 12 > pageHeight - margin) {
              doc.addPage();
              yPos = margin;
          }
          doc.text(line, margin, yPos);
          yPos += 14;
      });
      doc.save(filename);
    } catch (error) {
        console.error("Error generating PDF:", error);
        showMessage('Failed to generate PDF for download.', 'error');
    }
  };


  // --- File Upload Handling ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFileContent(file);
      e.target.value = '';
    }
  };

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let allText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      // Type the item parameter explicitly
      const pageText = textContent.items.map((item: any) => { // Use any for now if TextItem import fails
          // Basic check if item has 'str' property
          if (typeof item === 'object' && item !== null && 'str' in item) {
              return item.str;
          }
          return ''; // Return empty string for items without 'str'
      }).join(' '); // Join text pieces with a space
      allText += pageText + "\n\n"; // Add space between pages
    }
    return allText;
  };


  const readFileContent = async (file: File) => {
    setFileLoading(true);
    setMessage(null);
    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File is too large (max 5MB).');
      }
      let text = '';
      if (file.type === 'application/pdf') {
          console.log("Reading PDF file...");
          text = await extractTextFromPdf(file);
      } else if (file.type === 'text/plain' || file.type === 'text/markdown' || file.type.startsWith('text/')) {
          console.log("Reading text/markdown file...");
          text = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target?.result as string);
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
          });
      } else {
          throw new Error('Unsupported file type. Please use PDF, TXT, or MD.');
      }
      if (text) {
        setEditorContent(text);
        showMessage(`Content from ${file.name} loaded. Remember to save.`, 'success');
        if (!selectedResumeId) {
          setTargetRole('');
          setAnalysisResult(null);
        }
      } else {
        throw new Error('Could not read content from file.');
      }
    } catch (error) {
        console.error("Error reading file:", error);
        showMessage(`Error reading file: ${(error as Error).message}`, 'error');
    } finally {
        setFileLoading(false);
    }
  };

  // --- Other Handlers ---
  const handleEditorChange = (value: string | undefined) => {
    setEditorContent(value || '');
  };

  const handleEditorDidMount = (editor: any, _monaco: any) => {
    editorRef.current = editor;
  };

  const getShareableLink = (resumeId: string | null): string | null => {
     if (!resumeId) return null;
     const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
     return `${baseUrl}/resume-view/${resumeId}`;
  };

  const copyShareLink = () => {
     const link = getShareableLink(selectedResumeId);
     if (link && navigator.clipboard) {
       navigator.clipboard.writeText(link)
         .then(() => showMessage('Shareable link copied!', 'success'))
         .catch(err => {
           console.error('Failed to copy link: ', err);
           showMessage('Failed to copy link.', 'error');
         });
     } else if (link) {
       showMessage('Clipboard copy not supported or no link.', 'error');
     }
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
     const value = e.target.value;
     if (value === "new") {
       setSelectedResumeId(null);
       setEditorContent('');
       setTargetRole('');
       setAnalysisResult(null);
     } else {
       setSelectedResumeId(value);
     }
  };

  // --- Render ---
  return (
    // --- Root JSX and structure remains the same ---
    // Ensure Upload input 'accept' includes '.pdf'
    // Ensure Download button title indicates PDF download
    // (The JSX provided in the previous answer already had these minor UI tweaks)
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
          {/* --- Page Header --- */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h1 className="text-3xl font-bold text-white mix-blend-screen flex items-center gap-2 flex-shrink-0">
              Resume Editor & Analyzer
            </h1>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap items-end gap-3 w-full md:w-auto">
              {/* Select Resume */}
              <div className='min-w-[150px]'>
                <label htmlFor="resumeSelect" className="block text-xs font-medium mb-1 text-muted-foreground">Resume Version</label>
                <select
                  id="resumeSelect"
                  value={selectedResumeId || "new"}
                  onChange={handleSelectChange}
                  disabled={fileLoading || deleting || saving || loadingAnalysis} // Disable during operations
                  className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm appearance-none bg-chevron-down bg-no-repeat bg-right disabled:opacity-70"
                >
                  <option value="new" disabled={!selectedResumeId && editorContent === '' && resumes.length === 0}>-- New Resume --</option>
                  {resumes.map((resume) => (
                    <option key={resume.id} value={resume.id}>
                      {resume.target_role || `Resume (${resume.id.substring(0, 6)})`}
                    </option>
                  ))}
                </select>
              </div>
              {/* Target Role Input */}
              <div className='min-w-[180px]'>
                <label htmlFor="targetRole" className="block text-xs font-medium mb-1 text-muted-foreground">Target Role</label>
                <input
                  id="targetRole"
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g., Sr. Software Engineer"
                   disabled={fileLoading || deleting || saving || loadingAnalysis}
                  className="w-full p-2 rounded border border-input bg-background focus:ring-2 focus:ring-primary/50 outline-none text-sm disabled:opacity-70"
                />
              </div>
              {/* --- Action Buttons --- */}
                {/* Upload */}
                <label
                  htmlFor="resumeUpload"
                  className={cn(
                    "bg-muted hover:bg-muted/80 text-muted-foreground px-3 py-2 rounded-md flex items-center justify-center gap-2 text-sm cursor-pointer transition-colors h-full",
                    (fileLoading || deleting || saving || loadingAnalysis) && "opacity-50 cursor-not-allowed" // Disable visually
                  )}
                  title='Upload (.txt, .md, .pdf)' // Updated title
                >
                  {fileLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" /> }
                  <span>{fileLoading ? 'Reading...' : 'Upload'}</span>
                   <input
                     type="file"
                     id="resumeUpload"
                     accept=".txt,.md,.pdf" // Accept PDF
                     onChange={handleFileChange}
                     className="hidden"
                     disabled={fileLoading || deleting || saving || loadingAnalysis} // Disable input during operations
                   />
                </label>
                {/* Analyze */}
                <button
                  onClick={analyzeForRole}
                  disabled={loadingAnalysis || saving || deleting || fileLoading || !editorContent || !targetRole}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md flex items-center justify-center gap-2 text-sm disabled:opacity-50 transition-colors h-full"
                  title={!editorContent || !targetRole ? "Enter content and target role first" : "Analyze resume for target role"}
                >
                  <Wand2 className="h-4 w-4" />
                  {loadingAnalysis ? 'Analyzing...' : 'Analyze'}
                </button>
                {/* Download */}
                <button
                  onClick={downloadResume}
                  disabled={saving || deleting || fileLoading || loadingAnalysis || !editorContent}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-2 rounded-md flex items-center justify-center gap-2 text-sm disabled:opacity-50 transition-colors h-full"
                  title={!editorContent ? "Enter content to download" : "Download as .pdf file"} // Updated title
                >
                  <Download className="h-4 w-4" />
                  <span>Download PDF</span>
                </button>
                 {/* Delete */}
                <button
                  onClick={deleteResume}
                  disabled={deleting || saving || fileLoading || loadingAnalysis || !selectedResumeId}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md flex items-center justify-center gap-2 text-sm disabled:opacity-50 transition-colors h-full"
                  title={!selectedResumeId ? "Select a resume version to delete" : "Delete selected resume version"}
                >
                  {deleting ? (<RefreshCw className="h-4 w-4 animate-spin" />) : (<Trash2 className="h-4 w-4" />)}
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
                 {/* Save */}
                <button
                  onClick={saveResume}
                  disabled={saving || deleting || fileLoading || loadingAnalysis || !editorContent}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-2 rounded-md flex items-center justify-center gap-2 text-sm disabled:opacity-50 transition-colors h-full"
                  title={!editorContent ? "Enter content to save" : "Save current content"}
                >
                  {saving ? ( <RefreshCw className="h-4 w-4 animate-spin" /> ) : ( <Save className="h-4 w-4" /> )}
                  {saving ? 'Saving...' : 'Save'}
                </button>
            </div>
          </div>

          {/* Message Display Area */}
          {message && (
            <div className={cn("p-3 rounded-lg text-sm",
                message.type === 'success' && 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200 border border-green-200 dark:border-green-700/50',
                message.type === 'error' && 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200 border border-red-200 dark:border-red-700/50')}>
              {message.text}
            </div>
          )}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
            {/* Editor Card */}
            <div className="bg-card/80 backdrop-blur-sm shadow-lg border-border/50 rounded-lg text-card-foreground overflow-hidden">
              <div className="p-3 border-b border-border/50">
                <h2 className="text-base font-semibold">Resume Content (Edit Text / Markdown)</h2>
              </div>
              <div className="min-h-[400px] h-[50vh] max-h-[600px] text-sm">
                <Editor
                  defaultLanguage="markdown"
                  value={editorContent}
                  onChange={handleEditorChange}
                  onMount={handleEditorDidMount}
                  theme={editorTheme}
                  options={{
                    minimap: { enabled: false },
                    lineNumbers: 'on',
                    wordWrap: 'on',
                    wrappingIndent: 'same',
                    fontSize: 13,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    padding: { top: 10, bottom: 10 },
                    readOnly: fileLoading || deleting || saving || loadingAnalysis // Make editor read-only during operations
                  }}
                />
              </div>
            </div>

            {/* Analysis Card */}
            <div className="bg-card/80 backdrop-blur-sm shadow-lg border-border/50 rounded-lg text-card-foreground overflow-hidden min-h-[400px] h-[50vh] max-h-[600px] flex flex-col">
              <div className="p-3 border-b border-border/50 flex justify-between items-center flex-shrink-0">
                <h2 className="text-base font-semibold">AI Analysis {targetRole ? `for "${targetRole}"` : ''}</h2>
                {analysisResult?.correctedResumeMarkdown && !loadingAnalysis && (
                    <button
                        onClick={applyCorrectedResume}
                        disabled={fileLoading || deleting || saving || loadingAnalysis}
                        className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-md flex items-center gap-2 text-xs disabled:opacity-50"
                        title="Replace editor content with AI's full corrected version"
                    >
                        <CheckSquare className="h-3.5 w-3.5" />
                        Apply Correction
                    </button>
                )}
              </div>
              <div className="p-4 sm:p-6 flex-grow overflow-y-auto prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-headings:my-2">
                {loadingAnalysis ? (
                  <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    Analyzing...
                  </div>
                ) : analysisResult?.suggestionsMarkdown ? (
                  <>
                    <ReactMarkdown>{analysisResult.suggestionsMarkdown}</ReactMarkdown>
                    {analysisResult.correctedResumeMarkdown && (
                        <div className="mt-6 pt-4 border-t border-border/30">
                            <h4 className="font-semibold text-sm mb-2">AI Suggested Rewrite Preview:</h4>
                            <div className="p-2 border rounded-md bg-background/50 max-h-48 overflow-y-auto text-xs">
                                <ReactMarkdown>{analysisResult.correctedResumeMarkdown}</ReactMarkdown>
                            </div>
                        </div>
                    )}
                  </>
                ) : (
                  <div className="text-muted-foreground text-center pt-10">
                    Enter resume content and a target role, then click "Analyze" above.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Shareable Link Card */}
          {selectedResumeId && getShareableLink(selectedResumeId) && (
            <div className="bg-card/80 backdrop-blur-sm shadow-lg border-border/50 rounded-lg text-card-foreground p-4 mt-6">
              <p className="text-sm font-medium text-muted-foreground mb-1">Shareable Link (Read-Only View):</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={getShareableLink(selectedResumeId) || ''}
                  className="flex-grow p-1.5 rounded border border-input bg-background text-xs truncate"
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
        </div>
      </div>
    </main>
  );
};

export default Resume;