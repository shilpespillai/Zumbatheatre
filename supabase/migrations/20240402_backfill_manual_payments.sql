-- BACKFILL: Create missing payment records for manual PAID bookings
-- This ensures historical revenue shows up in reports.

INSERT INTO public.payments (booking_id, student_id, teacher_id, amount, status, created_at)
SELECT 
    b.id as booking_id,
    b.student_id,
    s.teacher_id,
    s.price as amount,
    'SUCCEEDED' as status,
    b.updated_at as created_at
FROM 
    public.bookings b
JOIN 
    public.schedules s ON b.schedule_id = s.id
LEFT JOIN 
    public.payments p ON b.id = p.booking_id
WHERE 
    b.payment_status = 'PAID'
    AND p.id IS NULL;
