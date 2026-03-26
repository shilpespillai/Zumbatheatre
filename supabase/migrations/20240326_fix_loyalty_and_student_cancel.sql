-- Fix for Booking Failures (PayPal, Cash, Bank, Royalty)
-- Dynamically clears ALL conflicting constraints to ensure a successful update.
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- 1. DYNAMICALLY DROP ALL CHECK CONSTRAINTS on bookings (status and payment_method)
    FOR r IN (
        SELECT conname 
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public' 
          AND rel.relname = 'bookings' 
          AND contype = 'c'
          AND (conname LIKE '%status%' OR conname LIKE '%payment_method%')
    ) LOOP
        EXECUTE 'ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname) || ' CASCADE';
    END LOOP;

    -- 2. SANITIZE DATA
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

    -- payment_status
    UPDATE public.bookings 
    SET payment_status = 'PENDING' 
    WHERE payment_status NOT IN ('PENDING', 'PAID', 'VOID', 'REFUNDED', 'CANCELLED')
       OR payment_status IS NULL;

    -- 3. ADD CLEAN UNIFIED CONSTRAINTS
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_payment_method_check 
    CHECK (payment_method IN ('STRIPE', 'PAYPAL', 'MANUAL', 'CREDITS', 'LOYALTY_REWARD', 'BANK', 'CASH'));

    ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check 
    CHECK (status IN ('CONFIRMED', 'CANCELLED', 'STUDENT CANCELLED'));

    ALTER TABLE public.bookings ADD CONSTRAINT bookings_payment_status_check 
    CHECK (payment_status IN ('PENDING', 'PAID', 'VOID', 'REFUNDED', 'CANCELLED'));

END $$;
