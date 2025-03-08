import { useState, useEffect } from 'react';
import { FileText, Save, RefreshCw, Wand2} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { analyzeResume } from '../lib/openai';
import ReactMarkdown from 'react-markdown';

const Resume = () => {
  const [resumeContent, setResumeContent] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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
      setResumeContent(resume.content);
      setTargetRole(resume.target_role || '');
    }
  };

  const saveResume = async () => {
    if (!user) return;
    
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('resumes')
        .upsert({
          user_id: user.id,
          content: resumeContent,
          target_role: targetRole,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Resume saved successfully!'
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error saving resume. Please try again.'
      });
    } finally {
      setSaving(false);
    }
  };

  const analyzeForRole = async () => {
    if (!resumeContent || !targetRole) return;
    
    setLoading(true);
    setMessage(null);

    try {
      const result = await analyzeResume(resumeContent);
      setAnalysis(result || '');

      // Save analysis
      if (user && result) {
        await supabase
          .from('ai_analyses')
          .insert({
            user_id: user.id,
            type: 'resume',
            input: resumeContent,
            result
          });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error analyzing resume. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };
  

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8" />
          Resume Editor
        </h1>
        <div className="flex items-center gap-4">
          <div>
            <label htmlFor="targetRole" className="block text-sm font-medium mb-1">
              Target Role
            </label>
            <input
              id="targetRole"
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g., Senior Software Engineer"
              className="w-64 p-2 rounded border border-input bg-background"
            />
          </div>
          <button
            onClick={analyzeForRole}
            disabled={loading || !targetRole || !resumeContent}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md disabled:opacity-50"
          >
            <Wand2 className="h-5 w-5" />
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
          <button
            onClick={saveResume}
            disabled={saving}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card text-card-foreground rounded-lg shadow-md">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Resume Content</h2>
          </div>
          <Editor
            height="600px"
            defaultLanguage="markdown"
            value={resumeContent}
            onChange={(value) => setResumeContent(value || '')}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              lineNumbers: 'off',
              wordWrap: 'on',
              wrappingIndent: 'indent',
              fontSize: 14,
            }}
          />
        </div>

        <div className="bg-card text-card-foreground rounded-lg shadow-md">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold">AI Analysis</h2>
          </div>
          <div className="p-6 prose prose-sm max-w-none h-[600px] overflow-y-auto">
            {analysis ? (
              <ReactMarkdown>{analysis}</ReactMarkdown>
            ) : (
              <div className="text-muted-foreground">
                {loading ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    Analyzing your resume...
                  </div>
                ) : (
                  <p>
                    Enter your target role and click "Analyze" to get AI-powered suggestions
                    for improving your resume.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Resume;
