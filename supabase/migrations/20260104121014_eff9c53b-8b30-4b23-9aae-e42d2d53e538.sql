-- Add skill distribution columns to exercises table
ALTER TABLE public.exercises 
ADD COLUMN IF NOT EXISTS skill_strength integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS skill_endurance integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS skill_mobility integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_timed boolean NOT NULL DEFAULT false;

-- Delete all existing exercises and replace with the new timed exercises
DELETE FROM public.exercises;

-- Insert new timed exercises with skill distribution (values are percentages)
INSERT INTO public.exercises (name, category, lp_reward, description, skill_strength, skill_endurance, skill_mobility, is_timed) VALUES
('Sit-ups', 'endurance', 1, 'Core strength and endurance test', 30, 60, 10, true),
('Push-ups', 'strength', 1, 'Upper body pushing power', 50, 40, 10, true),
('Jumps', 'endurance', 1, 'Explosive bodyweight jumps', 20, 60, 20, true),
('Plank', 'strength', 1, 'Core stability hold (seconds)', 40, 40, 20, true),
('Dips', 'strength', 1, 'Triceps and chest strength', 70, 20, 10, true),
('Pull-ups', 'strength', 1, 'Upper body pulling power', 80, 15, 5, true),
('Bench Press', 'strength', 1, 'Barbell chest press', 90, 10, 0, true);