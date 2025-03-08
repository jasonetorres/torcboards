/*
  # Add AI Analysis Storage

  1. New Tables
    - `ai_analyses`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `type` (text) - Type of analysis (resume, job, interview)
      - `input` (text) - Original input text
      - `result` (text) - Analysis result
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `ai_analyses` table
    - Add policy for authenticated users to manage their own analyses
*/

CREATE TABLE IF NOT EXISTS ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  type text NOT NULL,
  input text NOT NULL,
  result text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own analyses"
  ON ai_analyses
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX ai_analyses_user_id_idx ON ai_analyses(user_id);
CREATE INDEX ai_analyses_type_idx ON ai_analyses(type);