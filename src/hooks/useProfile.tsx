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
  no_proof_count: number;
  total_exercises_count: number;
  last_count_reset: string;
  created_at: string;
  updated_at: string;
}

export const MAX_LP_PER_EXERCISE = 50;
export const PROOF_BONUS_LP = 10;
export const MAX_NO_PROOF_PER_CYCLE = 3;
export const CYCLE_SIZE = 5;

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
    mutationFn: async ({ 
      lp, 
      category,
      proofType,
      proofUrl
    }: { 
      lp: number; 
      category: 'strength' | 'endurance' | 'mobility';
      proofType: 'none' | 'photo' | 'video';
      proofUrl?: string;
    }) => {
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

      // Reset no-proof cycle if needed (every 5 exercises)
      let noProofCount = profile.no_proof_count;
      let totalCount = profile.total_exercises_count;
      const lastReset = profile.last_count_reset;

      if (lastReset !== today) {
        noProofCount = 0;
        totalCount = 0;
      }

      // Check no-proof limit (3 out of every 5)
      if (proofType === 'none') {
        const cyclePosition = totalCount % CYCLE_SIZE;
        const noProofInCycle = noProofCount % MAX_NO_PROOF_PER_CYCLE;
        
        // Reset cycle counts every 5 exercises
        if (cyclePosition === 0 && totalCount > 0) {
          noProofCount = 0;
        }
        
        if (noProofCount >= MAX_NO_PROOF_PER_CYCLE && cyclePosition < CYCLE_SIZE) {
          throw new Error('You need to provide proof! (3/5 no-proof limit reached)');
        }
        
        noProofCount += 1;
      }

      totalCount += 1;

      // Calculate LP with cap and bonus
      let baseLp = Math.min(lp, MAX_LP_PER_EXERCISE);
      if (proofType !== 'none') {
        baseLp += PROOF_BONUS_LP;
      }
      const actualLP = Math.min(baseLp, remainingDaily);

      const updates: Partial<Profile> = {
        lp: profile.lp + actualLP,
        daily_lp: currentDailyLP + actualLP,
        last_lp_reset: today,
        [category]: profile[category] + actualLP,
        no_proof_count: noProofCount,
        total_exercises_count: totalCount,
        last_count_reset: today,
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      return { 
        earnedLP: actualLP, 
        category, 
        proofType,
        hasBonus: proofType !== 'none'
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      const bonusText = data.hasBonus ? ` (+${PROOF_BONUS_LP} proof bonus!)` : '';
      toast.success(`+${data.earnedLP} LP earned!${bonusText}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Check if user can skip proof
  const canSkipProof = () => {
    if (!profile) return false;
    const today = new Date().toISOString().split('T')[0];
    
    let noProofCount = profile.no_proof_count;
    if (profile.last_count_reset !== today) {
      noProofCount = 0;
    }
    
    return noProofCount < MAX_NO_PROOF_PER_CYCLE;
  };

  const getNoProofRemaining = () => {
    if (!profile) return MAX_NO_PROOF_PER_CYCLE;
    const today = new Date().toISOString().split('T')[0];
    
    let noProofCount = profile.no_proof_count;
    if (profile.last_count_reset !== today) {
      noProofCount = 0;
    }
    
    return Math.max(0, MAX_NO_PROOF_PER_CYCLE - noProofCount);
  };

  return {
    profile,
    isLoading,
    error,
    updateProfile,
    addLP,
    canSkipProof,
    getNoProofRemaining,
  };
}
