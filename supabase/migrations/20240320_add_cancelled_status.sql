-- Add 'CANCELLED' to the payment_status check constraint in bookings table
DO $$
BEGIN
    -- 1. Drop existing constraint
    ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;

    -- 2. Add updated constraint including CANCELLED
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_payment_status_check 
    CHECK (payment_status IN ('PENDING', 'PAID', 'VOID', 'REFUNDED', 'CANCELLED'));

END $$;
