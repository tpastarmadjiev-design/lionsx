import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Exercise {
  id: string;
  name: string;
  category: 'strength' | 'endurance' | 'mobility';
  lp_reward: number;
  description: string | null;
  created_at: string;
  skill_strength: number;
  skill_endurance: number;
  skill_mobility: number;
  is_timed: boolean;
}

export function useExercises() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: exercises, isLoading, error } = useQuery({
    queryKey: ['exercises'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Exercise[];
    },
  });

  const logTraining = useMutation({
    mutationFn: async ({ 
      exerciseId, 
      lpEarned,
      proofUrl,
      proofType 
    }: { 
      exerciseId: string; 
      lpEarned: number;
      proofUrl?: string;
      proofType?: 'none' | 'photo' | 'video' | 'timed';
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('training_logs')
        .insert({
          user_id: user.id,
          exercise_id: exerciseId,
          lp_earned: lpEarned,
          proof_url: proofUrl || null,
          proof_type: proofType || 'timed',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-logs'] });
    },
    onError: (error) => {
      console.error('Failed to log training:', error);
    },
  });

  const exercisesByCategory = exercises?.reduce((acc, exercise) => {
    if (!acc[exercise.category]) {
      acc[exercise.category] = [];
    }
    acc[exercise.category].push(exercise);
    return acc;
  }, {} as Record<string, Exercise[]>);

  return {
    exercises,
    exercisesByCategory,
    isLoading,
    error,
    logTraining,
  };
}
