-- Add loyalty_settings to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS loyalty_settings JSONB DEFAULT '{"required_sessions": 10, "reward_type": "FREE_SESSION", "enabled": true}'::jsonb;

-- Add a comment for clarity
COMMENT ON COLUMN profiles.loyalty_settings IS 'Stores teacher-specific loyalty program configuration.';
