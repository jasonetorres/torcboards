/*
  # Create calendar events table

  1. New Tables
    - `calendar_events`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `title` (text)
      - `description` (text)
      - `event_date` (date)
      - `event_type` (text) - e.g., 'follow_up', 'interview_prep', 'deadline'
      - `application_id` (uuid, references applications)
      - `completed` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `calendar_events` table
    - Add policies for authenticated users to manage their own events
*/

CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  event_type text NOT NULL,
  application_id uuid REFERENCES applications(id),
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own calendar events"
  ON calendar_events
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create an index for faster queries by date
CREATE INDEX calendar_events_date_idx ON calendar_events (event_date);

-- Create an index for user_id for faster filtering
CREATE INDEX calendar_events_user_id_idx ON calendar_events (user_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update the updated_at column
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();