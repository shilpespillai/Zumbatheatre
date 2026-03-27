-- FIX: handle_credit_update() trigger function
-- The production schema uses 'last_updated' instead of 'updated_at' for the credits table.
-- This was causing the "record 'new' has no field 'updated_at'" error.

CREATE OR REPLACE FUNCTION public.handle_credit_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
