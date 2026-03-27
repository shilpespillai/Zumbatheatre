-- 20240331_force_open_rls.sql
-- AGGRESSIVE REPAIR: Restores public SELECT access to core tables
-- This fixes the empty dashboard issue where students couldn't see schedules or routines.

DO $$ 
BEGIN
    -- 1. REPAIR SCHEDULES
    DROP POLICY IF EXISTS "Schedules are viewable by everyone" ON public.schedules;
    CREATE POLICY "Schedules are viewable by everyone" ON public.schedules 
        FOR SELECT USING (true);
    
    -- Ensure RLS is enabled
    ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

    -- 2. REPAIR ROUTINES
    DROP POLICY IF EXISTS "Routines are viewable by everyone" ON public.routines;
    CREATE POLICY "Routines are viewable by everyone" ON public.routines 
        FOR SELECT USING (true);
    
    -- Ensure RLS is enabled
    ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

    -- 3. REPAIR PROFILES (Teachers must be visible to students)
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
    CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles 
        FOR SELECT USING (true);
        
    -- Ensure RLS is enabled
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

END $$;
