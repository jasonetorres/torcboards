/*
  # Add Contact Information to Companies

  1. Changes
    - Add `contact_name` column to companies table
    - Add `contact_email` column to companies table
    - Add `contact_phone` column to companies table
    - Add `contact_role` column to companies table

  2. Notes
    - All contact fields are optional
    - Existing records will have NULL values for new columns
*/

DO $$ 
BEGIN
  -- Add contact_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'contact_name'
  ) THEN
    ALTER TABLE companies ADD COLUMN contact_name text;
  END IF;

  -- Add contact_email column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'contact_email'
  ) THEN
    ALTER TABLE companies ADD COLUMN contact_email text;
  END IF;

  -- Add contact_phone column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'contact_phone'
  ) THEN
    ALTER TABLE companies ADD COLUMN contact_phone text;
  END IF;

  -- Add contact_role column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'contact_role'
  ) THEN
    ALTER TABLE companies ADD COLUMN contact_role text;
  END IF;
END $$;