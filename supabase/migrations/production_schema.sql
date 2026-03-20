-- PROD READINESS: Database Clean Reset Schema for Zumbatheatre
-- WARNING: Running this will DELETE ALL DATA in the listed tables.

-- Drop existing tables if they exist (Order matters for foreign keys)
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.schedules CASCADE;
DROP TABLE IF EXISTS public.routines CASCADE;
DROP TABLE IF EXISTS public.credits CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.system_config CASCADE;

-- 1. PROFILES
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT CHECK (role IN ('STUDENT', 'TEACHER', 'ADMIN')),
    avatar_url TEXT,
    invite_code TEXT UNIQUE,
    linked_teacher_id UUID REFERENCES public.profiles(id),
    is_subscribed BOOLEAN DEFAULT FALSE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    payment_settings JSONB DEFAULT '{"method": "manual", "config": {}}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ROUTINES
CREATE TABLE public.routines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER DEFAULT 60,
    default_price NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. SCHEDULES
CREATE TABLE public.schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    location TEXT DEFAULT 'Main Studio',
    max_seats INTEGER DEFAULT 20,
    seats_taken INTEGER DEFAULT 0,
    status TEXT DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'CANCELLED', 'COMPLETED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. BOOKINGS
CREATE TABLE public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
    payment_method TEXT CHECK (payment_method IN ('STRIPE', 'PAYPAL', 'MANUAL', 'CREDITS')),
    payment_status TEXT DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'VOID', 'REFUNDED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. PAYMENTS
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    student_id UUID REFERENCES public.profiles(id),
    teacher_id UUID REFERENCES public.profiles(id),
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    stripe_payment_intent_id TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. CREDITS
CREATE TABLE public.credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    balance NUMERIC(10, 2) DEFAULT 0.00,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, teacher_id)
);

-- 7. SYSTEM CONFIG
CREATE TABLE public.system_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    subscription_price NUMERIC(10, 2) DEFAULT 10.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. INDEXES for Performance
CREATE INDEX IF NOT EXISTS idx_profiles_invite_code ON public.profiles(invite_code);
CREATE INDEX IF NOT EXISTS idx_schedules_teacher_id ON public.schedules(teacher_id);
CREATE INDEX IF NOT EXISTS idx_schedules_start_time ON public.schedules(start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_student_id ON public.bookings(student_id);
CREATE INDEX IF NOT EXISTS idx_bookings_schedule_id ON public.bookings(schedule_id);
CREATE INDEX IF NOT EXISTS idx_credits_student_teacher ON public.credits(student_id, teacher_id);

-- 9. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

-- 9.1 Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- 9.2 Routines Policies
CREATE POLICY "Routines are viewable by everyone" ON public.routines
    FOR SELECT USING (true);

CREATE POLICY "Teachers can manage their own routines" ON public.routines
    FOR ALL USING (auth.uid() = teacher_id);

-- 9.3 Schedules Policies
CREATE POLICY "Schedules are viewable by everyone" ON public.schedules
    FOR SELECT USING (true);

CREATE POLICY "Teachers can manage their own schedules" ON public.schedules
    FOR ALL USING (auth.uid() = teacher_id);

-- 9.4 Bookings Policies
CREATE POLICY "Students can view their own bookings" ON public.bookings
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Teachers can view bookings for their schedules" ON public.bookings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.schedules 
            WHERE schedules.id = bookings.schedule_id 
            AND schedules.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Students can create their own bookings" ON public.bookings
    FOR INSERT WITH CHECK (auth.uid() = student_id);

-- 9.5 Payments Policies
CREATE POLICY "Users can view their own payments" ON public.payments
    FOR SELECT USING (auth.uid() = student_id OR auth.uid() = teacher_id);

-- 9.6 Credits Policies
CREATE POLICY "Students can view their credits" ON public.credits
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Teachers can view credits issued to their students" ON public.credits
    FOR SELECT USING (auth.uid() = teacher_id);

-- 10. INSTRUCTOR SECRETS (Encrypted Keys)
-- This table is NOT exposed to any RLS policy, making it accessible ONLY via Service Role (Edge Functions)
CREATE TABLE IF NOT EXISTS public.instructor_secrets (
    teacher_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    encrypted_secret_key TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.instructor_secrets ENABLE ROW LEVEL SECURITY;
-- No policies = No one can read/write except DB Admin and Service Role
