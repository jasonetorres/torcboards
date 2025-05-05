import OpenAI from 'openai';
import { supabase } from './supabase'; // Assuming correct path
import { format, addDays, startOfWeek } from 'date-fns'; // Ensure date-fns is installed

// Define types for AI data structures if not imported from elsewhere
// This helps ensure consistency with what the AI is asked to return
interface AIEventData {
    title: string;
    description?: string;
    date: string; // Expect 'YYYY-MM-DD'
    type: string; // e.g., 'follow_up', 'research', 'schedule_suggestion', 'application_deadline'
    related_application_id?: string | null;
    related_task_id?: string | null;
}

// --- OpenAI Client Initialization ---
let openai: OpenAI | null = null;
let isConfigured = false;

if (import.meta.env.VITE_OPENAI_API_KEY) {
  try {
      openai = new OpenAI({
        apiKey: import.meta.env.VITE_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true, // Ensure you understand the security implications
      });
      isConfigured = true;
      console.log("OpenAI client configured.");
  } catch (error) {
      console.error("Failed to initialize OpenAI client:", error);
  }
} else {
  console.warn("VITE_OPENAI_API_KEY not found. OpenAI features will be disabled.");
}

// Helper function to check configuration status
const isOpenAIConfigured = () => {
  return isConfigured && openai !== null;
};


// --- generateSmartReminders ---
// Saves events directly to DB, returns void
export async function generateSmartReminders(date: Date, applications: any[], companies: any[]): Promise<void> {
  if (!isOpenAIConfigured() || !openai) {
    console.warn("OpenAI not configured. Cannot generate smart reminders.");
    return;
  }

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    console.error("User not logged in for smart reminders.");
    return;
  }
  const userId = authData.user.id;

  try {
    const formattedDate = format(date, 'yyyy-MM-dd');
    const appContext = applications.slice(0, 5).map(app => ({ id: app.id, position: app.position, next_follow_up: app.next_follow_up, company_name: app.companies?.name }));
    const companyContext = companies.slice(0, 5).map(c => ({ id: c.id, name: c.name }));

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an AI assistant specializing in job search optimization. Create 2-3 clear, actionable calendar event reminders for the user ONLY for the date ${formattedDate}.
          Base reminders on their recent activity:
          - Applications (context provided): Consider upcoming follow-ups or application deadlines. If a reminder relates directly to ONE application, include its 'application_id'.
          - Target Companies (context provided): Suggest research or networking actions related to these.
          - General Tasks: Suggest tasks like 'Prepare for interviews' or 'Update resume'.
          Output MUST be a valid JSON object containing a single key "tasks", which is an array of event objects.
          Each event object MUST have: "title" (string, concise, no company names), "date" (string, MUST be "${formattedDate}"), "type" (string, e.g., 'follow_up', 'research', 'preparation', 'networking'), and "description" (string, brief action).
          Optionally include: "related_application_id" (string, if directly related to one application from context) or "related_task_id" (string, if related to an existing task - context not provided here, so likely null).
          Example event object: {"title": "Follow up on [Position Type] application", "date": "${formattedDate}", "type": "follow_up", "description": "Send polite follow-up email.", "related_application_id": "uuid-goes-here-or-null"}
          DO NOT generate tasks for dates other than ${formattedDate}. Ensure the "tasks" array is inside a parent JSON object.`
        },
        {
          role: "user",
          content: `Generate JSON tasks for ${formattedDate}. Context:
          Applications: ${JSON.stringify(appContext)}
          Target Companies: ${JSON.stringify(companyContext)}`
        }
      ],
      temperature: 0.6,
      max_tokens: 600,
    });

    let aiResponseData: { tasks: AIEventData[] } = { tasks: [] };
    try {
      if (response.choices[0]?.message?.content) {
        aiResponseData = JSON.parse(response.choices[0].message.content);
        if (!aiResponseData || !Array.isArray(aiResponseData.tasks)) {
            console.warn("AI response 'tasks' field is not a valid array:", aiResponseData?.tasks);
            aiResponseData.tasks = [];
        }
      }
    } catch (parseError) {
      console.error("Error parsing AI JSON response for reminders:", parseError);
      console.error("Raw AI response:", response.choices[0]?.message?.content);
      return;
    }

    const eventsToSave = aiResponseData.tasks
     .filter(task => task.date === formattedDate && task.title) // Ensure date matches and title exists
     .map((task: AIEventData) => ({
        user_id: userId,
        title: task.title,
        description: task.description || '',
        event_date: task.date,
        event_type: task.type || 'ai_generated',
        completed: false,
        related_application_id: task.related_application_id || null,
        related_task_id: task.related_task_id || null,
     }));

    if (eventsToSave.length > 0) {
      const { error: upsertError } = await supabase
        .from('calendar_events')
        .upsert(eventsToSave, {
          onConflict: 'user_id,title,event_date',
        });

      if (upsertError) {
        console.error("Error upserting AI reminders into calendar_events:", upsertError);
      } else {
        console.log(`Successfully upserted ${eventsToSave.length} AI reminders.`);
      }
    } else {
        console.log("AI generated no valid tasks for the specified date.");
    }

  } catch (error: any) {
    console.error('Error in generateSmartReminders:', error);
     if (error instanceof OpenAI.APIError) {
        console.error(`OpenAI API Error: ${error.status} ${error.name} ${error.message}`);
    }
  }
}


// --- generateJobHuntingSchedule ---
// Generates events for the week and saves them, returns void
export async function generateJobHuntingSchedule(applications: any[], companies: any[]): Promise<void> {
    if (!isOpenAIConfigured() || !openai) {
        console.warn("OpenAI not configured. Cannot generate schedule.");
        return;
    }

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
        console.error("User not logged in for schedule generation.");
        return;
    }
    const userId = authData.user.id;

    try {
        const today = new Date();
        const startOfThisWeek = startOfWeek(today, { weekStartsOn: 1 }); // Monday
        const scheduleDates = Array.from({ length: 5 }).map((_, i) =>
            format(addDays(startOfThisWeek, i), 'yyyy-MM-dd')
        );
        const dateRangeStr = `${scheduleDates[0]} to ${scheduleDates[scheduleDates.length - 1]}`;

        const appContext = applications.slice(0, 10).map(app => ({ id: app.id, position: app.position, next_follow_up: app.next_follow_up, company_name: app.companies?.name }));
        const companyContext = companies.slice(0, 10).map(c => ({ id: c.id, name: c.name }));

        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            response_format: { type: "json_object" },
            messages: [
                 {
                    role: "system",
                    content: `You are an expert career coach. Create a structured job hunting schedule for the upcoming week (${dateRangeStr}) based on user context.
                    Generate a JSON object containing a single key "schedule_items", which is an array of event objects.
                    Each event object MUST have: "title" (string, specific action), "date" (string, 'YYYY-MM-DD' format, MUST be within ${dateRangeStr}), "type" (string, e.g., 'job_search', 'application', 'networking', 'preparation', 'follow_up'), and "description" (string, optional brief detail).
                    Optionally include "related_application_id" (string) if an action pertains to ONE specific application from the context.
                    Aim for a balanced schedule across the week (e.g., 1-3 meaningful tasks per day). Prioritize based on upcoming follow-ups.
                    Example item: {"title": "Search for new Data Analyst roles", "date": "${scheduleDates[0]}", "type": "job_search", "description": "Spend 1 hour on LinkedIn/Indeed."}
                    Example item: {"title": "Follow up on Senior Dev application", "date": "${scheduleDates[2]}", "type": "follow_up", "description": "Check status via email.", "related_application_id": "uuid-goes-here-or-null"}
                    Ensure output is valid JSON. The "schedule_items" array should be inside a parent JSON object.`
                },
                {
                    role: "user",
                    content: `Generate JSON schedule items for the week ${dateRangeStr}. Context:
                    Applications: ${JSON.stringify(appContext)}
                    Target Companies: ${JSON.stringify(companyContext)}`
                }
            ],
            temperature: 0.7,
            max_tokens: 1000,
        });

        let aiResponseData: { schedule_items: AIEventData[] } = { schedule_items: [] };
        try {
            if (response.choices[0]?.message?.content) {
                aiResponseData = JSON.parse(response.choices[0].message.content);
                 if (!aiResponseData || !Array.isArray(aiResponseData.schedule_items)) {
                    console.warn("AI response 'schedule_items' field is not a valid array:", aiResponseData?.schedule_items);
                    aiResponseData.schedule_items = [];
                }
            }
        } catch (parseError) {
            console.error("Error parsing AI JSON response for schedule:", parseError);
            console.error("Raw AI response:", response.choices[0]?.message?.content);
            return;
        }

        const eventsToSave = aiResponseData.schedule_items
            .filter(item => item.title && scheduleDates.includes(item.date)) // Ensure title exists and date is correct
            .map((item: AIEventData) => ({
                user_id: userId,
                title: item.title,
                description: item.description || '',
                event_date: item.date,
                event_type: item.type || 'schedule_suggestion',
                completed: false,
                related_application_id: item.related_application_id || null,
                related_task_id: null,
            }));

        if (eventsToSave.length > 0) {
            const { error: upsertError } = await supabase
                .from('calendar_events')
                .upsert(eventsToSave, {
                    onConflict: 'user_id,title,event_date',
                });

            if (upsertError) {
                console.error("Error upserting AI schedule into calendar_events:", upsertError);
            } else {
                 console.log(`Successfully upserted ${eventsToSave.length} AI schedule items.`);
            }
        } else {
            console.log("AI generated no valid schedule items for the specified week.");
        }

    } catch (error: any) {
        console.error('Error in generateJobHuntingSchedule:', error);
        if (error instanceof OpenAI.APIError) {
            console.error(`OpenAI API Error: ${error.status} ${error.name} ${error.message}`);
        }
    }
}


// --- suggestNetworkingActions ---
// Added back from previous version
export async function suggestNetworkingActions(applications: any[], companies: any[]) {
  if (!isOpenAIConfigured() || !openai) {
    console.warn("OpenAI not configured. Cannot suggest networking actions.");
    return "OpenAI API key not configured. Please add your API key to continue using AI features.";
  }

  try {
    const companyIndustries = [...new Set(companies.map((company: any) => company.industry).filter(Boolean))].join(', ') || 'various industries';
    const companyTypes = [...new Set(companies.map((company: any) => company.type).filter(Boolean))].join(', ') || 'various company types';
    const upcomingFollowUpsCount = applications.filter((app: any) => app.next_follow_up).length;

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo", // Using turbo for consistency
      messages: [
        {
          role: "system",
          content: "You are an expert networking and career development strategist. Create actionable networking suggestions without mentioning specific company names."
        },
        {
          role: "user",
          content: `Based on target companies (Industries: ${companyIndustries}; Types: ${companyTypes}) and the number of upcoming application follow-ups (${upcomingFollowUpsCount}), suggest practical networking actions:

1. Identify relevant online communities or forums focused on [${companyIndustries}].
2. Find virtual or local (if applicable, mention checking local listings) professional events/meetups related to [${companyIndustries}].
3. Suggest strategies for informational interviews targeting roles or company types like [${companyTypes}].
4. Provide sample LinkedIn connection request templates for professionals in [${companyIndustries}] or working at [${companyTypes}] companies.
5. Recommend 2-3 key professional organizations or associations relevant to [${companyIndustries}].

Format suggestions clearly using actionable bullet points or numbered lists.`
        }
      ]
    });

    return response.choices[0].message.content || "No suggestions generated.";

  } catch (error: any) {
    console.error('Error suggesting networking actions:', error);
     if (error instanceof OpenAI.APIError) {
        console.error(`OpenAI API Error: ${error.status} ${error.name} ${error.message}`);
        return `An error occurred while generating networking suggestions: ${error.message}. Please check your OpenAI configuration or try again later.`;
    }
    return "An unexpected error occurred while generating networking suggestions. Please try again later.";
  }
}


// --- Other AI functions (Keep or restore implementations as needed) ---

export async function generateWelcomeEmail(firstName: string): Promise<string | null> {
  if (!isOpenAIConfigured() || !openai) {
     console.warn("OpenAI not configured. Cannot generate welcome email.");
    return "Welcome to Job Hunt CRM! Configure OpenAI for AI features.";
  }
  try {
    // Keep existing implementation
    const response = await openai.chat.completions.create({
        model: "gpt-4-turbo", // Use a capable model
        messages: [
            { role: "system", content: "You are a friendly career assistant for a Job Hunt CRM." },
            { role: "user", content: `Write a short, warm welcome email for ${firstName}, briefly mentioning key features like application tracking, calendar, and tasks.` }
        ]
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error generating welcome email:", error);
    return `Welcome ${firstName}! Error generating personalized message.`;
  }
}

export async function generateWeeklyRecapEmail(stats: any, firstName: string): Promise<string | null> {
  if (!isOpenAIConfigured() || !openai) {
    console.warn("OpenAI not configured. Cannot generate weekly recap.");
    return "OpenAI API key not configured.";
  }
   try {
    // Keep existing implementation
     const response = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
             { role: "system", content: "You are a career coach. Write a concise, encouraging weekly recap HTML email based on provided stats." },
             { role: "user", content: `Generate HTML email recap for ${firstName}. Stats: Apps: ${stats.applications_count}, Interviews: ${JSON.stringify(stats.upcoming_interviews)}, Tasks Due: ${JSON.stringify(stats.tasks_due)}. Include summary, insights, suggestions, and motivation.` }
        ]
    });
    return response.choices[0].message.content;
   } catch (error) {
    console.error("Error generating weekly recap:", error);
    return "Error generating weekly recap.";
   }
}

export async function analyzeResume(resumeText: string): Promise<string> {
  if (!isOpenAIConfigured() || !openai) return "OpenAI API key not configured.";
  try {
     // Keep existing implementation
     const response = await openai.chat.completions.create({
         model: "gpt-4-turbo",
         messages: [
              { role: "system", content: "You are a resume analyst. Provide actionable feedback." },
              { role: "user", content: `Analyze this resume: ${resumeText}. Give feedback on: overall impression, strengths, improvements, ATS optimization.` }
         ]
     });
     return response.choices[0].message.content || "Could not analyze resume.";
  } catch (error) {
     console.error("Error analyzing resume:", error);
     return "Error analyzing resume.";
  }
}

export async function analyzeJobDescription(jobDescription: string): Promise<string> {
  if (!isOpenAIConfigured() || !openai) return "OpenAI API key not configured.";
  try {
     // Keep existing implementation
      const response = await openai.chat.completions.create({
         model: "gpt-4-turbo",
         messages: [
              { role: "system", content: "You are a job market analyst." },
              { role: "user", content: `Analyze this job description: ${jobDescription}. Provide: key requirements, skills, resume keywords, application tips, potential interview questions.` }
         ]
     });
     return response.choices[0].message.content || "Could not analyze job description.";
  } catch (error) {
    console.error("Error analyzing job description:", error);
    return "Error analyzing job description.";
  }
}

export async function getInterviewPrep(position: string, company: string): Promise<string> {
  if (!isOpenAIConfigured() || !openai) return "OpenAI API key not configured.";
   try {
      // Keep existing implementation
       const response = await openai.chat.completions.create({
         model: "gpt-4-turbo",
         messages: [
              { role: "system", content: "You are an interview coach." },
              { role: "user", content: `Provide interview prep for ${position} at ${company}. Include: common questions, company-specific questions, potential technical questions, questions to ask, tips.` }
         ]
     });
     return response.choices[0].message.content || "Could not generate interview prep.";
   } catch (error) {
    console.error("Error getting interview prep:", error);
    return "Error generating interview prep.";
   }
}