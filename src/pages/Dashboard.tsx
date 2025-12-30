import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { AppLayout } from '@/components/AppLayout';
import { RankDisplay } from '@/components/RankDisplay';
import { SkillBars } from '@/components/SkillBars';
import { Button } from '@/components/ui/button';
import { Dumbbell, TrendingUp, Calendar } from 'lucide-react';
import { useEffect } from 'react';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading } = useProfile();
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

      {/* Rank Display */}
      <RankDisplay lp={profile.lp} dailyLP={profile.daily_lp} />

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
        >
          <Dumbbell className="w-5 h-5" />
          Start Training
        </Button>
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
