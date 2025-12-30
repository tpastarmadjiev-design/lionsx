import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { DAILY_LP_CAP } from '@/lib/ranks';

export interface Profile {
  id: string;
  nickname: string;
  country: string;
  lp: number;
  daily_lp: number;
  last_lp_reset: string;
  strength: number;
  endurance: number;
  mobility: number;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as Profile | null;
    },
    enabled: !!user?.id,
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast.success('Profile updated!');
    },
    onError: (error) => {
      toast.error('Failed to update profile');
      console.error(error);
    },
  });

  const addLP = useMutation({
    mutationFn: async ({ lp, category }: { lp: number; category: 'strength' | 'endurance' | 'mobility' }) => {
      if (!user?.id || !profile) throw new Error('Not authenticated');

      // Check if daily reset is needed
      const today = new Date().toISOString().split('T')[0];
      let currentDailyLP = profile.daily_lp;
      
      if (profile.last_lp_reset !== today) {
        currentDailyLP = 0;
      }

      // Check daily cap
      const remainingDaily = DAILY_LP_CAP - currentDailyLP;
      if (remainingDaily <= 0) {
        throw new Error('Daily LP cap reached! Come back tomorrow.');
      }

      const actualLP = Math.min(lp, remainingDaily);

      const updates: Partial<Profile> = {
        lp: profile.lp + actualLP,
        daily_lp: currentDailyLP + actualLP,
        last_lp_reset: today,
        [category]: profile[category] + actualLP,
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      return { earnedLP: actualLP, category };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast.success(`+${data.earnedLP} LP earned!`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    profile,
    isLoading,
    error,
    updateProfile,
    addLP,
  };
}
