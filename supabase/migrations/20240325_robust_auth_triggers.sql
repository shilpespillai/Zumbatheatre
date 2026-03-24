-- MINIMALIST & ROBUST TRIGGER: Syncs profile from metadata without failing on constraints
CREATE OR REPLACE FUNCTION public.sync_profile_from_metadata() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role, stage_code, phone, bio)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Artist'),
        COALESCE(UPPER(NEW.raw_user_meta_data->>'role'), 'STUDENT'),
        NEW.raw_user_meta_data->>'stage_code',
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'bio'
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        phone = COALESCE(EXCLUDED.phone, profiles.phone),
        bio = COALESCE(EXCLUDED.bio, profiles.bio),
        stage_code = COALESCE(profiles.stage_code, EXCLUDED.stage_code),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the triggers on auth.users (BOTH insert and update use the same sync logic)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_from_metadata();

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_from_metadata();

