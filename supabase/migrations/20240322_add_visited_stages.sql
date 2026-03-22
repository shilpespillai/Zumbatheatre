-- 20240322_add_visited_stages.sql
-- ADD visited_stages COLUMN TO PROFILES
-- This allows students to track and quickly switch between multiple teachers.

BEGIN;

-- Add the column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='visited_stages') THEN
        ALTER TABLE public.profiles ADD COLUMN visited_stages JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

COMMIT;
