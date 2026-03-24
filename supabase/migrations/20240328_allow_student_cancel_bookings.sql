-- 20240328_allow_student_cancel_bookings.sql
-- Grants UPDATE permissions to students on their own bookings
-- This is required for self-cancellation/voiding spots

DROP POLICY IF EXISTS "Students can update their own bookings" ON public.bookings;

CREATE POLICY "Students can update their own bookings" ON public.bookings
    FOR UPDATE 
    USING (auth.uid() = student_id)
    WITH CHECK (auth.uid() = student_id);
