import OpenAI from 'openai';
import { supabase } from './supabase';
import { format, addDays, startOfWeek, isValid, isPast, isToday } from 'date-fns'; // Ensure all needed date-fns are imported

// --- Type Definitions ---
interface AIEventData {
    title: string;
    description?: string;
    date: string; // Expect 'YYYY-MM-DD'
    type: string; // e.g., 'follow_up', 'research', 'schedule_suggestion', 'application_deadline'
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
    id: string; // Now it's definitely there
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
    source?: string; // Added source field
    related_calendar_event_id?: string | null;
    related_application_id?: string | null;
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

// --- Helper function to map CalendarEventRow to TaskInsertData (Updated with source) ---
function mapCalendarEventToTaskData(event: CalendarEventRow, userId: string): TaskInsertData {
    const taskStatus: TaskInsertData['status'] = event.completed ? 'completed' : 'pending';
    let taskSource = 'ai_generated'; // Default source

    // Derive source from event_type
    if (event.event_type) {
        if (event.event_type.includes('schedule')) {
            taskSource = 'ai_schedule';
        } else if (event.event_type.includes('reminder') || ['follow_up', 'research', 'preparation', 'networking', 'application_deadline'].includes(event.event_type)) {
            taskSource = `ai_reminder_${event.event_type}`;
        } else {
            taskSource = `ai_${event.event_type}`; // Generic AI source
        }
    }

    return {
        user_id: userId,
        title: event.title,
        description: event.description || null,
        due_date: event.event_date || null,
        priority: 'medium',
        status: taskStatus,
        source: taskSource, // Set the source
        related_calendar_event_id: event.id,
        related_application_id: event.related_application_id || null,
    };
}

// --- generateSmartReminders (Updated to use the new mapAIEventToTaskData) ---
export async function generateSmartReminders(date: Date, applications: any[], companies: any[]): Promise<void> {
  if (!isOpenAIConfigured() || !openai) { console.warn("OpenAI not configured for smart reminders."); return; }
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) { console.error("User not logged in for smart reminders."); return; }
  const userId = authData.user.id;

  try {
    const formattedDate = format(date, 'yyyy-MM-dd');
    const appContext = applications.slice(0, 5).map(app => ({ id: app.id, position: app.position, next_follow_up: app.next_follow_up, company_name: app.companies?.name }));
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
            aiEventDataArray = parsedResponse.tasks;
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
        console.log(`Successfully upserted ${upsertedCalendarEvents.length} AI reminders into calendar.`);
        const tasksToSave = upsertedCalendarEvents.map(calEvent => mapCalendarEventToTaskData(calEvent as CalendarEventRow, userId));
        if (tasksToSave.length > 0) {
          const { error: taskUpsertError } = await supabase.from('tasks').upsert(tasksToSave, { onConflict: 'user_id, related_calendar_event_id' });
          if (taskUpsertError) { console.error("Error upserting corresponding tasks:", taskUpsertError); }
          else { console.log(`Successfully upserted ${tasksToSave.length} corresponding tasks.`); }
        }
      }
    } else { console.log("AI generated no valid tasks for the specified date."); }
  } catch (error: any) { console.error('Error in generateSmartReminders:', error); if (error instanceof OpenAI.APIError) { console.error(`OpenAI API Error: ${error.status} ${error.name} ${error.message}`); } }
}


// --- generateJobHuntingSchedule (Updated to use the new mapAIEventToTaskData) ---
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
        const appContext = applications.slice(0, 10).map(app => ({ id: app.id, position: app.position, next_follow_up: app.next_follow_up, company_name: app.companies?.name }));
        const companyContext = companies.slice(0, 10).map(c => ({ id: c.id, name: c.name }));

        const response = await openai.chat.completions.create({ /* ... OpenAI prompt parameters ... */
            model: "gpt-4-turbo", response_format: { type: "json_object" },
            messages: [ { role: "system", content: `You are an expert career coach. Create a structured job hunting schedule for the upcoming week (${dateRangeStr}) based on user context. Generate a JSON object containing a single key "schedule_items", which is an array of event objects. Each event object MUST have: "title" (string, specific action), "date" (string, 'YYYY-MM-DD' format, MUST be within ${dateRangeStr}), "type" (string, e.g., 'job_search', 'application', 'networking', 'preparation', 'follow_up'), and "description" (string, optional brief detail). Optionally include "related_application_id" (string) if an action pertains to ONE specific application from the context. Aim for a balanced schedule across the week (e.g., 1-3 meaningful tasks per day). Prioritize based on upcoming follow-ups. Example item: {"title": "Search for new Data Analyst roles", "date": "${scheduleDates[0]}", "type": "job_search", "description": "Spend 1 hour on LinkedIn/Indeed."} Example item: {"title": "Follow up on Senior Dev application", "date": "${scheduleDates[2]}", "type": "follow_up", "description": "Check status via email.", "related_application_id": "uuid-goes-here-or-null"} Ensure output is valid JSON. The "schedule_items" array should be inside a parent JSON object.` }, { role: "user", content: `Generate JSON schedule items for the week ${dateRangeStr}. Context: Applications: ${JSON.stringify(appContext)} Target Companies: ${JSON.stringify(companyContext)}` } ],
            temperature: 0.7, max_tokens: 1000,
        });

        let aiScheduleItems: AIEventData[] = [];
        try {
            if (response.choices[0]?.message?.content) {
                const parsedResponse = JSON.parse(response.choices[0].message.content);
                if (parsedResponse && Array.isArray(parsedResponse.schedule_items)) { aiScheduleItems = parsedResponse.schedule_items; }
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
                console.log(`Successfully upserted ${upsertedCalendarEvents.length} AI schedule items into calendar.`);
                const tasksToSave = upsertedCalendarEvents.map(calEvent => mapCalendarEventToTaskData(calEvent as CalendarEventRow, userId));
                if (tasksToSave.length > 0) {
                  const { error: taskUpsertError } = await supabase.from('tasks').upsert(tasksToSave, { onConflict: 'user_id, related_calendar_event_id' });
                  if (taskUpsertError) { console.error("Error upserting corresponding tasks from schedule:", taskUpsertError); }
                  else { console.log(`Successfully upserted ${tasksToSave.length} corresponding tasks from schedule.`); }
                }
            }
        } else { console.log("AI generated no valid schedule items for the specified week."); }
    } catch (error: any) { console.error('Error in generateJobHuntingSchedule:', error); if (error instanceof OpenAI.APIError) { console.error(`OpenAI API Error: ${error.status} ${error.name} ${error.message}`); } }
}


// --- Other AI functions (Restored to original functional state) ---
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
  } catch (error) {
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
   } catch (error) {
    console.error("Error generating weekly recap:", error);
    return "Error generating weekly recap email.";
   }
}

export async function analyzeResume(resumeText: string): Promise<string> {
  if (!isOpenAIConfigured() || !openai) return "OpenAI API key not configured. Resume analysis unavailable.";
  try {
     const response = await openai.chat.completions.create({
         model: "gpt-4-turbo",
         messages: [ { role: "system", content: "You are a resume analyst. Provide actionable feedback." }, { role: "user", content: `Analyze this resume: ${resumeText}. Give feedback on: overall impression, strengths, improvements, ATS optimization.` } ]
     });
     return response.choices[0].message.content || "Could not analyze resume.";
  } catch (error: any) {
     console.error("Error analyzing resume:", error);
     if (error instanceof OpenAI.APIError) return `Resume analysis error: ${error.message}`;
     return "An unexpected error occurred while analyzing the resume.";
  }
}

export async function analyzeJobDescription(jobDescription: string): Promise<string> {
  if (!isOpenAIConfigured() || !openai) return "OpenAI API key not configured. Job description analysis unavailable.";
  try {
      const response = await openai.chat.completions.create({
         model: "gpt-4-turbo",
         messages: [ { role: "system", content: "You are a job market analyst." }, { role: "user", content: `Analyze this job description: ${jobDescription}. Provide: key requirements, skills, resume keywords, application tips, potential interview questions.` } ]
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