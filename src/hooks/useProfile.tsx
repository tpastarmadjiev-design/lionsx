import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { getDailyLPCap } from '@/lib/ranks';
import { useEffect, useCallback } from 'react';

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
  no_proof_count: number;
  total_exercises_count: number;
  last_count_reset: string;
  created_at: string;
  updated_at: string;
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
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

  // Check if daily reset is needed
  const needsDailyReset = useCallback(() => {
    if (!profile) return false;
    const today = getTodayDate();
    return profile.last_lp_reset !== today;
  }, [profile]);

  // Reset daily limits mutation
  const resetDailyLimits = useMutation({
    mutationFn: async () => {
      if (!user?.id || !profile) throw new Error('Not authenticated');
      
      const today = getTodayDate();
      
      const updates: Partial<Profile> = {
        daily_lp: 0,
        last_lp_reset: today,
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;
      return updates;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast.success('Daily limits reset! Ready for a new day of training! 💪');
    },
    onError: (error) => {
      console.error('Failed to reset daily limits:', error);
    },
  });

  // Auto-reset daily limits when profile loads and day has changed
  useEffect(() => {
    if (profile && needsDailyReset() && !resetDailyLimits.isPending) {
      resetDailyLimits.mutate();
    }
  }, [profile, needsDailyReset, resetDailyLimits.isPending]);

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

  // New addLP for timed exercises - with skill distribution
  const addLP = useMutation({
    mutationFn: async ({ 
      lp, 
      skillXP,
    }: { 
      lp: number; 
      skillXP: { strength: number; endurance: number; mobility: number };
    }) => {
      if (!user?.id || !profile) throw new Error('Not authenticated');

      // Check if daily reset is needed
      const today = getTodayDate();
      let currentDailyLP = profile.daily_lp;
      
      if (profile.last_lp_reset !== today) {
        currentDailyLP = 0;
      }

      // Check daily cap
      const remainingDaily = getDailyLPCap(user.id) - currentDailyLP;
      if (remainingDaily <= 0) {
        throw new Error('Daily LP cap reached! Come back tomorrow.');
      }

      // Cap LP by daily remaining
      const actualLP = Math.min(lp, remainingDaily);
      
      // Scale skill XP proportionally if LP was capped
      const scale = lp > 0 ? actualLP / lp : 0;
      const actualSkillXP = {
        strength: Math.floor(skillXP.strength * scale),
        endurance: Math.floor(skillXP.endurance * scale),
        mobility: Math.floor(skillXP.mobility * scale),
      };

      const updates: Partial<Profile> = {
        lp: profile.lp + actualLP,
        daily_lp: currentDailyLP + actualLP,
        last_lp_reset: today,
        strength: profile.strength + actualSkillXP.strength,
        endurance: profile.endurance + actualSkillXP.endurance,
        mobility: profile.mobility + actualSkillXP.mobility,
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      return { 
        earnedLP: actualLP, 
        skillXP: actualSkillXP,
        previousLP: profile.lp,
        newLP: profile.lp + actualLP,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast.success(`+${data.earnedLP} LP earned!`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Get the effective daily LP (accounting for auto-reset)
  const getEffectiveDailyLP = useCallback(() => {
    if (!profile) return 0;
    const today = getTodayDate();
    
    if (profile.last_lp_reset !== today) {
      return 0;
    }
    return profile.daily_lp;
  }, [profile]);

  const getRemainingDailyLP = useCallback(() => {
    return Math.max(0, getDailyLPCap(user?.id) - getEffectiveDailyLP());
  }, [getEffectiveDailyLP]);

  const dailyLPCap = getDailyLPCap(user?.id);

  return {
    profile,
    isLoading,
    error,
    updateProfile,
    addLP,
    getEffectiveDailyLP,
    getRemainingDailyLP,
    resetDailyLimits,
    needsDailyReset,
    dailyLPCap,
  };
}
