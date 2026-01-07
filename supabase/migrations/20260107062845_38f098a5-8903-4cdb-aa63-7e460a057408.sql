-- Add Running exercise to the exercises table
INSERT INTO public.exercises (name, category, lp_reward, description, skill_strength, skill_endurance, skill_mobility, is_timed)
VALUES (
  'Running',
  'endurance',
  1,
  'Track your run with GPS. Earn 1 LP for every 20 meters (50 LP per kilometer). Start running and watch your distance grow!',
  0,
  1,
  0,
  false
);