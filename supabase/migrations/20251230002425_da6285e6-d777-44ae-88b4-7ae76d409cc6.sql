-- Create app_role enum for admin system
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Unknown',
  lp INTEGER NOT NULL DEFAULT 0,
  daily_lp INTEGER NOT NULL DEFAULT 0,
  last_lp_reset DATE DEFAULT CURRENT_DATE,
  strength INTEGER NOT NULL DEFAULT 0,
  endurance INTEGER NOT NULL DEFAULT 0,
  mobility INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create user_roles table for admin management
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

-- Create exercises table
CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('strength', 'endurance', 'mobility')),
  lp_reward INTEGER NOT NULL DEFAULT 10,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create training_logs table
CREATE TABLE public.training_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  exercise_id UUID REFERENCES public.exercises(id) ON DELETE CASCADE NOT NULL,
  lp_earned INTEGER NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_logs ENABLE ROW LEVEL SECURITY;

-- Has role function (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Exercises policies (public read, admin write)
CREATE POLICY "Anyone can view exercises" ON public.exercises
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage exercises" ON public.exercises
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Training logs policies
CREATE POLICY "Users can view own training logs" ON public.training_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own training logs" ON public.training_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all training logs" ON public.training_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, country)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nickname', 'Lion'),
    COALESCE(NEW.raw_user_meta_data ->> 'country', 'Unknown')
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default exercises
INSERT INTO public.exercises (name, category, lp_reward, description) VALUES
  ('Push-ups', 'strength', 15, 'Classic upper body exercise'),
  ('Squats', 'strength', 20, 'Build powerful legs'),
  ('Pull-ups', 'strength', 25, 'Ultimate back builder'),
  ('Deadlifts', 'strength', 30, 'King of strength exercises'),
  ('Plank', 'strength', 10, 'Core stability'),
  ('Running', 'endurance', 20, 'Cardiovascular conditioning'),
  ('Burpees', 'endurance', 25, 'Full body cardio'),
  ('Jump Rope', 'endurance', 15, 'Coordination and stamina'),
  ('Mountain Climbers', 'endurance', 18, 'High intensity cardio'),
  ('Cycling', 'endurance', 15, 'Low impact cardio'),
  ('Stretching', 'mobility', 10, 'Improve flexibility'),
  ('Yoga Flow', 'mobility', 15, 'Mind-body connection'),
  ('Hip Openers', 'mobility', 12, 'Unlock hip mobility'),
  ('Shoulder Mobility', 'mobility', 12, 'Upper body flexibility'),
  ('Foam Rolling', 'mobility', 8, 'Recovery and mobility');