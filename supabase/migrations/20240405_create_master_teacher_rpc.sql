-- MASTER TEACHER DATA CONSOLIDATION (ROBUST)
-- Serves BOTH Dashboard and Reports in 1 Request.
-- Robust: Added LEFT JOIN and COALESCE fallback for student names.

CREATE OR REPLACE FUNCTION public.get_master_teacher_dashboard(p_teacher_id UUID, p_start_date TIMESTAMP DEFAULT '2000-01-01'::timestamp)
RETURNS JSON AS $$
DECLARE
    v_profile JSON;
    v_routines JSON;
    v_schedules JSON;
    v_bookings JSON;
    v_payments JSON;
BEGIN
    -- 1. Profile Data
    SELECT json_build_object(
        'id', id,
        'full_name', full_name,
        'stage_code', stage_code,
        'is_subscribed', is_subscribed,
        'avatar_url', avatar_url,
        'role', role
    ) INTO v_profile FROM public.profiles WHERE id = p_teacher_id;

    -- 2. Routines
    SELECT json_agg(r) INTO v_routines 
    FROM (
        SELECT * FROM public.routines WHERE teacher_id = p_teacher_id ORDER BY name ASC
    ) r;

    -- 3. Schedules (Joined with routines)
    SELECT json_agg(s) INTO v_schedules 
    FROM (
        SELECT sch.*, rout.name as routine_name, rout.duration_minutes
        FROM public.schedules sch
        JOIN public.routines rout ON sch.routine_id = rout.id
        WHERE sch.teacher_id = p_teacher_id
          AND sch.start_time >= p_start_date
        ORDER BY sch.start_time DESC
    ) s;

    -- 4. Bookings (Robust Join with student details)
    SELECT json_agg(b) INTO v_bookings 
    FROM (
        SELECT 
            bk.*, 
            COALESCE(prof.full_name, 'Unknown Student') as student_name,
            prof.avatar_url as student_avatar,
            COALESCE(prof.email, bk.student_id::text) as student_email,
            rout.name as routine_name
        FROM public.bookings bk
        LEFT JOIN public.profiles prof ON bk.student_id = prof.id
        JOIN public.schedules sch ON bk.schedule_id = sch.id
        JOIN public.routines rout ON sch.routine_id = rout.id
        WHERE sch.teacher_id = p_teacher_id 
          AND sch.start_time >= p_start_date
        ORDER BY bk.created_at DESC
    ) b;

    -- 5. Payments
    SELECT json_agg(p) INTO v_payments 
    FROM (
        SELECT amount, created_at, status, id, booking_id
        FROM public.payments 
        WHERE teacher_id = p_teacher_id 
          AND created_at >= p_start_date
        ORDER BY created_at DESC
    ) p;

    RETURN json_build_object(
        'profile', v_profile,
        'routines', COALESCE(v_routines, '[]'::json),
        'schedules', COALESCE(v_schedules, '[]'::json),
        'bookings', COALESCE(v_bookings, '[]'::json),
        'payments', COALESCE(v_payments, '[]'::json),
        'fetched_at', now()
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
