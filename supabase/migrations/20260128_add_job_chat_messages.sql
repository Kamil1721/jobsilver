-- Create job_chat_messages table to store chat history per job
CREATE TABLE IF NOT EXISTS public.job_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_job_chat_messages_job_id ON public.job_chat_messages(job_id);
CREATE INDEX IF NOT EXISTS idx_job_chat_messages_user_id ON public.job_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_job_chat_messages_created_at ON public.job_chat_messages(created_at);

-- Enable RLS
ALTER TABLE public.job_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can only see their own chat messages
CREATE POLICY "Users can view their own chat messages"
    ON public.job_chat_messages
    FOR SELECT
    USING (auth.uid() = user_id);

-- RLS policy: Users can insert their own chat messages
CREATE POLICY "Users can insert their own chat messages"
    ON public.job_chat_messages
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- RLS policy: Users can delete their own chat messages
CREATE POLICY "Users can delete their own chat messages"
    ON public.job_chat_messages
    FOR DELETE
    USING (auth.uid() = user_id);
