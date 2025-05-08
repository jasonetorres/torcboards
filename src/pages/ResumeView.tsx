import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase'; 
import LoadingSpinner from '../components/LoadingSpinner'; 


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
  level?: string; // e.g., 'Intermediate', 'Advanced'
}

// Main Resume Type
interface YourResumeType {
  id: string; // Or whatever your primary key is for the resume
  title?: string; // e.g., "John Doe's Software Engineer Resume"
  full_name?: string;
  email?: string;
  phone_number?: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  summary?: string;
  // Assuming you store these as JSONB or have related tables
  // For simplicity, I'm showing them as arrays of objects.
  // You might need to adjust fetching if these are in separate tables.
  experiences?: ResumeExperience[];
  education?: ResumeEducation[];
  skills?: ResumeSkill[];
  // Add any other fields your resume might have
  // e.g., custom_sections, projects, etc.
  created_at?: string;
  user_id?: string; // The user who owns this resume
}

const ResumeView: React.FC = () => {
  const { resumeId } = useParams<{ resumeId: string }>(); // Get resumeId from URL
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
      try {
        // --- 2. Adjust Supabase query ---
        // TODO: Replace 'resumes' with your actual table name for resumes.
        // TODO: Ensure 'id' is the correct column for matching `resumeId`.
        // If your shareable link uses a different ID (e.g., a 'share_id'), query by that.
        // If experiences, education, skills are in different tables, you might need multiple queries
        // or to use Supabase's relational query features (e.g., .select(`*, experiences(*), education(*)`)).
        // For this example, I'm assuming they might be part of the main resume row (e.g., as JSONB).

        const { data, error: fetchError } = await supabase
          .from('resumes') // YOUR_RESUMES_TABLE_NAME
          .select('*') // Or specify columns: 'id, title, full_name, summary, experiences, education, skills'
          .eq('id', resumeId) // Or 'share_id' if that's what resumeId refers to
          .single(); // .single() expects exactly one row or throws an error

        if (fetchError) {
          console.error('Error fetching resume:', fetchError);
          setError(fetchError.message || 'Failed to load resume. It might not exist or you may not have permission.');
        } else if (data) {
          setResume(data as YourResumeType);
        } else {
          setError('Resume not found.');
        }
      } catch (err: any) {
        console.error('Unexpected error fetching resume:', err);
        setError(err.message || 'An unexpected error occurred.');
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
        {/* You could add a button to go back or to the homepage */}
      </div>
    );
  }

  if (!resume) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-4 text-center">
        <h1 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Resume Not Found</h1>
        <p className="text-gray-500 dark:text-gray-400">The resume you are looking for does not exist or is unavailable.</p>
      </div>
    );
  }

  // --- 3. Render the resume data ---
  // This is a basic layout. You'll want to style it significantly.
  // TODO: Replace with your desired layout and styling. Use UI components if you have them.
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-white dark:bg-gray-900 shadow-lg my-8 printable-resume">
      {/* Header Section */}
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

      {/* Summary Section */}
      {resume.summary && (
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 border-b-2 border-gray-300 dark:border-gray-600 pb-2 mb-4">Summary</h2>
          <p className="text-gray-600 dark:text-gray-300 whitespace-pre-line">{resume.summary}</p>
        </section>
      )}

      {/* Experience Section */}
      {resume.experiences && resume.experiences.length > 0 && (
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 border-b-2 border-gray-300 dark:border-gray-600 pb-2 mb-4">Experience</h2>
          {resume.experiences.map((exp) => (
            <div key={exp.id} className="mb-6">
              <h3 className="text-xl font-medium text-gray-800 dark:text-white">{exp.job_title}</h3>
              <p className="text-md text-gray-600 dark:text-gray-400">{exp.company_name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                {new Date(exp.start_date).toLocaleDateString()} - {exp.is_current ? 'Present' : exp.end_date ? new Date(exp.end_date).toLocaleDateString() : 'N/A'}
              </p>
              <p className="mt-2 text-gray-600 dark:text-gray-300 whitespace-pre-line">{exp.description}</p>
            </div>
          ))}
        </section>
      )}

      {/* Education Section */}
      {resume.education && resume.education.length > 0 && (
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 border-b-2 border-gray-300 dark:border-gray-600 pb-2 mb-4">Education</h2>
          {resume.education.map((edu) => (
            <div key={edu.id} className="mb-6">
              <h3 className="text-xl font-medium text-gray-800 dark:text-white">{edu.institution_name}</h3>
              <p className="text-md text-gray-600 dark:text-gray-400">{edu.degree} in {edu.field_of_study}</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                 {new Date(edu.start_date).toLocaleDateString()} - {edu.end_date ? new Date(edu.end_date).toLocaleDateString() : 'Present'}
              </p>
               {edu.description && <p className="mt-2 text-gray-600 dark:text-gray-300 whitespace-pre-line">{edu.description}</p>}
            </div>
          ))}
        </section>
      )}

      {/* Skills Section */}
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

      {/* You can add more sections here (Projects, Certifications, etc.) */}

    </div>
  );
};

export default ResumeView;