import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Exercise {
  id: string;
  name: string;
  category: 'strength' | 'endurance' | 'mobility';
  lp_reward: number;
  description: string | null;
  created_at: string;
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
    mutationFn: async ({ exerciseId, lpEarned }: { exerciseId: string; lpEarned: number }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('training_logs')
        .insert({
          user_id: user.id,
          exercise_id: exerciseId,
          lp_earned: lpEarned,
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
