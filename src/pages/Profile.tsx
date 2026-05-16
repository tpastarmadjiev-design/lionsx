import { getRank } from '@/lib/ranks';
import { getCountryFlag } from '@/lib/countryFlags';
import { User, Globe, Save, Dumbbell, Clock, Trophy } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useTrackScreen } from '@/hooks/useAnalyticsTracker';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AvatarUpload } from '@/components/AvatarUpload';
import { FeedbackButton } from '@/components/FeedbackForm';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading, updateProfile } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useTrackScreen('profile');

  const [nickname, setNickname] = useState('');
  const [country, setCountry] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname);
      setCountry(profile.country);
      setAvatarUrl((profile as any).avatar_url || null);
    }
  }, [profile]);

  const handleSave = () => {
    if (nickname.length < 2 || country.length < 2) return;
    updateProfile.mutate({ nickname, country });
  };

  const handleAvatarUpload = (url: string) => {
    setAvatarUrl(url);
    queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
  };

  const hasChanges = profile && (nickname !== profile.nickname || country !== profile.country);

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

  const rank = getRank(profile.lp);

  return (
    <AppLayout title="Profile">
      {/* Avatar & Rank */}
      <div className="lion-card flex flex-col items-center py-8 mb-6 animate-fade-in">
        <div className="relative mb-4">
          <AvatarUpload
            currentAvatarUrl={avatarUrl}
            nickname={profile.nickname}
            onUploadComplete={handleAvatarUpload}
          />
          <div className={`absolute -bottom-2 -right-2 w-12 h-12 rounded-xl ${rank.bgClass} flex items-center justify-center shadow-lg`}>
            <span className="text-xl">{rank.icon}</span>
          </div>
        </div>
        <h2 className="text-2xl font-display font-bold text-foreground">{profile.nickname}</h2>
        <p className={`text-lg font-display font-semibold ${rank.textClass}`}>{rank.name}</p>
        <p className="text-muted-foreground text-sm mt-1">{getCountryFlag(profile.country)} {profile.country}</p>
      </div>

      {/* Edit Form */}
      <div className="lion-card space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <h3 className="text-lg font-display font-semibold text-foreground">Edit Profile</h3>

        <div className="space-y-2">
          <Label htmlFor="nickname" className="text-foreground">Nickname</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="pl-11"
              maxLength={20}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="country" className="text-foreground">Country</Label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="pl-11"
            />
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateProfile.isPending}
          variant={hasChanges ? 'hero' : 'secondary'}
          className="w-full"
        >
          <Save className="w-4 h-4" />
          {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Stats */}
      <div className="lion-card mt-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <h3 className="text-lg font-display font-semibold text-foreground mb-4">Statistics</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-secondary/50">
            <p className="text-xs text-muted-foreground">Total LP</p>
            <p className="text-xl font-display font-bold text-foreground">{profile.lp.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50">
            <p className="text-xs text-muted-foreground">Current Rank</p>
            <div className="flex items-center gap-2">
              <span>{rank.icon}</span>
              <p className={`text-xl font-display font-bold ${rank.textClass}`}>{rank.name}</p>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-strength/10">
            <p className="text-xs text-muted-foreground">Strength XP</p>
            <p className="text-xl font-display font-bold text-strength">{profile.strength.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-lg bg-endurance/10">
            <p className="text-xs text-muted-foreground">Endurance XP</p>
            <p className="text-xl font-display font-bold text-endurance">{profile.endurance.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-lg bg-mobility/10 col-span-2">
            <p className="text-xs text-muted-foreground">Mobility XP</p>
            <p className="text-xl font-display font-bold text-mobility">{profile.mobility.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Feedback */}
      <FeedbackButton />

      {/* Delete Account */}
      <div className="lion-card mt-4 animate-fade-in" style={{ animationDelay: '0.4s' }}>
        <h3 className="text-lg font-display font-semibold text-foreground mb-2">Account</h3>
        <p className="text-sm text-muted-foreground mb-4">If you wish to delete your account and all associated data, you can request deletion below.</p>
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => window.open('https://lions-x.com/delete-account', '_blank')}
        >
          Delete Account
        </Button>
      </div>

      {/* Recent Workouts */}
      <RecentWorkouts userId={user?.id} />
    </AppLayout>
  );
}

function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function RecentWorkouts({ userId }: { userId?: string }) {
  const { data: workouts, isLoading } = useQuery({
    queryKey: ['recent-workouts', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('user_id', userId!)
        .eq('was_completed', true)
        .order('completed_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  return (
    <div className="lion-card mt-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
      <h3 className="text-lg font-display font-semibold text-foreground mb-4">Recent Workouts</h3>
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-lg bg-secondary/30 animate-pulse" />
          ))}
        </div>
      ) : !workouts || workouts.length === 0 ? (
        <div className="text-center py-8">
          <Dumbbell className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No workouts yet. Start training to see your history here!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {workouts.map((w) => (
            <div key={w.id} className="p-3 rounded-lg bg-secondary/30 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">
                  {w.exercise_name || 'Unknown'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(w.completed_at!), 'MMM d, HH:mm')}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                {w.reps_achieved ? (
                  <span>{w.reps_achieved} reps</span>
                ) : null}
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(w.session_duration_seconds)}
                </span>
                <span className="flex items-center gap-1 text-primary font-semibold">
                  <Trophy className="w-3 h-3" />
                  +{w.lp_earned}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
