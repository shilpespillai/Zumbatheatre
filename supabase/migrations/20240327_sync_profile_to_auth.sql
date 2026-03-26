-- ROBUST SYNC: Profiles -> Auth Metadata
-- This ensures that when a student switches stage, the Auth layer knows immediately, 
-- preventing "Stage Disruption" during slow loads or cold starts.

CREATE OR REPLACE FUNCTION public.sync_metadata_from_profile() 
RETURNS TRIGGER AS $$
BEGIN
    -- Update auth.users metadata to match the latest profile state
    UPDATE auth.users 
    SET raw_user_meta_data = 
        COALESCE(raw_user_meta_data, '{}'::jsonb) || 
        jsonb_build_object(
            'full_name', NEW.full_name,
            'role', NEW.role,
            'stage_code', NEW.stage_code,
            'linked_teacher_id', NEW.linked_teacher_id
        )
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on public.profiles
DROP TRIGGER IF EXISTS on_profile_updated_sync_auth ON public.profiles;
CREATE TRIGGER on_profile_updated_sync_auth
    AFTER UPDATE OF full_name, role, stage_code, linked_teacher_id ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.sync_metadata_from_profile();

-- Initial sync for existing data
DO $$
DECLARE
    p RECORD;
BEGIN
    FOR p IN SELECT * FROM public.profiles LOOP
        UPDATE auth.users 
        SET raw_user_meta_data = 
            COALESCE(raw_user_meta_data, '{}'::jsonb) || 
            jsonb_build_object(
                'full_name', p.full_name,
                'role', p.role,
                'stage_code', p.stage_code,
                'linked_teacher_id', p.linked_teacher_id
            )
        WHERE id = p.id;
    END LOOP;
END $$;
