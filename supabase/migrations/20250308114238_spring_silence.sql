/*
  # Add resumes table

  1. New Tables
    - `resumes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `content` (text)
      - `target_role` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `resumes` table
    - Add policy for authenticated users to manage their own resumes
*/

-- Create resumes table if it doesn't exist
CREATE TABLE IF NOT EXISTS resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text,
  target_role text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

-- Create policy if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'resumes' 
    AND policyname = 'Users can manage their own resumes'
  ) THEN
    CREATE POLICY "Users can manage their own resumes"
      ON resumes
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Add trigger for updating updated_at if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_resumes_updated_at'
  ) THEN
    CREATE TRIGGER update_resumes_updated_at
      BEFORE UPDATE ON resumes
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;