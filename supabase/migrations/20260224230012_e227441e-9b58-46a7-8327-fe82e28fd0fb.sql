INSERT INTO public.exercises (name, category, description, lp_reward, skill_strength, skill_endurance, skill_mobility, is_timed)
VALUES ('Treadmill Run', 'endurance', 'Run on a treadmill while the camera tracks your movement. No pose detection — just motion-based tracking.', 10, 10, 80, 10, false)
ON CONFLICT DO NOTHING;