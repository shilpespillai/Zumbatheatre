-- Consolidated Reports RPC for Zumbatheatre
-- This function returns all data needed for the Teacher Reports page in a single JSON object.
-- This drastically improves performance and eliminates state-flickering loops.

CREATE OR REPLACE FUNCTION public.get_teacher_reports_v2(p_teacher_id UUID, p_start_date TIMESTAMP)
RETURNS JSON AS $$
DECLARE
    v_routines JSON;
    v_schedules JSON;
    v_bookings JSON;
    v_payments JSON;
BEGIN
    -- 1. Get Routines
    SELECT json_agg(r) INTO v_routines
    FROM (
        SELECT id, name 
        FROM public.routines 
        WHERE teacher_id = p_teacher_id
    ) r;

    -- 2. Get Schedules
    SELECT json_agg(s) INTO v_schedules
    FROM (
        SELECT id, routine_id, start_time, price, seats_taken, max_seats, status 
        FROM public.schedules 
        WHERE teacher_id = p_teacher_id 
          AND start_time >= p_start_date
    ) s;

    -- 3. Get Bookings (with joined profile and routine names)
    SELECT json_agg(b) INTO v_bookings
    FROM (
        SELECT 
            bk.*, 
            prof.full_name as student_name,
            rout.name as routine_name
        FROM public.bookings bk
        JOIN public.profiles prof ON bk.student_id = prof.id
        JOIN public.schedules sch ON bk.schedule_id = sch.id
        JOIN public.routines rout ON sch.routine_id = rout.id
        WHERE sch.teacher_id = p_teacher_id 
          AND sch.start_time >= p_start_date
    ) b;

    -- 4. Get Payments
    SELECT json_agg(p) INTO v_payments
    FROM (
        SELECT amount, created_at, status
        FROM public.payments 
        WHERE teacher_id = p_teacher_id 
          AND created_at >= p_start_date
    ) p;

    -- Return Consolidated Object
    RETURN json_build_object(
        'routines', COALESCE(v_routines, '[]'::json),
        'schedules', COALESCE(v_schedules, '[]'::json),
        'bookings', COALESCE(v_bookings, '[]'::json),
        'payments', COALESCE(v_payments, '[]'::json)
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
