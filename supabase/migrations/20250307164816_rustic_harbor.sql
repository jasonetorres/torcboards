/*
  # Add email preferences and weekly recap functionality

  1. New Tables
    - `email_preferences`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `weekly_recap` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
  2. Security
    - Enable RLS on email_preferences table
    - Add policy for users to manage their preferences
    
  3. Functions
    - Add function to generate and send weekly recap emails
*/

-- Create email preferences table
CREATE TABLE IF NOT EXISTS email_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  weekly_recap boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can manage their own email preferences"
  ON email_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $update_updated_at$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$update_updated_at$ LANGUAGE plpgsql;

-- Add updated_at trigger
CREATE TRIGGER update_email_preferences_updated_at
  BEFORE UPDATE ON email_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to send weekly recap emails
CREATE OR REPLACE FUNCTION send_weekly_recap()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $send_weekly_recap$
DECLARE
  user_record RECORD;
  weekly_stats JSONB;
BEGIN
  -- Loop through users who have enabled weekly recaps
  FOR user_record IN 
    SELECT 
      u.id,
      u.email,
      u.raw_user_meta_data->>'first_name' as first_name
    FROM auth.users u
    JOIN email_preferences ep ON ep.user_id = u.id
    WHERE ep.weekly_recap = true
  LOOP
    -- Gather weekly statistics
    SELECT jsonb_build_object(
      'applications_count', (
        SELECT COUNT(*)
        FROM applications a
        WHERE a.user_id = user_record.id
        AND a.created_at >= NOW() - INTERVAL '7 days'
      ),
      'upcoming_interviews', (
        SELECT jsonb_agg(jsonb_build_object(
          'position', a.position,
          'company_name', c.name,
          'event_date', ce.event_date
        ))
        FROM calendar_events ce
        JOIN applications a ON a.id = ce.application_id
        JOIN companies c ON c.id = a.company_id
        WHERE ce.user_id = user_record.id
        AND ce.event_type = 'interview'
        AND ce.event_date >= CURRENT_DATE
        AND ce.event_date <= CURRENT_DATE + INTERVAL '7 days'
      ),
      'tasks_due', (
        SELECT jsonb_agg(jsonb_build_object(
          'title', title,
          'due_date', due_date
        ))
        FROM tasks
        WHERE user_id = user_record.id
        AND due_date >= CURRENT_DATE
        AND due_date <= CURRENT_DATE + INTERVAL '7 days'
        AND status != 'completed'
      )
    ) INTO weekly_stats;

    -- Send email using Supabase Edge Functions
    PERFORM net.http_post(
      url := 'https://ssdsqxzaopizyvwrankv.supabase.co/functions/v1/send-weekly-recap',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', current_setting('request.headers')::json->>'authorization'
      ),
      body := jsonb_build_object(
        'email', user_record.email,
        'first_name', user_record.first_name,
        'stats', weekly_stats
      )
    );
  END LOOP;
END;
$send_weekly_recap$;