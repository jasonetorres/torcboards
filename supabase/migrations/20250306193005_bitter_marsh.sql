/*
  # Initial Schema Setup for JobHunt CRM

  1. New Tables
    - `companies` - Target companies to apply to
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `website` (text)
      - `notes` (text)
      - `status` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `applications` - Job applications tracking
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `company_id` (uuid, references companies)
      - `position` (text)
      - `status` (text)
      - `applied_date` (date)
      - `notes` (text)
      - `next_follow_up` (date)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `pomodoro_sessions` - Track study/prep sessions
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `start_time` (timestamp)
      - `duration` (integer)
      - `task` (text)
      - `completed` (boolean)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Companies table
CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  website text,
  notes text,
  status text NOT NULL DEFAULT 'interested',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own companies"
  ON companies
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Applications table
CREATE TABLE applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  company_id uuid REFERENCES companies NOT NULL,
  position text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  applied_date date,
  notes text,
  next_follow_up date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own applications"
  ON applications
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Pomodoro sessions table
CREATE TABLE pomodoro_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  start_time timestamptz NOT NULL DEFAULT now(),
  duration integer NOT NULL,
  task text,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pomodoro_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own pomodoro sessions"
  ON pomodoro_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);