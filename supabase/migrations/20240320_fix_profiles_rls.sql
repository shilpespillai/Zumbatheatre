-- Fix: Add INSERT policy for profiles and add missing bio column
-- This is critical for allowing new users to complete onboarding.

DO $$ 
BEGIN
    -- 1. Add bio column to profiles if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='bio') THEN
        ALTER TABLE public.profiles ADD COLUMN bio TEXT;
    END IF;

    -- 2. Add INSERT policy for profiles
    -- This allows authenticated users to create their own profile row.
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can insert their own profile'
    ) THEN
        CREATE POLICY "Users can insert their own profile" ON public.profiles
            FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;

    -- 3. Ensure invite_code for teachers is handled
    -- (This was in the original schema but let's be sure)
END $$;
