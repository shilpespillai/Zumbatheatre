-- Migration: Add account deletion safety fields
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ DEFAULT NULL;

-- Index for performance on cleanup jobs
CREATE INDEX IF NOT EXISTS idx_profiles_deletion_scheduled ON public.profiles(deletion_scheduled_at) WHERE deletion_scheduled_at IS NOT NULL;
