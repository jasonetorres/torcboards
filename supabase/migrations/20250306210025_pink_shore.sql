/*
  # Add Calendar Integration and AI Features

  1. New Tables
    - `calendar_events`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `title` (text)
      - `description` (text, nullable)
      - `event_date` (date)
      - `event_type` (text)
      - `application_id` (uuid, nullable, references applications)
      - `completed` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `calendar_events` table
    - Add policy for authenticated users to manage their own events
*/

-- Create calendar_events table if it doesn't exist
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  event_type text NOT NULL,
  application_id uuid REFERENCES applications(id),
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS if not already enabled
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can manage their own calendar events" ON calendar_events;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;

-- Create policy
CREATE POLICY "Users can manage their own calendar events"
  ON calendar_events
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS calendar_events_user_id_idx ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS calendar_events_date_idx ON calendar_events(event_date);

-- Create or replace the updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DO $$ 
BEGIN
  DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON calendar_events;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;

-- Create trigger
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();