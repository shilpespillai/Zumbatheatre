-- Fix for Royalty Booking and Student Cancellation Visibility
-- Full sequence: DROP -> SANITIZE -> ADD
DO $$ 
BEGIN
    -- 1. Drop existing constraints to avoid violations during update
    ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_method_check;
    ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

    -- 2. Sanitize data
    -- payment_method
    UPDATE public.bookings 
    SET payment_method = 'MANUAL' 
    WHERE payment_method NOT IN ('STRIPE', 'PAYPAL', 'MANUAL', 'CREDITS', 'LOYALTY_REWARD', 'BANK', 'CASH') 
       OR payment_method IS NULL;

    -- status
    UPDATE public.bookings 
    SET status = 'CONFIRMED' 
    WHERE status NOT IN ('CONFIRMED', 'CANCELLED', 'STUDENT CANCELLED')
       OR status IS NULL;

    -- 3. Add new robust constraints
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_payment_method_check 
    CHECK (payment_method IN ('STRIPE', 'PAYPAL', 'MANUAL', 'CREDITS', 'LOYALTY_REWARD', 'BANK', 'CASH'));

    ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check 
    CHECK (status IN ('CONFIRMED', 'CANCELLED', 'STUDENT CANCELLED'));
END $$;
