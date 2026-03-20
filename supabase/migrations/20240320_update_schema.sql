-- 1. Update Bookings table with status field and expanded payment_status options
DO $$ 
BEGIN
    -- Add status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='status') THEN
        ALTER TABLE public.bookings ADD COLUMN status TEXT DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'CANCELLED'));
    END IF;

    -- Drop old payment_status constraint and add expanded one
    -- Note: constraint name might vary, but in production_schema.sql it's unnamed in CREATE TABLE. 
    -- We'll try to drop by finding it or just adding a new one.
    BEGIN
        ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
    
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_payment_status_check 
    CHECK (payment_status IN ('PENDING', 'PAID', 'VOID', 'REFUNDED', 'CANCELLED'));
END $$;

-- 2. Ensure Credits Table is correctly set up with the specific fields the code uses
-- The production_schema already has it, but we ensure the trigger for updated_at is there
CREATE OR REPLACE FUNCTION public.handle_credit_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = now(); -- Production uses last_updated
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_credits_timestamp ON public.credits;
CREATE TRIGGER update_credits_timestamp
BEFORE UPDATE ON public.credits
FOR EACH ROW
EXECUTE FUNCTION public.handle_credit_update();

-- 3. Add Index for booking status for performance
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
