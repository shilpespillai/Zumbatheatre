-- 20240327_teacher_management_rls.sql
-- Fixes Teacher's ability to confirm payments and cancel sessions (issue refunds)

-- 1. Add status column to bookings if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.bookings'::regclass AND attname = 'status') THEN
        ALTER TABLE public.bookings ADD COLUMN status TEXT DEFAULT 'BOOKED' CHECK (status IN ('BOOKED', 'CANCELLED', 'NOSHOW'));
    END IF;
END $$;

-- 2. Update existing bookings to 'BOOKED' if status was null
UPDATE public.bookings SET status = 'BOOKED' WHERE status IS NULL;

-- 3. Grant UPDATE permissions to Teachers on Bookings
-- This allows instructors to Mark as Paid and Cancel individual student bookings for their classes
DROP POLICY IF EXISTS "Teachers can update bookings for their schedules" ON public.bookings;
CREATE POLICY "Teachers can update bookings for their schedules" ON public.bookings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.schedules 
            WHERE schedules.id = bookings.schedule_id 
            AND schedules.teacher_id = auth.uid()
        )
    );

-- 4. Grant MANAGE permissions to Teachers on Credits
-- This allows instructors to issue refunds/credits during cancellation
DROP POLICY IF EXISTS "Teachers can manage credits issued to their students" ON public.credits;
CREATE POLICY "Teachers can manage credits issued to their students" ON public.credits
    FOR ALL USING (auth.uid() = teacher_id);

-- 5. Allow Students to update their own bookings (for cancellation)
DROP POLICY IF EXISTS "Students can update their own bookings" ON public.bookings;
CREATE POLICY "Students can update their own bookings" ON public.bookings
    FOR UPDATE USING (auth.uid() = student_id);
