-- Add student payment confirmation fields to bookings
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS payment_confirmed_by_student BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN public.bookings.payment_confirmed_by_student IS 'Flag set by student to notify teacher that manual/bank payment has been sent.';
