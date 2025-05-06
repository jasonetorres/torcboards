import { useState, useEffect } from 'react';
import { Wand2, Building2, Users, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { analyzeJobDescription, getInterviewPrep } from '../lib/openai';
import { supabase } from '../lib/supabase';
import { useSelector } from 'react-redux';
import { format } from 'date-fns';
import { RootState } from '../store'; // Import RootState
import { Card, CardBody, CardHeader } from '@heroui/react'; // Use Card components

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
  // Use RootState for proper typing
  const user = useSelector((state: RootState) => state.auth.user);

  const [jobDescription, setJobDescription] = useState('');
  const [position, setPosition] = useState('');
  const [company, setCompany] = useState('');

  useEffect(() => {
    if (user) {
      fetchAnalyses();
    } else {
      setAnalyses([]); // Clear history if user logs out
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeTab]); // Dependencies are correct

  const fetchAnalyses = async () => {
    if (!user) return; // Guard clause
    const { data, error } = await supabase
      .from('ai_analyses')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', activeTab)
      .order('created_at', { ascending: false })
      .limit(20); // Limit history items

    if (error) {
        console.error("Error fetching AI analyses:", error);
    } else if (data) {
        setAnalyses(data);
    }
  };

  const saveAnalysis = async (type: string, input: string, result: string) => {
    if (!user) return;
    const { error } = await supabase.from('ai_analyses').insert({ user_id: user.id, type, input, result });
    if (error) {
        console.error("Error saving AI analysis:", error);
    } else {
        fetchAnalyses(); // Refresh history after saving
    }
  };

  const handleAnalyzeJob = async () => {
    if (!jobDescription || !user) return;
    setLoading(true);
    setResult(''); // Clear previous result
    try {
      const analysis = await analyzeJobDescription(jobDescription);
      setResult(analysis || 'No analysis returned.');
      if (analysis) await saveAnalysis('job', jobDescription, analysis);
    } catch (error: any) {
      console.error('Error analyzing job description:', error);
      setResult(`Error analyzing job description: ${error.message || 'Please try again.'}`);
    }
    setLoading(false);
  };

  const handleInterviewPrep = async () => {
    if (!position || !company || !user) return;
    setLoading(true);
    setResult(''); // Clear previous result
    try {
      const prep = await getInterviewPrep(position, company);
      setResult(prep || 'No preparation tips returned.');
      if (prep) await saveAnalysis('interview', `${position} at ${company}`, prep);
    } catch (error: any) {
      console.error('Error getting interview prep:', error);
      setResult(`Error preparing interview guidance: ${error.message || 'Please try again.'}`);
    }
    setLoading(false);
  };

  const loadAnalysis = (analysis: Analysis) => {
    setResult(analysis.result);
    if (analysis.type === 'job') {
        setJobDescription(analysis.input);
        setActiveTab('job');
    } else if (analysis.type === 'interview') {
        const inputParts = analysis.input.split(' at ');
        // Provide defaults if splitting fails unexpectedly
        setPosition(inputParts[0] || '');
        setCompany(inputParts[1] || '');
        setActiveTab('interview');
    }
     setShowHistory(false); // Close history when an item is loaded
     window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top
  };

  return (
    // Consistent main layout structure
    <main className="min-h-screen w-full relative flex justify-center px-4 pt-16 pb-16 overflow-y-auto">
      {/* Background Image and Overlay */}
      <div className="fixed inset-0 z-0">
        <img
          src="https://img.heroui.chat/image/landscape?w=1920&h=1080&u=1"
          className="w-full h-full object-cover"
          alt="Dashboard Background"
        />
        {/* Corrected Overlay */}
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* Content Area */}
      <div className="w-full max-w-4xl z-10"> {/* Adjusted max-width for better focus */}
        <div className="space-y-6">
          {/* Header - Consistent style */}
          <h1 className="text-3xl font-bold text-white mix-blend-screen">AI Career Tools</h1>

          {/* Input Section Card */}
          <Card className="bg-card/80 backdrop-blur-sm shadow-lg border-border/50">
             <CardBody className="p-6">
                 <div className="flex flex-wrap gap-4 mb-6">
                   <button
                     onClick={() => { setActiveTab('job'); setResult(''); }} // Clear result on tab switch
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
                     onClick={() => { setActiveTab('interview'); setResult(''); }} // Clear result on tab switch
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
                         <label htmlFor="jobDesc" className="block text-sm font-medium mb-2 text-card-foreground/80">
                           Paste job description
                         </label>
                         <textarea
                           id="jobDesc"
                           value={jobDescription}
                           onChange={(e) => setJobDescription(e.target.value)}
                           className="w-full h-48 p-3 rounded-lg border border-input bg-background font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/20"
                           placeholder="Paste the full job description here..."
                         />
                       </div>
                       <button
                         onClick={handleAnalyzeJob}
                         disabled={loading || !jobDescription}
                         className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md disabled:opacity-50 transition-all text-sm sm:text-base w-full sm:w-auto justify-center"
                       >
                         {loading ? (
                             <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                         ) : (
                            <Wand2 className="h-5 w-5" />
                         )}
                         {loading ? 'Analyzing...' : 'Analyze Job'}
                       </button>
                     </>
                   )}

                   {activeTab === 'interview' && (
                     <>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                           <label htmlFor="position" className="block text-sm font-medium mb-2 text-card-foreground/80">
                             Position *
                           </label>
                           <input
                             id="position"
                             type="text"
                             value={position}
                             onChange={(e) => setPosition(e.target.value)}
                             className="w-full p-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm sm:text-base"
                             placeholder="e.g., Senior Software Engineer"
                             required
                           />
                         </div>
                         <div>
                           <label htmlFor="company" className="block text-sm font-medium mb-2 text-card-foreground/80">
                             Company *
                           </label>
                           <input
                             id="company"
                             type="text"
                             value={company}
                             onChange={(e) => setCompany(e.target.value)}
                             className="w-full p-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm sm:text-base"
                             placeholder="e.g., Acme Corp"
                             required
                           />
                         </div>
                       </div>
                       <button
                         onClick={handleInterviewPrep}
                         disabled={loading || !position || !company}
                         className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md disabled:opacity-50 transition-all text-sm sm:text-base w-full sm:w-auto justify-center"
                       >
                          {loading ? (
                             <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                         ) : (
                            <Wand2 className="h-5 w-5" />
                         )}
                         {loading ? 'Preparing...' : 'Get Interview Prep'}
                       </button>
                     </>
                   )}
                 </div>
             </CardBody>
          </Card>

          {/* History Section Card */}
          {analyses.length > 0 && (
            <Card className="bg-card/80 backdrop-blur-sm shadow-lg border-border/50">
              <CardHeader className="p-4 cursor-pointer" onClick={() => setShowHistory(!showHistory)}>
                 <div className="flex items-center justify-between w-full">
                   <div className="flex items-center gap-2">
                     <Clock className="h-5 w-5" />
                     <h2 className="text-lg font-semibold">Previous Analyses ({activeTab})</h2>
                   </div>
                   {showHistory ? ( <ChevronUp className="h-5 w-5" /> ) : ( <ChevronDown className="h-5 w-5" /> )}
                 </div>
              </CardHeader>
              {showHistory && (
                <CardBody className="p-4 pt-0"> {/* Remove top padding when open */}
                  <div className="mt-4 space-y-3 max-h-60 overflow-y-auto pr-2"> {/* Limit height and add scroll */}
                    {analyses.map((analysis) => (
                      <button
                        key={analysis.id}
                        onClick={() => loadAnalysis(analysis)}
                        className="w-full p-3 bg-muted rounded-lg text-left hover:bg-muted/80 transition-colors text-sm sm:text-base block"
                        title={`Load analysis from ${format(new Date(analysis.created_at), 'P p')}`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <p className="font-medium line-clamp-1 flex-grow break-words pr-2"> {/* Allow wrapping */}
                            {analysis.type === 'job' ? 'Job: ' : 'Interview: '}
                            {analysis.input ? analysis.input.split('\n')[0].slice(0, 80) : 'Untitled'} {/* Show first line/part */}
                            {analysis.input && analysis.input.length > 80 ? '...' : ''}
                          </p>
                          <span className="text-xs text-muted-foreground shrink-0 ml-auto">
                            {format(new Date(analysis.created_at), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardBody>
              )}
            </Card>
          )}

          {/* Result Section Card */}
          {result && (
            <Card className="bg-card/80 backdrop-blur-sm shadow-lg border-border/50 overflow-hidden">
              <CardHeader className="p-4 border-b border-border/50">
                <h2 className="text-xl font-semibold">Analysis Results</h2>
              </CardHeader>
              <CardBody className="p-6">
                 <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:my-3 prose-p:my-2 prose-ul:my-2 prose-li:my-1 prose-li:before:content-['•'] prose-li:before:text-primary prose-li:before:mr-2 prose-a:text-primary hover:prose-a:underline prose-pre:bg-muted prose-pre:p-3 prose-pre:rounded-md prose-code:font-mono prose-code:text-sm overflow-x-auto">
                   <ReactMarkdown>
                     {result}
                   </ReactMarkdown>
                 </div>
              </CardBody>
            </Card>
          )}

        </div>
      </div>
    </main>
  );
};

export default AITools;