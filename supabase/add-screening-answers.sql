-- Add screening_answers column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS screening_answers JSONB;

-- Update existing rows to have empty screening_answers
UPDATE profiles SET screening_answers = '{}' WHERE screening_answers IS NULL;
