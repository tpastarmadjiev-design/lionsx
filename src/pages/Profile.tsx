import { getRank } from '@/lib/ranks';
import { getCountryFlag } from '@/lib/countryFlags';
import { User, Globe, Save } from 'lucide-react';
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
import { useQueryClient } from '@tanstack/react-query';

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
    </AppLayout>
  );
}
