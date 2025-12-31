-- Add proof tracking to training_logs
ALTER TABLE public.training_logs
ADD COLUMN proof_url TEXT,
ADD COLUMN proof_type TEXT CHECK (proof_type IN ('none', 'photo', 'video'));

-- Add no-proof tracking to profiles (3 out of 5 rule)
ALTER TABLE public.profiles
ADD COLUMN no_proof_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN total_exercises_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN last_count_reset DATE DEFAULT CURRENT_DATE;

-- Create storage bucket for training proofs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'training-proofs',
  'training-proofs',
  true,
  20971520,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
);

-- Storage policies for training proofs
CREATE POLICY "Users can upload own proofs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'training-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'training-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Public can view all proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'training-proofs');

CREATE POLICY "Users can delete own proofs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'training-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);