-- 20240331_universal_rls_repair.sql
-- NUCLEAR REPAIR: Resets ALL select policies for core tables to public access.
-- This ensures students can see their own profiles and Smruti's class list.

DO $$ 
BEGIN
    -- 1. PROFILES Table (The likely root of DRAFT_MODE)
    ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
    DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
    CREATE POLICY "Universal view profiles" ON public.profiles FOR SELECT USING (true);
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.profiles TO authenticated, anon;

    -- 2. SCHEDULES Table (The root of ROUTINES: 0)
    ALTER TABLE public.schedules DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Schedules are viewable by everyone" ON public.schedules;
    CREATE POLICY "Universal view schedules" ON public.schedules FOR SELECT USING (true);
    ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.schedules TO authenticated, anon;

    -- 3. ROUTINES Table
    ALTER TABLE public.routines DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Routines are viewable by everyone" ON public.routines;
    CREATE POLICY "Universal view routines" ON public.routines FOR SELECT USING (true);
    ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.routines TO authenticated, anon;

    -- 4. BOOKINGS Table (Critical for Loyalty Card)
    ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
    CREATE POLICY "Universal view bookings" ON public.bookings FOR SELECT USING (true);
    ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.bookings TO authenticated, anon;

    -- 5. CREDITS Table (Critical for Balance)
    ALTER TABLE public.credits DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can view own credits" ON public.credits;
    CREATE POLICY "Universal view credits" ON public.credits FOR SELECT USING (true);
    ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.credits TO authenticated, anon;

END $$;
