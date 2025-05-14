// openai.ts
import OpenAI from 'openai';
import { supabase } from './supabase'; // Adjust path if necessary
import { format, addDays, startOfWeek } from 'date-fns'; // Adjust path if necessary

// --- Type Definitions ---
interface AIEventData {
    title: string;
    description?: string;
    date: string;
    type: string;
    related_application_id?: string | null;
    related_task_id?: string | null;
}
interface CalendarEventInsertData {
    user_id: string;
    id?: string;
    title: string;
    description: string;
    event_date: string;
    event_type: string;
    completed: boolean;
    related_application_id?: string | null;
    related_task_id?: string | null;
}
interface CalendarEventRow extends CalendarEventInsertData {
    id: string;
    created_at: string;
    updated_at: string;
}
interface TaskInsertData {
    user_id: string;
    title: string;
    description?: string | null;
    due_date?: string | null;
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'completed' | 'overdue';
    source?: string;
    related_calendar_event_id?: string | null;
    related_application_id?: string | null;
}
export interface EnhancedAnalysisResult {
  suggestionsMarkdown: string;
  correctedResumeMarkdown?: string;
}

// --- OpenAI Client Initialization ---
let openai: OpenAI | null = null;
let isConfigured = false;

if (import.meta.env.VITE_OPENAI_API_KEY) {
  try {
      openai = new OpenAI({
        apiKey: import.meta.env.VITE_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true,
      });
      isConfigured = true;
  } catch (error) { console.error("Failed to initialize OpenAI client:", error); }
} else { console.warn("VITE_OPENAI_API_KEY not found. OpenAI features will be disabled."); }

const isOpenAIConfigured = () => isConfigured && openai !== null;

const RESUME_TEMPLATE_MARKDOWN_FOR_PARSER = `
JOHN DOE  <-- THIS LINE MUST BE THE USER'S ACTUAL FULL NAME FROM THEIR RESUME
Senior Software Engineer <-- THIS LINE IS THE PROFESSIONAL TITLE (CAN BE DERIVED FROM TARGET ROLE/JD)
john.doe@example.com | (555) 123-4567 | linkedin.com/in/johndoe | github.com/johndoe | portfolio.johndoe.com

---

### PERSONAL SUMMARY
Highly motivated and results-oriented Senior Software Engineer...

---

### TECHNICAL SKILLS
- JavaScript (Expert)
- TypeScript (Advanced)
...

---

### EXPERIENCE
- **Senior Software Engineer** at Tech Solutions Inc. | San Francisco, CA | Jan 2020 – Present
  {/* AI Note: Dates MUST be in "Month Year – Month Year" or "Month Year – Present" format. E.g., "January 2020 – Present" */}
  - Led a team of 5 engineers...
  - Tech Stack: JavaScript, TypeScript, React...

- **Software Engineer** at Innovatech Ltd. | Boston, MA | Jun 2017 – Dec 2019
  {/* AI Note: Dates MUST be in "Month Year – Month Year" format. E.g., "June 2017 – December 2019" */}
  - Developed and maintained features...

---

### TECHNICAL PROJECTS
- **Personal Portfolio Website** | Self-driven | Jan 2023 – Present
  {/* AI Note: Dates MUST be in "Month Year – Month Year" or "Month Year – Present" format. */}
  - Developed a responsive personal portfolio website...

---

### EDUCATION
- **Master of Science in Computer Science** | Stanford University | Stanford, CA | Aug 2015 – May 2017
  {/* AI Note: Dates MUST be in "Month Year – Month Year" or "Month Year – Present" format. E.g., "August 2015 – May 2017" */}
  - Specialization in Artificial Intelligence.

- **Bachelor of Science in Software Engineering** | Massachusetts Institute of Technology (MIT) | Cambridge, MA | Sep 2011 – May 2015
  {/* AI Note: Dates MUST be in "Month Year – Month Year" format. */}
  - Graduated Magna Cum Laude.
`;

// --- analyzeResume (MODIFIED) ---
export async function analyzeResume(
  resumeText: string,
  targetRole?: string,
  jobDescriptionText?: string
): Promise<EnhancedAnalysisResult> {
  if (!isOpenAIConfigured() || !openai) {
    return {
      suggestionsMarkdown: "OpenAI API key not configured. Resume analysis unavailable.",
    };
  }

  const userStylePreference = `
User's Preferred Resume Style (for overall tone, section content, and professionalism - as per their template provided in conversation 'Resume Template.txt' [cite: 1]):
The user's template emphasizes a clean, professional, and simple format. It uses a table-like structure for sections like 'CAREER SUMMARY' (with Experience, Skill Highlight, Languages, Tools) and specific formatting for 'PROFESSIONAL EXPERIENCE' (Company, Location on one line, Position, Dates on another, then Technologies, then bullet points).
Key elements from their preferred style:
- CAREER SUMMARY: Includes Experience, Skill Highlight, Languages, Tools[cite: 1].
- PROFESSIONAL EXPERIENCE: Emphasis on wins, unique responsibilities, 3-5 bullet points, quantification. Technologies listed[cite: 1]. Don’t give a description of the company or describe the generic role[cite: 1].
- PROJECTS: Similar detail to experience, including technologies and quantification[cite: 1].
- EDUCATION & ACCREDITATIONS: School, Program, Dates, notable bullet points only if relevant[cite: 1].
- General: Aim for 1 page. Order languages by strength (strongest to weakest)[cite: 1]. Include full URLs rather than hyperlinked text[cite: 1]. No career objective on the resume itself[cite: 1].
While the "correctedResumeMarkdown" MUST adhere to the RESUME_MARKDOWN_TEMPLATE_FOR_PARSER for system compatibility, the *content*, *level of detail*, *sectioning intent*, and *professional tone* within those parseable sections should be heavily inspired by the user's preferred style. For example, information that would go into their 'CAREER SUMMARY' table (like 'Skill Highlight', 'Languages', 'Tools') should be integrated effectively into the '### PERSONAL SUMMARY' or '### TECHNICAL SKILLS' sections of the output parser template.
`;

  const systemPrompt = `You are an expert resume reviewer and career coach.
Your task is to analyze the provided resume content. You will be given the user's current resume text, an optional target role, and an optional job description text.

1.  **Extract User's Full Name:** Identify the user's full name from their "User's Current Resume Content". This name MUST be placed on the very first line of your "correctedResumeMarkdown".
2.  **Determine Professional Title:** Based on the job description (if provided), the target role (if provided), or the user's current/most recent role in their resume, determine an appropriate professional title. This title MUST be placed on the second line of "correctedResumeMarkdown", directly below the user's full name.
3.  **Job Description Focus (If Provided):** If a job description is provided, your primary goal is to meticulously analyze it to identify key requirements, skills, technologies, and keywords. Then, review the resume specifically against this job description.
4.  **Target Role Focus (If JD Not Provided):** If no job description is available, use the target role (if provided) to guide your analysis and suggestions.
5.  **General Review (If Neither JD Nor Role Provided):** If neither is available, provide a general best-practice review.

You must return your feedback as a VALID JSON object with two main keys:
    a.  "suggestionsMarkdown": Provide detailed, actionable suggestions to improve the resume, formatted as Markdown. Clearly explain how your suggestions align with the job description (if provided) or the target role. Highlight areas for improvement regarding keywords, quantifiable achievements, action verbs, and overall impact relevant to the job description/target role.
    b.  "correctedResumeMarkdown": Provide a complete, rewritten version of the entire resume content, also formatted as Markdown. This version MUST incorporate your suggestions and be highly tailored to the job description (if provided) or the target role.

**VERY IMPORTANT FOR "correctedResumeMarkdown":**
    - The **first line MUST be the user's Full Name** (extracted from their resume).
    - The **second line MUST be the Professional Title** (derived from target role/JD/current role).
    - Subsequent lines in the header should be contact information (email, phone, LinkedIn, GitHub, Portfolio URLs if found in the resume).
    - It MUST then strictly adhere to the specific Markdown structure (section headers like '### PERSONAL SUMMARY', '### EXPERIENCE', item formatting like '- **Title** at Company | Location | Dates') and guidelines provided in the "RESUME MARKDOWN TEMPLATE FOR PARSER" section below. This ensures the resume can be parsed by our system.
    - **All dates (for experience, education, projects) MUST be written in the format "Month Year – Month Year" or "Month Year – Present" (e.g., "January 2020 – Present", "August 2015 – May 2017"). Do NOT use "MM/YYYY" or other formats.**
    - While adhering to the parser template for structure, the *content, detail, and professional tone* should be inspired by the user's preferred style notes provided below (from "Resume Template.txt" [cite: 1]).

Ensure the output is a single JSON object.

RESUME MARKDOWN TEMPLATE FOR PARSER (Structure to follow for "correctedResumeMarkdown"):
---
${RESUME_TEMPLATE_MARKDOWN_FOR_PARSER}
---

USER'S PREFERRED RESUME STYLE GUIDANCE (for content and tone, from "Resume Template.txt" [cite: 1]):
---
${userStylePreference}
---
`;

  const userPromptParts = [];
  userPromptParts.push(`Target Role (use for deriving Professional Title if JD is not specific, or as secondary context): ${targetRole || 'Not specified'}`);

  if (jobDescriptionText && jobDescriptionText.trim() !== "") {
    userPromptParts.push(`Job Description (Primary focus for tailoring and deriving Professional Title):
---
${jobDescriptionText}
---`);
  } else {
    userPromptParts.push(`No specific job description text provided. Derive Professional Title from Target Role or current resume. Proceed with analysis based on Target Role or general best practices, keeping the user's style preference in mind.`);
  }

  userPromptParts.push(`User's Current Resume Content (Source for User's Full Name and existing experience):
---
${resumeText}
---`);

  const userPrompt = userPromptParts.join('\n\n');

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo", // Or your preferred model
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3, // Keep temperature low for structured output
    });

    if (response.choices[0]?.message?.content) {
      try {
        const parsedResult = JSON.parse(response.choices[0].message.content) as EnhancedAnalysisResult;
        if (typeof parsedResult.suggestionsMarkdown === 'string' && (parsedResult.correctedResumeMarkdown === undefined || typeof parsedResult.correctedResumeMarkdown === 'string') ) {
          return parsedResult;
        } else {
          console.error("AI response JSON did not match expected structure:", parsedResult);
          return {
            suggestionsMarkdown: "Error: AI analysis returned an unexpected data structure. Raw: " + response.choices[0].message.content,
          };
        }
      } catch (parseError) {
        console.error("Error parsing AI JSON response:", parseError, "\nRaw AI Response:", response.choices[0].message.content);
        return {
          suggestionsMarkdown: `Error: Could not parse AI's response. Raw response started with: \n\n${response.choices[0].message.content.substring(0, 300)}...`,
        };
      }
    } else {
      return {
        suggestionsMarkdown: "AI analysis did not return any content.",
      };
    }
  } catch (error: any) {
    console.error("Error during OpenAI API call for resume analysis:", error);
    if (error instanceof OpenAI.APIError) {
      return {
        suggestionsMarkdown: `Error from OpenAI API: ${error.status} ${error.name} - ${error.message}`,
      };
    }
    return {
      suggestionsMarkdown: "An unexpected error occurred while analyzing resume.",
    };
  }
}

// ... (rest of your openai.ts file - mapCalendarEventToTaskData, generateSmartReminders, etc.)
// These helper functions and other AI calls remain unchanged from your previous version.

// Helper function to map CalendarEventRow to TaskInsertData
function mapCalendarEventToTaskData(event: CalendarEventRow, userId: string): TaskInsertData {
    const taskStatus: TaskInsertData['status'] = event.completed ? 'completed' : 'pending';
    let taskSource = 'ai_generated';
    if (event.event_type) {
        if (event.event_type.includes('schedule')) {
            taskSource = 'ai_schedule';
        } else if (event.event_type.includes('reminder') || ['follow_up', 'research', 'preparation', 'networking', 'application_deadline'].includes(event.event_type)) {
            taskSource = `ai_reminder_${event.event_type}`;
        } else {
            taskSource = `ai_${event.event_type}`;
        }
    }
    return {
        user_id: userId,
        title: event.title,
        description: event.description || null,
        due_date: event.event_date || null,
        priority: 'medium', 
        status: taskStatus,
        source: taskSource,
        related_calendar_event_id: event.id,
        related_application_id: event.related_application_id || null,
    };
}

// generateSmartReminders
export async function generateSmartReminders(date: Date, applications: any[], companies: any[]): Promise<void> {
  if (!isOpenAIConfigured() || !openai) { console.warn("OpenAI not configured for smart reminders."); return; }
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) { console.error("User not logged in for smart reminders."); return; }
  const userId = authData.user.id;
  try {
    const formattedDate = format(date, 'yyyy-MM-dd');
    const appContext = applications.slice(0, 5).map(app => ({ id: app.id, position: app.position, next_follow_up: app.next_follow_up, company_name: (app as any).companies?.name }));
    const companyContext = companies.slice(0, 5).map(c => ({ id: c.id, name: c.name }));
    const response = await openai.chat.completions.create({
        model: "gpt-4-turbo", response_format: { type: "json_object" },
        messages: [ { role: "system", content: `You are an AI assistant specializing in job search optimization. Create 2-3 clear, actionable calendar event reminders for the user ONLY for the date ${formattedDate}. Base reminders on their recent activity: Applications (context provided): Consider upcoming follow-ups or application deadlines. If a reminder relates directly to ONE application, include its 'application_id'. Target Companies (context provided): Suggest research or networking actions related to these. General Tasks: Suggest tasks like 'Prepare for interviews' or 'Update resume'. Output MUST be a valid JSON object containing a single key "tasks", which is an array of event objects. Each event object MUST have: "title" (string, concise, no company names), "date" (string, MUST be "${formattedDate}"), "type" (string, e.g., 'follow_up', 'research', 'preparation', 'networking'), and "description" (string, brief action). Optionally include: "related_application_id" (string, if directly related to one application from context) or "related_task_id" (string, if related to an existing task - context not provided here, so likely null). Example event object: {"title": "Follow up on [Position Type] application", "date": "${formattedDate}", "type": "follow_up", "description": "Send polite follow-up email.", "related_application_id": "uuid-goes-here-or-null"} DO NOT generate tasks for dates other than ${formattedDate}. Ensure the "tasks" array is inside a parent JSON object.` }, { role: "user", content: `Generate JSON tasks for ${formattedDate}. Context: Applications: ${JSON.stringify(appContext)} Target Companies: ${JSON.stringify(companyContext)}` } ],
        temperature: 0.6, max_tokens: 600,
    });
    let aiEventDataArray: AIEventData[] = [];
    try {
      if (response.choices[0]?.message?.content) {
        const parsedResponse = JSON.parse(response.choices[0].message.content);
        if (parsedResponse && Array.isArray(parsedResponse.tasks)) {
            aiEventDataArray = parsedResponse.tasks as AIEventData[];
        } else { console.warn("AI response 'tasks' field is not a valid array:", parsedResponse); }
      }
    } catch (parseError) { console.error("Error parsing AI JSON for reminders:", parseError, response.choices[0]?.message?.content); return; }
    const calendarEventsToSave: CalendarEventInsertData[] = aiEventDataArray
     .filter(task => task.date === formattedDate && task.title)
     .map(task => ({
        user_id: userId, title: task.title, description: task.description || '',
        event_date: task.date, event_type: task.type || 'ai_generated', completed: false,
        related_application_id: task.related_application_id || null, related_task_id: task.related_task_id || null,
     }));
    if (calendarEventsToSave.length > 0) {
      const { data: upsertedCalendarEvents, error: upsertError } = await supabase
        .from('calendar_events')
        .upsert(calendarEventsToSave, { onConflict: 'user_id,title,event_date' })
        .select();
      if (upsertError) { console.error("Error upserting AI reminders into calendar_events:", upsertError); }
      else if (upsertedCalendarEvents) {
        const tasksToSave: TaskInsertData[] = upsertedCalendarEvents.map(calEvent => mapCalendarEventToTaskData(calEvent as CalendarEventRow, userId));
        if (tasksToSave.length > 0) {
          const { error: taskUpsertError } = await supabase.from('tasks').upsert(tasksToSave, { onConflict: 'user_id,related_calendar_event_id' });
          if (taskUpsertError) { console.error("Error upserting corresponding tasks:", taskUpsertError); }
        }
      }
    }
  } catch (error: any) { console.error('Error in generateSmartReminders:', error); if (error instanceof OpenAI.APIError) { console.error(`OpenAI API Error: ${error.status} ${error.name} ${error.message}`); } }
}

// generateJobHuntingSchedule
export async function generateJobHuntingSchedule(applications: any[], companies: any[]): Promise<void> {
    if (!isOpenAIConfigured() || !openai) { console.warn("OpenAI not configured for schedule."); return; }
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) { console.error("User not logged in for schedule generation."); return; }
    const userId = authData.user.id;
    try {
        const today = new Date();
        const startOfThisWeek = startOfWeek(today, { weekStartsOn: 1 });
        const scheduleDates = Array.from({ length: 5 }).map((_, i) => format(addDays(startOfThisWeek, i), 'yyyy-MM-dd'));
        const dateRangeStr = `${scheduleDates[0]} to ${scheduleDates[scheduleDates.length - 1]}`;
        const appContext = applications.slice(0, 10).map(app => ({ id: app.id, position: app.position, next_follow_up: app.next_follow_up, company_name: (app as any).companies?.name }));
        const companyContext = companies.slice(0, 10).map(c => ({ id: c.id, name: c.name }));
        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo", response_format: { type: "json_object" },
            messages: [ { role: "system", content: `You are an expert career coach. Create a structured job hunting schedule for the upcoming week (${dateRangeStr}) based on user context. Generate a JSON object containing a single key "schedule_items", which is an array of event objects. Each event object MUST have: "title" (string, specific action), "date" (string, 'YYYY-MM-DD' format, MUST be within ${dateRangeStr}), "type" (string, e.g., 'job_search', 'application', 'networking', 'preparation', 'follow_up'), and "description" (string, optional brief detail). Optionally include "related_application_id" (string) if an action pertains to ONE specific application from the context. Aim for a balanced schedule across the week (e.g., 1-3 meaningful tasks per day). Prioritize based on upcoming follow-ups. Example item: {"title": "Search for new Data Analyst roles", "date": "${scheduleDates[0]}", "type": "job_search", "description": "Spend 1 hour on LinkedIn/Indeed."} Example item: {"title": "Follow up on Senior Dev application", "date": "${scheduleDates[2]}", "type": "follow_up", "description": "Check status via email.", "related_application_id": "uuid-goes-here-or-null"} Ensure output is valid JSON. The "schedule_items" array should be inside a parent JSON object.` }, { role: "user", content: `Generate JSON schedule items for the week ${dateRangeStr}. Context: Applications: ${JSON.stringify(appContext)} Target Companies: ${JSON.stringify(companyContext)}` } ],
            temperature: 0.7, max_tokens: 1000,
        });
        let aiScheduleItems: AIEventData[] = [];
        try {
            if (response.choices[0]?.message?.content) {
                const parsedResponse = JSON.parse(response.choices[0].message.content);
                if (parsedResponse && Array.isArray(parsedResponse.schedule_items)) { aiScheduleItems = parsedResponse.schedule_items as AIEventData[]; }
                else { console.warn("AI response 'schedule_items' field is not a valid array:", parsedResponse); }
            }
        } catch (parseError) { console.error("Error parsing AI JSON for schedule:", parseError, response.choices[0]?.message?.content); return; }
        const calendarEventsToSave: CalendarEventInsertData[] = aiScheduleItems
            .filter(item => item.title && scheduleDates.includes(item.date))
            .map(item => ({
                user_id: userId, title: item.title, description: item.description || '', event_date: item.date,
                event_type: item.type || 'schedule_suggestion', completed: false,
                related_application_id: item.related_application_id || null, related_task_id: null,
            }));
        if (calendarEventsToSave.length > 0) {
            const { data: upsertedCalendarEvents, error: upsertError } = await supabase
                .from('calendar_events')
                .upsert(calendarEventsToSave, { onConflict: 'user_id,title,event_date' })
                .select();
            if (upsertError) { console.error("Error upserting AI schedule into calendar_events:", upsertError); }
            else if (upsertedCalendarEvents) {
                const tasksToSave: TaskInsertData[] = upsertedCalendarEvents.map(calEvent => mapCalendarEventToTaskData(calEvent as CalendarEventRow, userId));
                if (tasksToSave.length > 0) {
                  const { error: taskUpsertError } = await supabase.from('tasks').upsert(tasksToSave, { onConflict: 'user_id,related_calendar_event_id' });
                  if (taskUpsertError) { console.error("Error upserting corresponding tasks from schedule:", taskUpsertError); }
                }
            }
        }
    } catch (error: any) { console.error('Error in generateJobHuntingSchedule:', error); if (error instanceof OpenAI.APIError) { console.error(`OpenAI API Error: ${error.status} ${error.name} ${error.message}`); } }
}

// Other AI functions
export async function suggestNetworkingActions(applications: any[], companies: any[]): Promise<string | null> {
  if (!isOpenAIConfigured() || !openai) {
    console.warn("OpenAI not configured. Cannot suggest networking actions.");
    return "OpenAI API key not configured. Please add your API key to continue using AI features.";
  }
  try {
    const companyIndustries = [...new Set(companies.map((company: any) => company.industry).filter(Boolean))].join(', ') || 'various industries';
    const companyTypes = [...new Set(companies.map((company: any) => company.type).filter(Boolean))].join(', ') || 'various company types';
    const upcomingFollowUpsCount = applications.filter((app: any) => app.next_follow_up).length;
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: "You are an expert networking and career development strategist. Create actionable networking suggestions without mentioning specific company names." },
        { role: "user", content: `Based on target companies (Industries: ${companyIndustries}; Types: ${companyTypes}) and the number of upcoming application follow-ups (${upcomingFollowUpsCount}), suggest practical networking actions:\n\n1. Identify relevant online communities or forums focused on [${companyIndustries}].\n2. Find virtual or local (if applicable, mention checking local listings) professional events/meetups related to [${companyIndustries}].\n3. Suggest strategies for informational interviews targeting roles or company types like [${companyTypes}].\n4. Provide sample LinkedIn connection request templates for professionals in [${companyIndustries}] or working at [${companyTypes}] companies.\n5. Recommend 2-3 key professional organizations or associations relevant to [${companyIndustries}].\n\nFormat suggestions clearly using actionable bullet points or numbered lists.` }
      ]
    });
    return response.choices[0].message.content || "No suggestions generated.";
  } catch (error: any) {
    console.error('Error suggesting networking actions:', error);
     if (error instanceof OpenAI.APIError) { return `An error occurred while generating networking suggestions: ${error.message}. Please check your OpenAI configuration or try again later.`; }
    return "An unexpected error occurred while generating networking suggestions. Please try again later.";
  }
}

export async function generateWelcomeEmail(firstName: string): Promise<string | null> {
  if (!isOpenAIConfigured() || !openai) {
    console.warn("OpenAI not configured. Cannot generate welcome email.");
    return `Welcome ${firstName}! Job Hunt CRM is ready for you. Set up your OpenAI key for AI-powered assistance!`;
  }
  try {
    const response = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [ { role: "system", content: "You are a friendly career assistant for a Job Hunt CRM." }, { role: "user", content: `Write a short, warm welcome email for ${firstName}, briefly mentioning key features like application tracking, calendar, and tasks.` } ]
    });
    return response.choices[0].message.content;
  } catch (error: any) { 
    console.error("Error generating welcome email:", error);
    return `Welcome ${firstName}! There was an issue generating a personalized message. You can start tracking your job applications, manage tasks, and use the AI tools to help your search.`;
  }
}

export async function generateWeeklyRecapEmail(stats: any, firstName: string): Promise<string | null> {
  if (!isOpenAIConfigured() || !openai) {
    console.warn("OpenAI not configured. Cannot generate weekly recap.");
    return "OpenAI API key not configured for weekly recap.";
  }
   try {
     const response = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [ { role: "system", content: "You are a career coach. Write a concise, encouraging weekly recap HTML email based on provided stats." }, { role: "user", content: `Generate HTML email recap for ${firstName}. Stats: Apps: ${stats.applications_count}, Interviews: ${JSON.stringify(stats.upcoming_interviews)}, Tasks Due: ${JSON.stringify(stats.tasks_due)}. Include summary, insights, suggestions, and motivation.` } ]
    });
    return response.choices[0].message.content;
   } catch (error: any) { 
    console.error("Error generating weekly recap:", error);
    return "Error generating weekly recap email.";
   }
}

export async function analyzeJobDescription(jobDescriptionText: string): Promise<string> {
  if (!isOpenAIConfigured() || !openai) return "OpenAI API key not configured. Job description analysis unavailable.";
  try {
      const response = await openai.chat.completions.create({
         model: "gpt-4-turbo",
         messages: [
            { role: "system", content: "You are a job market analyst. Your task is to analyze the provided job description." },
            { role: "user", content: `Please analyze the following job description and provide: key requirements, essential skills, desirable skills, resume keywords to include, potential application tips relevant to this description, and a few potential interview questions a candidate might expect based on this job description.\n\nJob Description:\n---\n${jobDescriptionText}\n---` }
          ]
     });
     return response.choices[0].message.content || "Could not analyze job description.";
  } catch (error: any) {
    console.error("Error analyzing job description:", error);
    if (error instanceof OpenAI.APIError) return `Job description analysis error: ${error.message}`;
    return "An unexpected error occurred while analyzing the job description.";
  }
}

export async function getInterviewPrep(position: string, company: string): Promise<string> {
  if (!isOpenAIConfigured() || !openai) return "OpenAI API key not configured. Interview prep unavailable.";
   try {
       const response = await openai.chat.completions.create({
         model: "gpt-4-turbo",
         messages: [ { role: "system", content: "You are an interview coach." }, { role: "user", content: `Provide interview prep for ${position} at ${company}. Include: common questions, company-specific questions, potential technical questions, questions to ask, tips.` } ]
     });
     return response.choices[0].message.content || "Could not generate interview prep.";
   } catch (error: any) {
    console.error("Error getting interview prep:", error);
    if (error instanceof OpenAI.APIError) return `Interview prep generation error: ${error.message}`;
    return "An unexpected error occurred while generating interview prep.";
   }
}