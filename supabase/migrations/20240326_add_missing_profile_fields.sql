-- Fix: Add missing profile fields that was breaking the Settings page persistence
-- These fields (phone, bio) were being sent by the frontend but didn't exist in the database table.

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add comment for visibility
COMMENT ON COLUMN public.profiles.phone IS 'Teacher or Student contact phone number';
COMMENT ON COLUMN public.profiles.bio IS 'Teacher biography or Student details';

-- Ensure RLS allows updating these specific new columns
-- (Existing update policy covers all columns, but good to verify)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can update their own profile'
    ) THEN
        CREATE POLICY "Users can update their own profile" ON public.profiles
            FOR UPDATE USING (auth.uid() = id);
    END IF;
END $$;
