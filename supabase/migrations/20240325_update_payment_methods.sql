-- Update payment_method constraint to include CASH and BANK
ALTER TABLE public.bookings 
DROP CONSTRAINT IF EXISTS bookings_payment_method_check;

ALTER TABLE public.bookings 
ADD CONSTRAINT bookings_payment_method_check 
CHECK (payment_method IN ('STRIPE', 'PAYPAL', 'MANUAL', 'CREDITS', 'CASH', 'BANK'));

-- Add comment
COMMENT ON COLUMN public.bookings.payment_method IS 'Source of payment: STRIPE, PAYPAL, MANUAL (legacy), CASH, BANK, or CREDITS.';
