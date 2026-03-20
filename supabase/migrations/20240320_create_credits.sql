-- Create Credits table to track student balances per teacher
CREATE TABLE IF NOT EXISTS public.credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    balance NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, teacher_id)
);

-- Enable RLS
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

-- Policies for Credits
-- Students can view their own credits
CREATE POLICY "Students can view their own credits" 
ON public.credits FOR SELECT 
USING (auth.uid() = student_id);

-- Teachers can view and manage credits for their students
CREATE POLICY "Teachers can manage credits for their students" 
ON public.credits FOR ALL
USING (auth.uid() = teacher_id);

-- Enable realtime for credits
ALTER PUBLICATION supabase_realtime ADD TABLE public.credits;

-- Function to handle credit updates (logging etc. could be added here)
CREATE OR REPLACE FUNCTION public.handle_credit_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_credits_timestamp
BEFORE UPDATE ON public.credits
FOR EACH ROW
EXECUTE FUNCTION public.handle_credit_update();
