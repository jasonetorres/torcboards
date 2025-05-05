import { useState, useEffect } from 'react';
import { Wand2, Building2, Users, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { analyzeJobDescription, getInterviewPrep } from '../lib/openai';
import { supabase } from '../lib/supabase';
import { useSelector } from 'react-redux';
import { format } from 'date-fns';

interface Analysis {
  id: string;
  type: string;
  input: string;
  result: string;
  created_at: string;
}

const AITools = () => {
  const [activeTab, setActiveTab] = useState<'job' | 'interview'>('job');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const user = useSelector((state: any) => state.auth.user);

  const [jobDescription, setJobDescription] = useState('');
  const [position, setPosition] = useState('');
  const [company, setCompany] = useState('');

  useEffect(() => {
    if (user) {
      fetchAnalyses();
    }
  }, [user, activeTab]);

  const fetchAnalyses = async () => {
    const { data } = await supabase
      .from('ai_analyses')
      .select('*')
      .eq('user_id', user!.id)
      .eq('type', activeTab)
      .order('created_at', { ascending: false });
    if (data) setAnalyses(data);
  };

  const saveAnalysis = async (type: string, input: string, result: string) => {
    if (!user) return;
    await supabase.from('ai_analyses').insert({ user_id: user.id, type, input, result });
    fetchAnalyses();
  };

  const handleAnalyzeJob = async () => {
    setLoading(true);
    try {
      const analysis = await analyzeJobDescription(jobDescription);
      setResult(analysis || '');
      if (analysis) await saveAnalysis('job', jobDescription, analysis);
    } catch (error) {
      console.error('Error analyzing job description:', error);
      setResult('Error analyzing job description. Please try again.');
    }
    setLoading(false);
  };

  const handleInterviewPrep = async () => {
    setLoading(true);
    try {
      const prep = await getInterviewPrep(position, company);
      setResult(prep || '');
      if (prep) await saveAnalysis('interview', `${position} at ${company}`, prep);
    } catch (error) {
      console.error('Error getting interview prep:', error);
      setResult('Error preparing interview guidance. Please try again.');
    }
    setLoading(false);
  };

  const loadAnalysis = (analysis: Analysis) => {
    setResult(analysis.result);
    if (analysis.type === 'job') setJobDescription(analysis.input);
    else if (analysis.type === 'interview') {
      const [pos, comp] = analysis.input.split(' at ');
      setPosition(pos);
      setCompany(comp);
    }
  };

  return (
    <main className="min-h-screen w-full relative flex items-center justify-center p-4">
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
          <h1 className="text-3xl font-bold mb-6 text-foreground">AI Career Tools</h1>

          <div className="bg-card text-card-foreground p-6 rounded-lg shadow-md mb-6">
            <div className="flex flex-wrap gap-4 mb-6">
              <button
                onClick={() => setActiveTab('job')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors text-sm sm:text-base w-full sm:w-auto justify-center ${
                  activeTab === 'job'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
              >
                <Building2 className="h-5 w-5" />
                Job Analysis
              </button>
              <button
                onClick={() => setActiveTab('interview')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors text-sm sm:text-base w-full sm:w-auto justify-center ${
                  activeTab === 'interview'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
              >
                <Users className="h-5 w-5" />
                Interview Prep
              </button>
            </div>

            <div className="space-y-4">
              {activeTab === 'job' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Paste job description
                    </label>
                    <textarea
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      className="w-full h-48 p-3 rounded-lg border border-input bg-background font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Paste the job description here..."
                    />
                  </div>
                  <button
                    onClick={handleAnalyzeJob}
                    disabled={loading || !jobDescription}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md disabled:opacity-50 transition-opacity text-sm sm:text-base w-full sm:w-auto justify-center"
                  >
                    <Wand2 className="h-5 w-5" />
                    {loading ? 'Analyzing...' : 'Analyze Job'}
                  </button>
                </>
              )}

              {activeTab === 'interview' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Position
                      </label>
                      <input
                        type="text"
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        className="w-full p-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm sm:text-base"
                        placeholder="e.g., Senior Software Engineer"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Company
                      </label>
                      <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        className="w-full p-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm sm:text-base"
                        placeholder="e.g., Google"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleInterviewPrep}
                    disabled={loading || !position || !company}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md disabled:opacity-50 transition-opacity text-sm sm:text-base w-full sm:w-auto justify-center"
                  >
                    <Wand2 className="h-5 w-5" />
                    {loading ? 'Preparing...' : 'Get Interview Prep'}
                  </button>
                </>
              )}
            </div>
          </div>

          {analyses.length > 0 && (
            <div className="bg-card text-card-foreground p-6 rounded-lg shadow-md mb-6">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  <h2 className="text-xl font-semibold">Previous Analyses</h2>
                </div>
                {showHistory ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </button>

              {showHistory && (
                <div className="mt-4 space-y-3">
                  {analyses.map((analysis) => (
                    <button
                      key={analysis.id}
                      onClick={() => loadAnalysis(analysis)}
                      className="w-full p-4 bg-muted rounded-lg text-left hover:bg-muted/80 transition-colors text-sm sm:text-base"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <p className="font-medium line-clamp-2">
                          {analysis.input ? analysis.input.slice(0, 100) : ''}
                          {analysis.input && analysis.input.length > 100 ? '...' : ''}
                        </p>
                        <span className="text-sm text-muted-foreground shrink-0">
                          {format(new Date(analysis.created_at), 'MMM d,yyyy')}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="bg-card text-card-foreground rounded-lg shadow-md overflow-hidden">
              <div className="p-4 border-b border-border">
                <h2 className="text-xl font-semibold">Analysis Results</h2>
              </div>
              <div className="divide-y divide-border">
                <div className="p-6 prose prose-sm max-w-none dark:prose-invert overflow-y-auto max-h-[600px]">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => <h1 className="text-2xl font-bold mb-4">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-xl font-semibold mt-6 mb-3">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-lg font-medium mt-4 mb-2">{children}</h3>,
                      ul: ({ children }) => <ul className="my-4 space-y-2">{children}</ul>,
                      li: ({ children }) => <li className="flex gap-2 before:content-['•'] before:text-primary">{children}</li>,
                      p: ({ children }) => <p className="my-3 leading-relaxed">{children}</p>,
                      code: ({ node, className, children, ...props }) => (
                        <pre className="rounded-lg bg-muted p-4 font-mono text-sm overflow-x-auto">
                          <code>{String(children).replace(/\n$/, '')}</code>
                        </pre>
                      ),
                    }}
                  >
                    {result}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default AITools;