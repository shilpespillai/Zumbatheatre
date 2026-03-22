-- RELAX PROFILE CONSTRAINT FOR GUEST PERSISTENCE
-- This allows us to store 'Guest' profiles in the database for students who haven't signed up yet.

BEGIN;

-- 1. Remove the foreign key constraint that forces profile.id to be in auth.users
-- This allows our 'stable guest UUIDs' to be stored in the profiles table.
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. Add a CHECK to ensure a role is set
ALTER TABLE public.profiles
ALTER COLUMN role SET NOT NULL;

COMMIT;
