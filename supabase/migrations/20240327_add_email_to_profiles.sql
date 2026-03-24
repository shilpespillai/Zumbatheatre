-- FIX: Add email column to profiles and update sync trigger
-- This resolves the "column profiles_1.email does not exist" error on the dashboards

-- 1. Add the column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Update the sync function to include email
CREATE OR REPLACE FUNCTION public.sync_profile_from_metadata() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role, stage_code, phone, bio, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Artist'),
        COALESCE(UPPER(NEW.raw_user_meta_data->>'role'), 'STUDENT'),
        NEW.raw_user_meta_data->>'stage_code',
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'bio',
        NEW.email -- Sync directly from auth.users.email
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        email = EXCLUDED.email, -- Update email if changed
        phone = COALESCE(EXCLUDED.phone, profiles.phone),
        bio = COALESCE(EXCLUDED.bio, profiles.bio),
        stage_code = COALESCE(profiles.stage_code, EXCLUDED.stage_code),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Backfill existing profiles from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;
