// Follow Deno and Edge Function conventions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'
import OpenAI from 'https://esm.sh/openai@4.28.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get data from request
    const { email, first_name } = await req.json()

    if (!email || !first_name) {
      throw new Error('Email and first name are required')
    }

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY')
    })

    // Generate personalized welcome message
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
          content: `Write a welcome email for ${first_name} that includes:
1. Warm personal greeting
2. Brief introduction to the platform
3. Quick start steps (3-4 key actions)
4. Encouragement to explore AI-powered features
5. Invitation to reach out for help
6. Professional sign-off`
        }
      ]
    })

    const welcomeMessage = response.choices[0].message.content

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
        from: 'Job Hunt CRM <welcome@jobhuntcrm.com>',
        to: email,
        subject: `Welcome to Job Hunt CRM, ${first_name}! 🚀`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            ${welcomeMessage}
          </div>
        `,
      }),
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(`Failed to send email: ${JSON.stringify(error)}`)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400 
      }
    )
  }
})