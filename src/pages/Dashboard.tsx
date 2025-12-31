import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { AppLayout } from '@/components/AppLayout';
import { RankDisplay } from '@/components/RankDisplay';
import { SkillBars } from '@/components/SkillBars';
import { Button } from '@/components/ui/button';
import { Dumbbell, TrendingUp, Calendar, Zap, Shield } from 'lucide-react';
import { useEffect } from 'react';
import { DAILY_LP_CAP } from '@/lib/ranks';
import { MAX_NO_PROOF_PER_CYCLE } from '@/hooks/useProfile';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { 
    profile, 
    isLoading, 
    getEffectiveDailyLP, 
    getRemainingDailyLP,
    getNoProofRemaining 
  } = useProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-display text-xl">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Profile not found</div>
      </div>
    );
  }

  const effectiveDailyLP = getEffectiveDailyLP();
  const remainingLP = getRemainingDailyLP();
  const noProofRemaining = getNoProofRemaining();
  const dailyProgress = (effectiveDailyLP / DAILY_LP_CAP) * 100;

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Hey, {profile.nickname}
          </h1>
          <p className="text-muted-foreground text-sm">Ready to train?</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <span className="text-xl font-display font-bold text-primary-foreground">
            {profile.nickname.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Daily LP Status - Prominent Display */}
      <div className="lion-card p-4 mb-4 animate-fade-in border-2 border-accent/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent" />
            <span className="font-display font-semibold text-foreground">Daily LP Progress</span>
          </div>
          <span className="text-lg font-display font-bold text-accent">
            {effectiveDailyLP} / {DAILY_LP_CAP}
          </span>
        </div>
        <div className="skill-bar h-3 mb-2">
          <div
            className="skill-bar-fill bg-gradient-to-r from-accent to-primary transition-all duration-500"
            style={{ width: `${Math.max(2, dailyProgress)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{remainingLP} LP remaining today</span>
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            {noProofRemaining}/{MAX_NO_PROOF_PER_CYCLE} no-proof left
          </span>
        </div>
      </div>

      {/* Rank Display */}
      <RankDisplay lp={profile.lp} dailyLP={effectiveDailyLP} />

      {/* Skills */}
      <div className="mt-4">
        <SkillBars
          strength={profile.strength}
          endurance={profile.endurance}
          mobility={profile.mobility}
        />
      </div>

      {/* Quick Actions */}
      <div className="mt-6 space-y-3">
        <Button
          variant="hero"
          size="xl"
          className="w-full"
          onClick={() => navigate('/training')}
          disabled={remainingLP <= 0}
        >
          <Dumbbell className="w-5 h-5" />
          {remainingLP > 0 ? 'Start Training' : 'Daily Cap Reached'}
        </Button>
        {remainingLP <= 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Come back tomorrow for more training!
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="lion-card p-4 flex items-center gap-3 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="w-10 h-10 rounded-lg bg-strength/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-strength" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total LP</p>
            <p className="text-lg font-display font-bold text-foreground">{profile.lp.toLocaleString()}</p>
          </div>
        </div>
        <div className="lion-card p-4 flex items-center gap-3 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="w-10 h-10 rounded-lg bg-endurance/20 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-endurance" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Member Since</p>
            <p className="text-lg font-display font-bold text-foreground">
              {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
