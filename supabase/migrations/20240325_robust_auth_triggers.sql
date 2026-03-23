-- SERVER-SIDE ROBUST AUTH: Auto-create Profile row when user registers
-- This bypasses browser "Tracking Protection" blocking client-side REST calls.

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    gen_code TEXT;
    first_name TEXT;
BEGIN
    first_name := COALESCE(SPLIT_PART(NEW.raw_user_meta_data->>'full_name', ' ', 1), 'STAGE');
    gen_code := 'STUDIO-' || UPPER(first_name) || '-' || (FLOOR(RANDOM() * 9000) + 1000)::TEXT;

    INSERT INTO public.profiles (id, full_name, role, avatar_url, stage_code)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', first_name),
        COALESCE(UPPER(NEW.raw_user_meta_data->>'role'), 'STUDENT'),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        CASE WHEN UPPER(NEW.raw_user_meta_data->>'role') = 'TEACHER' THEN gen_code ELSE NULL END
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile after auth.users row is inserted
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update profile if user metadata changes (e.g. name update)
CREATE OR REPLACE FUNCTION public.handle_update_user()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET 
        full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', profiles.full_name),
        role = COALESCE(UPPER(NEW.raw_user_meta_data->>'role'), profiles.role),
        avatar_url = COALESCE(NEW.raw_user_meta_data->>'avatar_url', profiles.avatar_url),
        updated_at = NOW()
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_update_user();
