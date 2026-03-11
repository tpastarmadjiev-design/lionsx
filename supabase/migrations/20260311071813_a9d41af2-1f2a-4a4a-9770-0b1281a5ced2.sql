
-- 1. Add timezone and streak fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS longest_streak INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_training_date DATE,
ADD COLUMN IF NOT EXISTS first_session_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS preferred_location TEXT DEFAULT 'home';

-- 2. Training sessions table
CREATE TABLE IF NOT EXISTS public.training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  exercise_name TEXT NOT NULL,
  location TEXT CHECK (location IN ('home', 'street', 'gym')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  was_completed BOOLEAN NOT NULL DEFAULT false,
  reps_achieved INTEGER DEFAULT 0,
  lp_earned INTEGER DEFAULT 0,
  session_duration_seconds INTEGER DEFAULT 0,
  timezone TEXT DEFAULT 'UTC'
);

ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own sessions"
ON public.training_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
ON public.training_sessions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can view own sessions"
ON public.training_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sessions"
ON public.training_sessions FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_training_sessions_user_id ON public.training_sessions(user_id);
CREATE INDEX idx_training_sessions_started_at ON public.training_sessions(started_at);
CREATE INDEX idx_training_sessions_exercise ON public.training_sessions(exercise_name);
CREATE INDEX idx_training_sessions_completed ON public.training_sessions(was_completed);

-- 3. Share events table
CREATE TABLE IF NOT EXISTS public.share_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  share_type TEXT NOT NULL CHECK (share_type IN ('result', 'rank', 'profile', 'challenge', 'referral')),
  platform TEXT CHECK (platform IN ('instagram', 'tiktok', 'facebook', 'twitter', 'whatsapp', 'copy_link', 'qr_code', 'other')),
  shared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.share_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own shares"
ON public.share_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all shares"
ON public.share_events FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_share_events_user_id ON public.share_events(user_id);
CREATE INDEX idx_share_events_platform ON public.share_events(platform);

-- 4. Shop visit tracking table
CREATE TABLE IF NOT EXISTS public.shop_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source TEXT CHECK (source IN ('tab_button', 'profile_link', 'rank_reward', 'notification', 'other')),
  visited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  made_purchase BOOLEAN NOT NULL DEFAULT false,
  purchase_amount NUMERIC(10,2) DEFAULT 0
);

ALTER TABLE public.shop_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own shop visits"
ON public.shop_visits FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shop visits"
ON public.shop_visits FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all shop visits"
ON public.shop_visits FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_shop_visits_user_id ON public.shop_visits(user_id);
CREATE INDEX idx_shop_visits_visited_at ON public.shop_visits(visited_at);

-- 5. App events table
CREATE TABLE IF NOT EXISTS public.app_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own events"
ON public.app_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all events"
ON public.app_events FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_app_events_user_id ON public.app_events(user_id);
CREATE INDEX idx_app_events_type ON public.app_events(event_type);
CREATE INDEX idx_app_events_created ON public.app_events(created_at);

-- 6. Update profiles_public view
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker=on) AS
SELECT 
    id, nickname, country, lp, strength, endurance, mobility, 
    avatar_url, created_at, updated_at, daily_lp, total_exercises_count,
    current_streak, longest_streak, timezone, preferred_location
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated;
