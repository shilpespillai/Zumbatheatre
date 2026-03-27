-- 20240327_auto_deduct_credits.sql
-- SECURE SERVER-SIDE CREDIT DEDUCTION
-- Ensures credits are deducted regardless of frontend completion.

-- Function to deduct credits when a payment is successful
CREATE OR REPLACE FUNCTION public.deduct_student_credits()
RETURNS TRIGGER AS $$
BEGIN
    -- Only act on payments for bookings that used CREDITS and are SUCCEEDED
    IF (NEW.status = 'SUCCEEDED') THEN
        -- Check if the linked booking used CREDITS
        -- (Using a check on the bookings table via booking_id)
        IF EXISTS (
            SELECT 1 FROM public.bookings 
            WHERE id = NEW.booking_id 
            AND payment_method = 'CREDITS'
        ) THEN
            
            UPDATE public.credits
            SET balance = balance - NEW.amount,
                last_updated = now()
            WHERE student_id = NEW.student_id
            AND teacher_id = NEW.teacher_id;

            RAISE NOTICE 'Deducted % credits from student % for teacher %', NEW.amount, NEW.student_id, NEW.teacher_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute after a new payment is recorded
-- We use AFTER INSERT to ensure the payment record is safely stored first
DROP TRIGGER IF EXISTS tr_deduct_credits_on_payment ON public.payments;
CREATE TRIGGER tr_deduct_credits_on_payment
AFTER INSERT ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.deduct_student_credits();

-- Add index to speed up the trigger's lookup
CREATE INDEX IF NOT EXISTS idx_payments_status_student_teacher ON public.payments(status, student_id, teacher_id);
