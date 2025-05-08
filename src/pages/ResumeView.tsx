import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';
import { v4 as uuidv4 } from 'uuid';

// --- Interfaces ---
interface ResumeExperience {
  id: string;
  job_title: string;
  company_name: string;
  start_date: string;
  end_date?: string | null;
  description: string;
  is_current: boolean;
}

interface ResumeEducation {
  id: string;
  institution_name: string;
  degree: string;
  field_of_study: string;
  start_date: string;
  end_date?: string | null;
  description?: string | null;
}

interface ResumeSkill {
  id: string;
  name: string;
  level?: string;
}

interface YourResumeType {
  id: string;
  title?: string;
  full_name?: string;
  email?: string;
  phone_number?: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  summary?: string;
  experiences?: ResumeExperience[];
  education?: ResumeEducation[];
  skills?: ResumeSkill[];
  created_at?: string;
  user_id?: string;
}

interface FetchedSupabaseResume {
    id: string;
    user_id?: string;
    content: string;
    target_role?: string;
    created_at?: string;
    updated_at?: string;
}

// --- PARSING FUNCTION ---
function parseMarkdownToStructuredResume(
    markdownContent: string,
    baseId: string,
    userId?: string,
    createdAt?: string,
    targetRole?: string
): YourResumeType {
    const allLines = markdownContent.split('\n').map(line => line.trim());
    const resume: YourResumeType = {
        id: baseId,
        user_id: userId,
        created_at: createdAt,
        title: targetRole || "Resume",
        experiences: [],
        education: [],
        skills: [],
        summary: "",
        full_name: "",
        email: "",
        phone_number: "",
        linkedin_url: "",
        github_url: "",
        portfolio_url: "",
    };

    let currentSection: string | null = null;
    let sectionContentAccumulator: string[] = [];

    // Helper to create a default blank education item
    const createDefaultEduItem = (): ResumeEducation => ({
        id: uuidv4(),
        institution_name: "",
        degree: "",
        field_of_study: "",
        start_date: "",
        end_date: null,
        description: "",
    });

    // Helper to create a default blank experience item
    const createDefaultExpItem = (): ResumeExperience => ({
        id: uuidv4(),
        job_title: "",
        company_name: "",
        start_date: "",
        end_date: null,
        description: "",
        is_current: false,
    });

    const processSectionContent = () => {
        if (!currentSection || sectionContentAccumulator.length === 0) {
            sectionContentAccumulator = [];
            return;
        }
        const contentStr = sectionContentAccumulator.join('\n').trim();

        if (currentSection === "PERSONAL SUMMARY") {
            resume.summary = contentStr;
        } else if (currentSection === "TECHNICAL SKILLS") {
            const skillsList: ResumeSkill[] = [];
            sectionContentAccumulator.forEach(line => {
                let skillLine = line;
                if (skillLine.startsWith('- ') || skillLine.startsWith('* ')) {
                    skillLine = skillLine.substring(2).trim();
                }
                if (skillLine) {
                    const levelMatch = skillLine.match(/\(([^)]+)\)$/);
                    let skillName = skillLine;
                    let skillLevel;
                    if (levelMatch && levelMatch.index && levelMatch.index > 0) {
                        skillName = skillLine.substring(0, levelMatch.index).trim();
                        skillLevel = levelMatch[1];
                    }
                    skillsList.push({ id: uuidv4(), name: skillName, level: skillLevel });
                }
            });
            resume.skills = skillsList;
        } else if (currentSection === "EDUCATION") {
            const eduItems: ResumeEducation[] = [];
            let currentEduItemInProgress: ResumeEducation | null = null;

            sectionContentAccumulator.forEach(line => {
                if (line.startsWith('- **') && line.includes('**')) {
                    if (currentEduItemInProgress?.institution_name) { // Check if previous item was valid
                        if (currentEduItemInProgress.description) currentEduItemInProgress.description = currentEduItemInProgress.description.trim();
                        eduItems.push(currentEduItemInProgress);
                    }
                    currentEduItemInProgress = createDefaultEduItem(); // Initialize with defaults
                    const boldEndIndex = line.indexOf('**', 4);
                    currentEduItemInProgress.institution_name = line.substring(4, boldEndIndex).trim();
                    const restOfLine = line.substring(boldEndIndex + 2).trim();
                    const dateMatch = restOfLine.match(/\|\s*([A-Za-z]+\s\d{4})\s*–\s*([A-Za-z]+\s\d{4}|Present)/i);
                    if (dateMatch) {
                        currentEduItemInProgress.start_date = dateMatch[1].trim();
                        currentEduItemInProgress.end_date = dateMatch[2].trim().toLowerCase() === 'present' ? null : dateMatch[2].trim();
                    }
                } else if (currentEduItemInProgress && currentEduItemInProgress.institution_name) { // Continuing current item
                    if (!currentEduItemInProgress.degree && !line.startsWith('- ') && !line.match(/college|academy|school|university|institute/i) && line.includes(" in ")) {
                        const [degree, field_of_study] = line.split(' in ').map(s => s.trim());
                        currentEduItemInProgress.degree = degree;
                        currentEduItemInProgress.field_of_study = field_of_study;
                    } else if (!currentEduItemInProgress.degree && !line.startsWith('- ') && !line.match(/college|academy|school|university|institute/i) && line.length > 2 && line.length < 50 && !line.includes(" in ")) {
                         currentEduItemInProgress.degree = line;
                         // currentEduItemInProgress.field_of_study remains "" (default)
                    } else if (line.trim().length > 0) {
                        currentEduItemInProgress.description = (currentEduItemInProgress.description || "") + line.trim() + "\n";
                    }
                }
            });
            if (currentEduItemInProgress?.institution_name) { // Push the last item if valid
                if (currentEduItemInProgress.description) currentEduItemInProgress.description = currentEduItemInProgress.description.trim();
                eduItems.push(currentEduItemInProgress);
            }
            resume.education = eduItems;

        } else if (currentSection === "TECHNICAL PROJECTS" || currentSection === "EXPERIENCE") {
            const expItems: ResumeExperience[] = [];
            let currentExpItemInProgress: ResumeExperience | null = null;

            sectionContentAccumulator.forEach(line => {
                if (line.startsWith('- **') && line.includes('**')) {
                    if (currentExpItemInProgress?.job_title) { // Check if previous item was valid
                        if (currentExpItemInProgress.description) currentExpItemInProgress.description = currentExpItemInProgress.description.trim();
                        expItems.push(currentExpItemInProgress);
                    }
                    currentExpItemInProgress = createDefaultExpItem(); // Initialize with defaults
                    const boldEndIndex = line.indexOf('**', 4);
                    currentExpItemInProgress.job_title = line.substring(4, boldEndIndex).trim();
                    
                    const restOfLine = line.substring(boldEndIndex + 2).trim();
                    const parts = restOfLine.split('|').map(p => p.trim());
                    if(parts.length > 0 && parts[0].length > 0) currentExpItemInProgress.company_name = parts[0];

                    const dateMatch = restOfLine.match(/([A-Za-z]+\s\d{4})\s*–\s*([A-Za-z]+\s\d{4}|Present|August \d{4} – Present)/i);
                    if (dateMatch) {
                        currentExpItemInProgress.start_date = dateMatch[1].trim();
                        const endDateStr = dateMatch[2]?.trim().toLowerCase();
                        if (endDateStr === 'present' || endDateStr?.includes('– present')) {
                            currentExpItemInProgress.is_current = true;
                            currentExpItemInProgress.end_date = null;
                        } else {
                            // is_current remains false (default)
                            currentExpItemInProgress.end_date = dateMatch[2].trim();
                        }
                    }
                } else if (currentExpItemInProgress && currentExpItemInProgress.job_title) { // Continuing current item
                    if (line.toLowerCase().startsWith('tech stack:')) {
                        currentExpItemInProgress.description = (currentExpItemInProgress.description || "") + line + "\n";
                    } else if (line.startsWith('- ') || line.startsWith('* ') || (line.trim() && !line.match(/\|/))) {
                        currentExpItemInProgress.description = (currentExpItemInProgress.description || "") + line.replace(/^(-|\*)\s*/, '').trim() + "\n";
                    } else if (!currentExpItemInProgress.company_name && line.includes('|') && line.length < 100) { // Company may be on a new line for some reason
                        currentExpItemInProgress.company_name = line.split('|')[0].trim();
                    }
                }
            });
            if (currentExpItemInProgress?.job_title) { // Push the last item if valid
                if (currentExpItemInProgress.description) currentExpItemInProgress.description = currentExpItemInProgress.description.trim();
                expItems.push(currentExpItemInProgress);
            }
            resume.experiences = expItems;
        }
        sectionContentAccumulator = [];
    };

    let firstSectionHeaderIndex = allLines.findIndex(line => line.startsWith("### "));
    if (firstSectionHeaderIndex === -1 && allLines.some(line => line.trim() !== "")) {
         firstSectionHeaderIndex = 0;
         currentSection = "PERSONAL SUMMARY"; // Default if no "###" headers but content exists
    } else if (firstSectionHeaderIndex === -1) {
         firstSectionHeaderIndex = allLines.length; // No content, no sections
    }

    const headerTextLines = allLines.slice(0, firstSectionHeaderIndex);
    if (headerTextLines.length > 0) {
        let nameLineFound = false;
        for (const line of headerTextLines) {
            if (/^[A-Z\s]+$/.test(line) && line.trim().split(' ').length >= 2 && line.length < 35 && !line.includes(" | ")) {
                resume.full_name = line.trim();
                nameLineFound = true;
                break;
            }
        }
        if (!nameLineFound && headerTextLines.length > 0 && headerTextLines[0].trim() !== "---") resume.full_name = headerTextLines[0].trim();


        if (resume.full_name) {
            const nameIndex = headerTextLines.findIndex(l => l.trim() === resume.full_name);
            if (nameIndex !== -1 && nameIndex + 1 < headerTextLines.length) {
                const potentialTitleLine = headerTextLines[nameIndex + 1];
                if (potentialTitleLine && !potentialTitleLine.includes('@') && !potentialTitleLine.match(/\(\d{3}\)/) && !potentialTitleLine.match(/linkedin|github/i) && potentialTitleLine.length < 70  && !potentialTitleLine.match(/^\(?[0-9]/)) {
                    resume.title = potentialTitleLine.trim();
                }
            }
        }
        if (!resume.title) resume.title = targetRole || "Professional Resume";


        const headerTextJoined = headerTextLines.join('\n');
        const emailMatch = headerTextJoined.match(/[\w.-]+@[\w.-]+\.\w+/);
        if (emailMatch) resume.email = emailMatch[0];

        const phoneMatch = headerTextJoined.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
        if (phoneMatch) resume.phone_number = phoneMatch[0];

        const linkedinMatch = headerTextJoined.match(/linkedin\.com\/in\/([\w-]+)/i);
        if (linkedinMatch) resume.linkedin_url = "https://www.linkedin.com/in/" + linkedinMatch[1];
        
        const githubMatch = headerTextJoined.match(/github\.com\/([\w-]+)/i);
        if (githubMatch) resume.github_url = "https://github.com/" + githubMatch[1];
        
        // Example: a simple portfolio link might be just a URL.
        const portfolioMatch = headerTextJoined.match(/(https?:\/\/[^\s]+(\/\S*)?)/g);
        if (portfolioMatch) {
            const nonSocialPortfolio = portfolioMatch.find(url => 
                !url.includes('linkedin.com') && 
                !url.includes('github.com') &&
                (url.includes('.') && url.length > 10) // basic check for a domain
            );
            if (nonSocialPortfolio) resume.portfolio_url = nonSocialPortfolio;
        }
    }


    for (let i = firstSectionHeaderIndex; i < allLines.length; i++) {
        const line = allLines[i];
        if (line.startsWith("### ")) {
            processSectionContent();
            currentSection = line.substring(4).trim().toUpperCase();
        } else if (currentSection) {
            sectionContentAccumulator.push(line);
        } else if (firstSectionHeaderIndex === 0 && currentSection === "PERSONAL SUMMARY" && line.trim() !== "---") { // Catch content if default section
             sectionContentAccumulator.push(line);
        }
    }
    processSectionContent();

    return resume;
}

const ResumeView: React.FC = () => {
  const { resumeId } = useParams<{ resumeId: string }>();
  const [resume, setResume] = useState<YourResumeType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resumeId) {
      setError('No resume ID provided.');
      setLoading(false);
      return;
    }

    const fetchResume = async () => {
      setLoading(true);
      setError(null);
      setResume(null);

      try {
        const { data: rawData, error: fetchError } = await supabase
          .from('resumes')
          .select('id, user_id, content, target_role, created_at')
          .eq('id', resumeId)
          .single();

        if (fetchError) {
          console.error('[ResumeView] Error fetching resume from Supabase:', fetchError);
          setError(fetchError.message || 'Failed to load resume. It might not exist or you may not have permission.');
        } else if (rawData && typeof rawData.content === 'string') {
          console.log('[ResumeView] Raw resume data fetched:', rawData);
          try {
            const typedRawData = rawData as FetchedSupabaseResume;
            const parsedResume = parseMarkdownToStructuredResume(
              typedRawData.content,
              typedRawData.id,
              typedRawData.user_id,
              typedRawData.created_at,
              typedRawData.target_role
            );
            console.log('[ResumeView] Parsed resume data:', parsedResume);
            setResume(parsedResume);
          } catch (parseError: any) {
            console.error('[ResumeView] Error parsing resume content:', parseError);
            setError(`Failed to parse resume content: ${parseError.message}`);
          }
        } else if (rawData && typeof rawData.content !== 'string') {
            console.error('[ResumeView] Fetched data is missing the content string or it is not a string.');
            setError('Resume data is incomplete or content is in an unexpected format.');
        } else {
          console.log('[ResumeView] No data returned for resume (rawData is null). Resume not found.');
          setError('Resume not found. The link may be incorrect or the resume may have been removed.');
        }
      } catch (err: any) {
        console.error('[ResumeView] Unexpected error in fetchResume try-catch block:', err);
        setError(err.message || 'An unexpected error occurred while fetching the resume.');
      } finally {
        setLoading(false);
      }
    };

    fetchResume();
  }, [resumeId]);

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen"><LoadingSpinner /></div>;
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-4 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
        <p className="text-gray-700 dark:text-gray-300">{error}</p>
      </div>
    );
  }

  if (!resume) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-4 text-center">
        <h1 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Resume Not Processed</h1>
        <p className="text-gray-500 dark:text-gray-400">The resume could not be processed or displayed. This might be due to a parsing issue or if the resume was not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-white dark:bg-gray-900 shadow-lg my-8 printable-resume">
      <header className="text-center mb-8 border-b pb-6 border-gray-300 dark:border-gray-700">
        {resume.full_name && <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-1">{resume.full_name}</h1>}
        {resume.title && <p className="text-xl text-gray-600 dark:text-gray-400">{resume.title}</p>}
        <div className="flex justify-center gap-x-4 gap-y-2 mt-3 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
          {resume.email && <span>{resume.email}</span>}
          {resume.phone_number && <span>{resume.phone_number}</span>}
          {resume.linkedin_url && <a href={resume.linkedin_url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">LinkedIn</a>}
          {resume.github_url && <a href={resume.github_url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">GitHub</a>}
          {resume.portfolio_url && <a href={resume.portfolio_url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">Portfolio</a>}
        </div>
      </header>

      {resume.summary && (
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 border-b-2 border-gray-300 dark:border-gray-600 pb-2 mb-4">Summary</h2>
          <p className="text-gray-600 dark:text-gray-300 whitespace-pre-line">{resume.summary}</p>
        </section>
      )}

      {resume.experiences && resume.experiences.length > 0 && (
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 border-b-2 border-gray-300 dark:border-gray-600 pb-2 mb-4">Experience</h2>
          {resume.experiences.map((exp) => (
            <div key={exp.id} className="mb-6">
              <h3 className="text-xl font-medium text-gray-800 dark:text-white">{exp.job_title}</h3>
              {exp.company_name && <p className="text-md text-gray-600 dark:text-gray-400">{exp.company_name}</p>}
              <p className="text-sm text-gray-500 dark:text-gray-500">
                {exp.start_date && exp.start_date !== "N/A" ? new Date(exp.start_date).toLocaleDateString() : 'Date N/A'} - {exp.is_current ? 'Present' : exp.end_date && exp.end_date !== "N/A" ? new Date(exp.end_date).toLocaleDateString() : 'Date N/A'}
              </p>
              {exp.description && <p className="mt-2 text-gray-600 dark:text-gray-300 whitespace-pre-line">{exp.description}</p>}
            </div>
          ))}
        </section>
      )}

      {resume.education && resume.education.length > 0 && (
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 border-b-2 border-gray-300 dark:border-gray-600 pb-2 mb-4">Education</h2>
          {resume.education.map((edu) => (
            <div key={edu.id} className="mb-6">
              <h3 className="text-xl font-medium text-gray-800 dark:text-white">{edu.institution_name}</h3>
              {(edu.degree || edu.field_of_study) && <p className="text-md text-gray-600 dark:text-gray-400">{edu.degree}{edu.field_of_study && ` in ${edu.field_of_study}`}</p>}
              <p className="text-sm text-gray-500 dark:text-gray-500">
                 {edu.start_date && edu.start_date !== "N/A" ? new Date(edu.start_date).toLocaleDateString() : 'Date N/A'} - {edu.end_date && edu.end_date !== "N/A" ? new Date(edu.end_date).toLocaleDateString() : 'Present'}
              </p>
               {edu.description && <p className="mt-2 text-gray-600 dark:text-gray-300 whitespace-pre-line">{edu.description.trim()}</p>}
            </div>
          ))}
        </section>
      )}

      {resume.skills && resume.skills.length > 0 && (
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 border-b-2 border-gray-300 dark:border-gray-600 pb-2 mb-4">Skills</h2>
          <ul className="flex flex-wrap gap-2">
            {resume.skills.map((skill) => (
              <li key={skill.id} className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-1 px-3 rounded-full text-sm">
                {skill.name} {skill.level && `(${skill.level})`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default ResumeView;