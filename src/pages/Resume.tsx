import React, { useState, useEffect } from 'react';
import { FileText, Save, RefreshCw, Wand2, Upload, Link as LucideLink } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { supabase } from '../lib/supabase';
import { useSelector } from 'react-redux';
import { analyzeResume } from '../lib/openai';
import ReactMarkdown from 'react-markdown';
import { Card, CardBody } from "@heroui/react";
import { v4 as uuidv4 } from 'uuid';

const Resume = () => {
  const [resumes, setResumes] = useState<
    { id: string; content: string; target_role: string; }[]
  >([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const user = useSelector((state: any) => state.auth.user);

  useEffect(() => {
    if (user) {
      fetchResumes();
    }
  }, [user]);

  const fetchResumes = async () => {
    const { data } = await supabase
      .from('resumes')
      .select('id, content, target_role')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (data) {
      setResumes(data);
      if (data.length > 0) {
        setSelectedResumeId(data[0].id);
      }
    }
  };

  const saveResume = async () => {
    if (!user) return;

    setSaving(true);
    setMessage(null);

    try {
      let resumeId = selectedResumeId || uuidv4();
      const { error } = await supabase
        .from('resumes')
        .upsert({
          id: resumeId,
          user_id: user.id,
          content: getCurrentResumeContent(),
          target_role: targetRole,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Resume saved successfully!',
      });
      fetchResumes();
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error saving resume. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const analyzeForRole = async () => {
    if (!getCurrentResumeContent() || !targetRole) return;

    setLoading(true);
    setMessage(null);

    try {
      const result = await analyzeResume(getCurrentResumeContent());
      setAnalysis(result || '');

      if (user && result) {
        await supabase.from('ai_analyses').insert({
          user_id: user.id,
          type: 'resume',
          input: getCurrentResumeContent(),
          result,
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error analyzing resume. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const getCurrentResumeContent = () => {
    const selectedResume = resumes.find(
      (resume) => resume.id === selectedResumeId
    );
    return selectedResume ? selectedResume.content : '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      readFileContent(selectedFile);
    }
  };

  const readFileContent = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const newResumeId = selectedResumeId || uuidv4();
        setResumes(prevResumes => {
          const existingIndex = prevResumes.findIndex(r => r.id === newResumeId);
          if (existingIndex > -1) {
            const updatedResumes = [...prevResumes];
            updatedResumes[existingIndex] = { ...prevResumes[existingIndex], content: text };
            return updatedResumes;
          } else {
            return [...prevResumes, { id: newResumeId, content: text, target_role: targetRole }];
          }
        });
        setSelectedResumeId(newResumeId);
      }
    };
    reader.readAsText(file);
  };

  const getShareableLink = (resumeId: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/resume-view/${resumeId}`;
  };

  return (
    <main className="min-h-screen w-full relative flex items-center justify-center p-4 overflow-x-auto">
      <div className="fixed inset-0 z-0">
        <img
          src="https://img.heroui.chat/image/landscape?w=1920&h=1080&u=1"
          className="w-full h-full object-cover"
          alt="Dashboard Background"
        />
        <div className="absolute inset-0 bg-background/" />
      </div>

      <div className="w-full max-w-7xl z-10">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 text-foreground mb-6">
            <h1 className="text-3xl font-bold flex items-center gap-2 w-full sm:w-auto mb-2 sm:mb-0">
              <FileText className="h-8 w-8" />
              Resume Editor
            </h1>
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto sm:flex-nowrap">
              <div className="w-full sm:w-48">
                <label htmlFor="resumeSelect" className="block text-sm font-medium mb-1">
                  Select Resume
                </label>
                <select
                  id="resumeSelect"
                  value={selectedResumeId || ''}
                  onChange={(e) => setSelectedResumeId(e.target.value)}
                  className="w-full p-3 rounded border border-input bg-background text-sm"
                >
                  {resumes.map((resume) => (
                    <option key={resume.id} value={resume.id}>
                      {resume.target_role || `Resume ${resume.id.substring(0, 8)}`}
                    </option>
                  ))}
                  <option value="">New Resume</option>
                </select>
              </div>

              <div className="w-full sm:w-64">
                <label htmlFor="targetRole" className="block text-sm font-medium mb-1">
                  Target Role
                </label>
                <input
                  id="targetRole"
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g., Senior Software Engineer"
                  className="w-full p-3 rounded border border-input bg-background text-sm"
                />
              </div>

              <button
                onClick={analyzeForRole}
                disabled={loading || !getCurrentResumeContent() || !targetRole}
                className="w-full sm:w-auto flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-md disabled:opacity-50 justify-center text-sm"
              >
                <Wand2 className="h-5 w-5" />
                {loading ? 'Analyzing...' : 'Analyze'}
              </button>

              <button
                onClick={saveResume}
                disabled={saving}
                className="w-full sm:w-auto flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-md disabled:opacity-50 justify-center text-sm"
              >
                {saving ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <Save className="h-5 w-5" />
                )}
                {saving ? 'Saving...' : 'Save'}
              </button>

              <input
                type="file"
                id="resumeUpload"
                accept=".doc,.docx,.pdf,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="resumeUpload"
                className="w-full sm:w-auto flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-md cursor-pointer justify-center text-sm"
              >
                <Upload className="h-5 w-5" />
                Upload
              </label>
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

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="bg-card text-card-foreground rounded-lg shadow-md">
              <div className="p-4 border-b border-border">
                <h2 className="text-lg font-semibold">Resume Content</h2>
              </div>
              <Editor
                height="400px"
                defaultLanguage="markdown"
                value={getCurrentResumeContent()}
                onChange={(value) => {
                  setResumes(prevResumes => {
                    if (selectedResumeId) {
                      const updatedResumes = [...prevResumes];
                      const index = updatedResumes.findIndex(r => r.id === selectedResumeId);
                      if (index > -1) {
                        updatedResumes[index] = { ...updatedResumes[index], content: value || '' };
                        return updatedResumes;
                      }
                    }
                    return prevResumes;
                  });
                }}
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
              <div className="p-6 prose prose-sm max-w-none h-[calc(400px - 52px)] overflow-y-auto relative">
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
            {selectedResumeId && (
              <Card shadow="lg" className="mt-6">
                <CardBody className="p-4">
                  <p className="text-sm text-muted-foreground">
                    Shareable Link:
                  </p>
                  <div className="flex items-center gap-2">
                    <a
                      href={getShareableLink(selectedResumeId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate"
                    >
                      {getShareableLink(selectedResumeId)}
                    </a>
                    <LucideLink className="h-4 w-4 text-primary" />
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default Resume;