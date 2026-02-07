-- Add policy for all authenticated users to view all profiles for leaderboard
CREATE POLICY "Authenticated users can view all profiles for leaderboard" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);