
CREATE TABLE public.suspicion_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id text,
  exercise_name text,
  unrealistic_speed boolean DEFAULT false,
  single_axis_motion boolean DEFAULT false,
  micro_movements boolean DEFAULT false,
  volume_spike boolean DEFAULT false,
  no_orientation_change boolean DEFAULT false,
  suspicion_score integer DEFAULT 0,
  average_tempo numeric,
  axis_distribution jsonb DEFAULT '{"x": 0, "y": 0, "z": 0}'::jsonb,
  orientation_change numeric,
  total_reps integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.suspicion_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all suspicion flags"
  ON public.suspicion_flags FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own suspicion flags"
  ON public.suspicion_flags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_suspicion_flags_user_id ON public.suspicion_flags(user_id);
CREATE INDEX idx_suspicion_flags_score ON public.suspicion_flags(suspicion_score);
CREATE INDEX idx_suspicion_flags_created ON public.suspicion_flags(created_at);
