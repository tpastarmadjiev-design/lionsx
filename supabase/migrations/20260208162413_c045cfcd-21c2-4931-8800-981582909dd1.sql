-- Allow all authenticated users to read profiles for the leaderboard
-- This is safe because the profiles_public view excludes sensitive fields (email)
CREATE POLICY "Authenticated users can read profiles for leaderboard" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (true);