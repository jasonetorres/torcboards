/*
  # Set up email notifications system

  1. New Tables
    - `email_preferences`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `weekly_recap` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `email_preferences` table
    - Add policy for authenticated users to manage their own preferences

  3. Functions
    - Add trigger for updated_at timestamp
*/

-- Create email preferences table if it doesn't exist
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS email_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    weekly_recap boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
EXCEPTION
  WHEN duplicate_table THEN
    NULL;
END $$;

-- Enable RLS
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists and create new one
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can manage their own email preferences" ON email_preferences;
  
  CREATE POLICY "Users can manage their own email preferences"
    ON email_preferences
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;

-- Create or replace updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at if it doesn't exist
DO $$ BEGIN
  CREATE TRIGGER update_email_preferences_updated_at
    BEFORE UPDATE ON email_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;