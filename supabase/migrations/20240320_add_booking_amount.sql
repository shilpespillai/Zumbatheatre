-- Migration: Add amount column to bookings table 
-- Essential for tracking the price paid at the time of booking, independently of subsequent schedule price changes.

DO $$ 
BEGIN
    -- 1. Add amount column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='amount') THEN
        ALTER TABLE public.bookings ADD COLUMN amount NUMERIC(10, 2);
    END IF;

    -- 2. Backfill amount from schedules table for existing bookings (if any)
    UPDATE public.bookings b
    SET amount = s.price
    FROM public.schedules s
    WHERE b.schedule_id = s.id AND b.amount IS NULL;

    -- 3. Make amount NOT NULL (after backfill)
    -- Optional: If you want to force it for new rows
    -- ALTER TABLE public.bookings ALTER COLUMN amount SET NOT NULL;

    -- 4. Add check constraint to ensure amount is non-negative
    BEGIN
        ALTER TABLE public.bookings ADD CONSTRAINT bookings_amount_check CHECK (amount >= 0);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

END $$;
