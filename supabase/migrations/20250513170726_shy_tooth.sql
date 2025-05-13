/*
  # Create dashboard layouts table

  1. New Tables
    - `dashboard_layouts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `widgets` (jsonb, stores widget configuration)
      - `created_at` (timestamp with timezone)
      - `updated_at` (timestamp with timezone)

  2. Security
    - Enable RLS on `dashboard_layouts` table
    - Add policies for authenticated users to:
      - Read their own dashboard layout
      - Create their own dashboard layout
      - Update their own dashboard layout
      - Delete their own dashboard layout
*/

CREATE TABLE IF NOT EXISTS public.dashboard_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  widgets jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own dashboard layout"
  ON public.dashboard_layouts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own dashboard layout"
  ON public.dashboard_layouts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dashboard layout"
  ON public.dashboard_layouts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dashboard layout"
  ON public.dashboard_layouts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dashboard_layouts_updated_at
  BEFORE UPDATE ON public.dashboard_layouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();