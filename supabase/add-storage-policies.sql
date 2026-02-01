-- Storage RLS Policies for CVs Bucket
-- Run this in your Supabase SQL Editor to enable CV uploads

-- Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload own CVs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cvs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own CV files
CREATE POLICY "Users can read own CVs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'cvs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own CV files
CREATE POLICY "Users can update own CVs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'cvs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own CV files
CREATE POLICY "Users can delete own CVs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'cvs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
