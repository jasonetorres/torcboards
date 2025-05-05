import OpenAI from 'openai';
import { supabase } from './supabase';
import { format } from 'date-fns';

// Only initialize OpenAI if we have an API key
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

// Helper function to check if OpenAI is configured
const isOpenAIConfigured = () => {
  return !!import.meta.env.VITE_OPENAI_API_KEY;
};

export async function generateWelcomeEmail(firstName: string) {
  if (!isOpenAIConfigured()) {
    return "Welcome to Job Hunt CRM! We're here to help you succeed in your job search journey.";
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a friendly and professional career coach. Write a welcoming email that:
- Is personalized and warm
- Introduces key features of the Job Hunt CRM
- Provides quick start guidance
- Encourages engagement
- Maintains a supportive and optimistic tone`
        },
        {
          role: "user",
          content: `Write a welcome email for ${firstName} that includes:
1. Warm personal greeting
2. Brief introduction to the platform
3. Quick start steps (3-4 key actions)
4. Encouragement to explore AI-powered features
5. Invitation to reach out for help
6. Professional sign-off`
        }
      ]
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error generating welcome email:', error);
    return `Welcome to Job Hunt CRM, ${firstName}! We're excited to help you succeed in your job search journey.`;
  }
}

export async function generateWeeklyRecapEmail(stats: any, firstName: string) {
  if (!isOpenAIConfigured()) {
    return "OpenAI API key not configured. Please add your API key to continue using AI features.";
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an expert career coach and job search strategist. Write a personalized weekly recap email that is:
- Encouraging and supportive
- Action-oriented with specific next steps
- Professional but friendly in tone
- Focused on progress and growth
- Includes data-driven insights`
        },
        {
          role: "user",
          content: `Create a weekly recap email for ${firstName} with these stats:

Applications submitted this week: ${stats.applications_count}
Upcoming interviews: ${JSON.stringify(stats.upcoming_interviews)}
Tasks due this week: ${JSON.stringify(stats.tasks_due)}

Format the email in HTML with:
1. A personalized greeting
2. Summary of the week's activities
3. Analysis of progress
4. Actionable suggestions for next week
5. Motivational closing
`
        }
      ]
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error generating weekly recap:', error);
    return null;
  }
}

export async function analyzeResume(resumeText: string) {
  if (!isOpenAIConfigured()) {
    return "OpenAI API key not configured. Please add your API key to continue using AI features.";
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert resume analyst and career coach. Analyze the resume and provide actionable feedback."
        },
        {
          role: "user",
          content: `Please analyze this resume and provide feedback on: 
1. Overall impression
2. Key strengths
3. Areas for improvement
4. ATS optimization suggestions
5. Industry-specific recommendations

Resume:
${resumeText}`
        }
      ]
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error analyzing resume:', error);
    return "An error occurred while analyzing the resume. Please try again later.";
  }
}

export async function analyzeJobDescription(jobDescription: string) {
  if (!isOpenAIConfigured()) {
    return "OpenAI API key not configured. Please add your API key to continue using AI features.";
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert job market analyst. Analyze the job description and provide insights."
        },
        {
          role: "user",
          content: `Please analyze this job description and provide:
1. Key requirements and qualifications
2. Required skills and experience
3. Suggested resume keywords
4. Tips for application
5. Potential interview questions

Job Description:
${jobDescription}`
        }
      ]
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error analyzing job description:', error);
    return "An error occurred while analyzing the job description. Please try again later.";
  }
}

export async function getInterviewPrep(position: string, company: string) {
  if (!isOpenAIConfigured()) {
    return "OpenAI API key not configured. Please add your API key to continue using AI features.";
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert interview coach with deep knowledge of various industries."
        },
        {
          role: "user",
          content: `Please provide interview preparation guidance for:
Position: ${position}
Company: ${company}

Include:
1. Common interview questions
2. Company-specific questions
3. Technical questions if applicable
4. Questions to ask the interviewer
5. Tips for success`
        }
      ]
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error getting interview prep:', error);
    return "An error occurred while preparing interview guidance. Please try again later.";
  }
}

export async function generateJobHuntingSchedule(applications: any[], companies: any[]) {
  if (!isOpenAIConfigured()) {
    return "OpenAI API key not configured. Please add your API key to continue using AI features.";
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert career coach and job search strategist. Create a clear, actionable weekly schedule for job hunting activities. Focus on specific tasks and timing, avoiding any mention of company names or IDs."
        },
        {
          role: "user",
          content: `Based on the current applications and target companies, create a weekly schedule that includes:

1. Daily tasks and time blocks
2. Follow-up reminders
3. Research and preparation time
4. Application deadlines
5. Networking opportunities

Format the response in clear markdown with specific times and actions.`
        }
      ]
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error generating schedule:', error);
    return "An error occurred while generating the schedule. Please try again later.";
  }
}

export async function generateSmartReminders(date: Date, applications: any[], companies: any[]) {
  if (!isOpenAIConfigured()) {
    return "OpenAI API key not configured. Please add your API key to continue using AI features.";
  }

  try {
    const formattedDate = date.toISOString().split('T')[0];
    const companyNames = companies.map((company: any) => company.name).join(', ');
    const upcomingFollowUps = applications.filter((app: any) => app.next_follow_up && format(new Date(app.next_follow_up), 'yyyy-MM-dd') === formattedDate);

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant specializing in job search optimization. Create clear, actionable reminders that:
- Focus on specific actions and dates
- The date for all reminders should be ONLY ${formattedDate}
- Limit the total number of tasks generated for this day to a maximum of 2 or 3
- Prioritize tasks based on upcoming follow-ups from your applications: ${upcomingFollowUps.map((app: any) => app.position).join(', ') || 'No follow-ups today'} and research on your target companies: ${companyNames || 'No target companies specified'}
- Never mention company names or IDs directly in the task titles
- Use clear, concise language
- Format output in JSON for easy parsing with "type", "title", "date" (YYYY-MM-DD), and "description" keys in the "tasks" array
- Include only relevant, actionable items for the specific date`
        },
        {
          role: "user",
          content: `Generate reminders in this JSON format:
{
  "tasks": [
    {
      "type": "follow_up",
      "title": "Follow up on a specific application",
      "date": "${formattedDate}",
      "description": "Send a follow-up email."
    },
    {
      "type": "research",
      "title": "Research a target company",
      "date": "${formattedDate}",
      "description": "Learn more about their recent activities."
    }
  ]
}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    const jsonResponse = JSON.parse(response.choices[0].message.content || '{"tasks": []}');
    
    // Create calendar events for each task
    if (jsonResponse.tasks && jsonResponse.tasks.length > 0) {
      const user = (await supabase.auth.getUser()).data.user;
      if (user) {
        const events = jsonResponse.tasks.slice(0, 3).map((task: any) => ({
          user_id: user.id,
          title: task.title,
          description: task.description,
          event_date: task.date,
          event_type: task.type,
          completed: false
        }));

        await supabase
          .from('calendar_events')
          .upsert(events, { 
            onConflict: 'user_id,title,event_date',
            ignoreDuplicates: true 
          });
      }
    }

    // Convert JSON to markdown format for display
    let markdown = `# Job Search Tasks for ${formattedDate}\n\n`;
    
    const tasksByType = jsonResponse.tasks.reduce((acc: any, task: any) => {
      if (!acc[task.type]) acc[task.type] = [];
      acc[task.type].push(task);
      return acc;
    }, {});

    const sectionTitles: { [key: string]: string } = {
      follow_up: 'Follow-ups',
      interview_prep: 'Interviews',
      research: 'Research',
      status_check: 'Status Checks',
      deadline: 'Deadlines'
    };

    Object.entries(tasksByType).forEach(([type, tasks]: [string, any]) => {
      const title = sectionTitles[type] || type.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      
      markdown += `## ${title}\n`;
      (tasks as any[]).forEach((task: any) => {
        markdown += `- ${task.title}\n`;
        if (task.description) {
          markdown += `  - ${task.description}\n`;
        }
      });
      markdown += '\n';
    });

    return markdown;
  } catch (error) {
    console.error('Error generating reminders:', error);
    return "An error occurred while generating reminders. Please try again later.";
  }
}

export async function suggestNetworkingActions(applications: any[], companies: any[]) {
  if (!isOpenAIConfigured()) {
    return "OpenAI API key not configured. Please add your API key to continue using AI features.";
  }

  try {
    const companyIndustries = [...new Set(companies.map((company: any) => company.industry).filter(Boolean))].join(', ');
    const companyTypes = [...new Set(companies.map((company: any) => company.type).filter(Boolean))].join(', ');
    const upcomingFollowUps = applications.filter((app: any) => app.next_follow_up).length;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert networking and career development strategist. Create actionable networking suggestions without mentioning specific company names."
        },
        {
          role: "user",
          content: `Based on the target companies (industries: ${companyIndustries}, types: ${companyTypes}) and the number of upcoming follow-ups (${upcomingFollowUps}), suggest networking actions:

1. Industry-specific networking opportunities
2. Professional events and meetups related to these industries
3. Informational interview strategies focusing on these types of companies
4. LinkedIn connection approaches targeting professionals in these industries or at these types of companies
5. Professional organization recommendations relevant to these industries

Format suggestions in clear, actionable bullet points.`
        }
      ]
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error suggesting networking actions:', error);
    return "An error occurred while generating networking suggestions. Please try again later.";
  }
}