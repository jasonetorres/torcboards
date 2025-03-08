// Follow Deno and Edge Function conventions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'
import { format } from 'https://esm.sh/date-fns@3.3.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://torcboard.netlify.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check if this is a test request
    const url = new URL(req.url)
    const isTest = url.searchParams.get('test') === 'true'

    let email, first_name, stats
    
    if (isTest) {
      // Use test data
      email = url.searchParams.get('email')
      first_name = 'Test User'
      stats = {
        applications_count: 5,
        upcoming_interviews: [
          {
            position: 'Senior Developer',
            company_name: 'Tech Corp',
            event_date: format(new Date().setDate(new Date().getDate() + 2), 'yyyy-MM-dd')
          }
        ],
        tasks_due: [
          {
            title: 'Update Resume',
            due_date: format(new Date().setDate(new Date().getDate() + 1), 'yyyy-MM-dd')
          },
          {
            title: 'Follow up with recruiter',
            due_date: format(new Date().setDate(new Date().getDate() + 3), 'yyyy-MM-dd')
          }
        ]
      }
    } else {
      // Regular request - get data from request body
      const body = await req.json()
      email = body.email
      first_name = body.first_name
      stats = body.stats
    }

    if (!email) {
      throw new Error('Email is required')
    }

    // Create email content
    const emailContent = `
      <h2>Hi ${first_name}! 👋</h2>
      
      <h3>Your Job Search Weekly Recap</h3>
      
      <p>Here's what happened in your job search this week:</p>
      
      <h4>Applications</h4>
      <p>You submitted ${stats.applications_count || 0} new applications this week.</p>
      
      ${stats.upcoming_interviews && stats.upcoming_interviews.length > 0 ? `
        <h4>Upcoming Interviews</h4>
        <ul>
          ${stats.upcoming_interviews.map((interview: any) => `
            <li>${interview.position} at ${interview.company_name} on ${format(new Date(interview.event_date), 'MMM d, yyyy')}</li>
          `).join('')}
        </ul>
      ` : ''}
      
      ${stats.tasks_due && stats.tasks_due.length > 0 ? `
        <h4>Tasks Due This Week</h4>
        <ul>
          ${stats.tasks_due.map((task: any) => `
            <li>${task.title} (Due: ${format(new Date(task.due_date), 'MMM d')})</li>
          `).join('')}
        </ul>
      ` : ''}
      
      <p>Keep up the great work! 💪</p>
      
      <p>Best regards,<br>Your Job Hunt CRM</p>
    `;

    // Send email using Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    
    if (!RESEND_API_KEY) {
      throw new Error('Missing Resend API key')
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Job Hunt CRM <updates@jobhuntcrm.com>',
        to: email,
        subject: isTest ? '🧪 Test: Weekly Job Search Recap' : '🎯 Your Weekly Job Search Recap',
        html: emailContent,
      }),
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(`Failed to send email: ${JSON.stringify(error)}`)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})