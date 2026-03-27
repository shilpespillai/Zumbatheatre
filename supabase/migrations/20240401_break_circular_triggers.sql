-- BREAK CIRCULAR DEPENDENCY: Auth <-> Profile Triggers
-- This migration adds "Sync Guards" to both directions of the trigger synchronization.
-- Without these guards, updating a profile triggers a metadata update, 
-- which triggers a profile update, leading to a stack depth limit exceeded error.

-- 1. Function to sync Auth Metadata FROM Public Profile
CREATE OR REPLACE FUNCTION public.sync_metadata_from_profile() 
RETURNS TRIGGER AS $$
BEGIN
    -- GUARD: Only update auth.users if the metadata is actually different from the profile
    -- This breaks the loop when sync_profile_from_metadata updates the profile.
    IF EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = NEW.id 
        AND (raw_user_meta_data->>'full_name') IS NOT DISTINCT FROM NEW.full_name
        AND (raw_user_meta_data->>'role') IS NOT DISTINCT FROM NEW.role
        AND (raw_user_meta_data->>'stage_code') IS NOT DISTINCT FROM NEW.stage_code
        AND (raw_user_meta_data->>'linked_teacher_id') IS NOT DISTINCT FROM NEW.linked_teacher_id
        AND (raw_user_meta_data->>'is_subscribed') IS NOT DISTINCT FROM NEW.is_subscribed::text
    ) THEN
        RETURN NEW;
    END IF;

    UPDATE auth.users 
    SET raw_user_meta_data = 
        COALESCE(raw_user_meta_data, '{}'::jsonb) || 
        jsonb_build_object(
            'full_name', NEW.full_name,
            'role', NEW.role,
            'stage_code', NEW.stage_code,
            'linked_teacher_id', NEW.linked_teacher_id,
            'is_subscribed', NEW.is_subscribed
        )
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function to sync Public Profile FROM Auth Metadata
CREATE OR REPLACE FUNCTION public.sync_profile_from_metadata() 
RETURNS TRIGGER AS $$
BEGIN
    -- GUARD: Only update profile if values are different from current profile
    -- This breaks the loop when sync_metadata_from_profile updates auth.users.
    IF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = NEW.id 
        AND full_name IS NOT DISTINCT FROM COALESCE(NEW.raw_user_meta_data->>'full_name', 'Artist')
        AND role IS NOT DISTINCT FROM COALESCE(UPPER(NEW.raw_user_meta_data->>'role'), 'STUDENT')
        AND (stage_code) IS NOT DISTINCT FROM (NEW.raw_user_meta_data->>'stage_code')
        AND (phone) IS NOT DISTINCT FROM (NEW.raw_user_meta_data->>'phone')
        AND (bio) IS NOT DISTINCT FROM (NEW.raw_user_meta_data->>'bio')
        AND (email) IS NOT DISTINCT FROM (NEW.email)
    ) THEN
        RETURN NEW;
    END IF;

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
