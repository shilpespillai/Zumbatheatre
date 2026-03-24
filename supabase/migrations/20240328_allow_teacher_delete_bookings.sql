-- 20240328_allow_teacher_delete_bookings.sql
-- Grants DELETE permissions to instructors on their own bookings
-- This is used for "flushing" the student list during session re-activation

DROP POLICY IF EXISTS "Teachers can delete bookings for their schedules" ON public.bookings;
CREATE POLICY "Teachers can delete bookings for their schedules" ON public.bookings
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.schedules 
            WHERE schedules.id = bookings.schedule_id 
            AND schedules.teacher_id = auth.uid()
        )
    );
