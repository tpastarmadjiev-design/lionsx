-- Create a public view for leaderboard that excludes sensitive fields (email)
CREATE VIEW public.profiles_public
WITH (security_invoker=on) AS
  SELECT 
    id, 
    nickname, 
    country, 
    lp, 
    strength, 
    endurance, 
    mobility, 
    avatar_url,
    created_at,
    updated_at,
    daily_lp,
    total_exercises_count
  FROM public.profiles;

-- Grant SELECT access to authenticated users on the view
GRANT SELECT ON public.profiles_public TO authenticated;

-- Drop the policy that exposes all profile data (including email) to authenticated users
DROP POLICY IF EXISTS "Authenticated users can view all profiles for leaderboard" ON public.profiles;