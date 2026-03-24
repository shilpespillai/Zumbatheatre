-- Migration: Add attended column to bookings
-- Description: Enables instructors to track student attendance.

ALTER TABLE IF EXISTS public.bookings 
ADD COLUMN IF NOT EXISTS attended BOOLEAN DEFAULT false;

-- Enable RLS for the new column (should be inherited if using table-level RLS)
-- But ensuring teachers can update it
-- Assuming existing policy 'Teachers can update their own bookings' exists.
