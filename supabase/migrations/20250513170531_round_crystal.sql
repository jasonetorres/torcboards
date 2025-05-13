/*
  # Add dashboard layouts table

  1. New Tables
    - `dashboard_layouts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `widgets` (jsonb)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on dashboard_layouts table
    - Add policy for authenticated users
*/

CREATE TABLE dashboard_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  widgets jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own dashboard layout"
  ON dashboard_layouts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add trigger for updating updated_at
CREATE TRIGGER update_dashboard_layouts_updated_at
  BEFORE UPDATE ON dashboard_layouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();