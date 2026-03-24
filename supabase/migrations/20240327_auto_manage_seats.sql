-- FIX: Auto-manage seats_taken on schedules
-- This ensures that booking/cancelling a session correctly updates the availability counter

CREATE OR REPLACE FUNCTION public.update_schedule_seats()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        -- Only increment for active bookings
        IF (NEW.payment_status IN ('PAID', 'PENDING')) THEN
            UPDATE public.schedules 
            SET seats_taken = seats_taken + 1 
            WHERE id = NEW.schedule_id;
        END IF;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Handle status changes (e.g., PENDING -> VOID, or PENDING -> PAID)
        -- Increment if becoming active
        IF (OLD.payment_status NOT IN ('PAID', 'PENDING') AND NEW.payment_status IN ('PAID', 'PENDING')) THEN
            UPDATE public.schedules 
            SET seats_taken = seats_taken + 1 
            WHERE id = NEW.schedule_id;
        -- Decrement if leaving active
        ELSIF (OLD.payment_status IN ('PAID', 'PENDING') AND NEW.payment_status NOT IN ('PAID', 'PENDING')) THEN
            UPDATE public.schedules 
            SET seats_taken = GREATEST(0, seats_taken - 1) 
            WHERE id = NEW.schedule_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF (OLD.payment_status IN ('PAID', 'PENDING')) THEN
            UPDATE public.schedules 
            SET seats_taken = GREATEST(0, seats_taken - 1) 
            WHERE id = OLD.schedule_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_update_seats ON public.bookings;
CREATE TRIGGER tr_update_seats
AFTER INSERT OR UPDATE OR DELETE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.update_schedule_seats();

-- 2. Recalculate existing seats_taken to be accurate
UPDATE public.schedules s
SET seats_taken = (
    SELECT count(*) 
    FROM public.bookings b 
    WHERE b.schedule_id = s.id 
    AND b.payment_status IN ('PAID', 'PENDING')
);
