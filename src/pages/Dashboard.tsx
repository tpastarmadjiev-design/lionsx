import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useTrackScreen } from '@/hooks/useAnalyticsTracker';
import { AppLayout } from '@/components/AppLayout';
import { CircularSkillProgress } from '@/components/CircularSkillProgress';
import { Crown, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getRank, getNextRank, getRankProgress, formatLP } from '@/lib/ranks';
import { SocialLinksModal } from '@/components/SocialLinksModal';

import trainingCardBg from '@/assets/training-card-bg.jpg';
import shopCardBg from '@/assets/shop-card-bg.jpg';
import ranksCardBg from '@/assets/ranks-card-bg.jpg';

const MAX_SKILL = 10000;

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading, getEffectiveDailyLP, dailyLPCap } = useProfile();
  const navigate = useNavigate();
  
  const [socialOpen, setSocialOpen] = useState(false);
  useTrackScreen('dashboard');

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
  const rank = getRank(profile.lp);

  return (
    <AppLayout>
      {/* Header with Profile */}
      <div className="flex items-start gap-4 mb-6">
        {/* Profile Avatar */}
        <div className="relative">
          {(profile as any).avatar_url ? (
            <img 
              src={(profile as any).avatar_url} 
              alt={profile.nickname}
              className="w-16 h-16 rounded-full object-cover border-2 border-primary"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center border-2 border-primary overflow-hidden">
              <span className="text-2xl font-display font-bold text-primary-foreground">
                {profile.nickname.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-background flex items-center justify-center">
            <Crown className="w-4 h-4 text-primary" />
          </div>
        </div>
        
        {/* Profile Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium ${rank.textClass}`}>
              {rank.icon} {rank.name}
            </span>
          </div>
          <h1 className="text-xl font-display font-bold text-foreground mb-1">
            {profile.nickname}
          </h1>
          {/* LP Progress Bar - within current rank */}
          {(() => {
            const nextRank = getNextRank(profile.lp);
            const progress = getRankProgress(profile.lp);
            const lpToNext = nextRank ? nextRank.minLP - profile.lp : 0;
            const targetLP = nextRank ? nextRank.minLP : profile.lp;
            return (
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {profile.lp.toLocaleString()} / {targetLP.toLocaleString()} LP
                  </span>
                </div>
                {nextRank && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {lpToNext.toLocaleString()} LP to {nextRank.name}
                  </p>
                )}
              </div>
            );
          })()}

        </div>
      </div>

      {/* Circular Skill Progress */}
      <div className="flex justify-around items-center mb-6 py-4">
        <CircularSkillProgress
          value={profile.strength}
          maxValue={MAX_SKILL}
          label="Strength"
          type="strength"
        />
        <CircularSkillProgress
          value={profile.endurance}
          maxValue={MAX_SKILL}
          label="Endurance"
          type="endurance"
        />
        <CircularSkillProgress
          value={profile.mobility}
          maxValue={MAX_SKILL}
          label="Mobility"
          type="mobility"
        />
      </div>

      {/* Daily LP Status */}
      <div className="flex items-center justify-between px-4 py-3 bg-card rounded-xl border border-border mb-6">
        <span className="text-sm font-medium text-foreground">Daily LP</span>
        <span className="text-sm text-muted-foreground">
          {effectiveDailyLP} / {dailyLPCap} earned today
        </span>
      </div>

      {/* Action Cards */}
      <div className="space-y-4">
        {/* Start Training Card */}
        <button
          onClick={() => navigate('/training')}
          className="relative w-full h-32 rounded-2xl overflow-hidden group"
        >
          <img 
            src={trainingCardBg} 
            alt="" 
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-teal-900/80 to-transparent" />
          <div className="relative z-10 h-full flex flex-col justify-center px-5">
            <h3 className="text-xl font-display font-bold text-foreground text-left">
              Start Training
            </h3>
            <p className="text-sm text-muted-foreground text-left">
              Begin your workout session
            </p>
          </div>
          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-foreground opacity-60 group-hover:opacity-100 transition-opacity" />
        </button>

        {/* Our Shop Card */}
        <button
          onClick={() => navigate('/shop')}
          className="relative w-full h-32 rounded-2xl overflow-hidden group"
        >
          <img 
            src={shopCardBg} 
            alt="" 
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-amber-900/80 to-transparent" />
          <div className="relative z-10 h-full flex flex-col justify-center px-5">
            <h3 className="text-xl font-display font-bold text-foreground text-left">
              Our Shop
            </h3>
            <p className="text-sm text-muted-foreground text-left">
              Get exclusive merch
            </p>
          </div>
          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-foreground opacity-60 group-hover:opacity-100 transition-opacity" />
        </button>

        {/* Ranks Card */}
        <button
          onClick={() => navigate('/ranks')}
          className="relative w-full h-32 rounded-2xl overflow-hidden group"
        >
          <img 
            src={ranksCardBg} 
            alt="" 
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-purple-900/80 to-transparent" />
          <div className="relative z-10 h-full flex flex-col justify-center px-5">
            <h3 className="text-xl font-display font-bold text-foreground text-left">
              Ranks
            </h3>
            <p className="text-sm text-muted-foreground text-left">
              View your progress & tier
            </p>
          </div>
          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-foreground opacity-60 group-hover:opacity-100 transition-opacity" />
        </button>

        {/* Follow Us Card */}
        <button
          onClick={() => setSocialOpen(true)}
          className="relative w-full h-32 rounded-2xl overflow-hidden group"
        >
          {/* Layered gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#8B2035] via-[#6a1a2d] to-[#3a0e18]" />
          {/* Subtle radial glow */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#E4405F]/15 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-[#1877F2]/10 blur-2xl" />
          {/* Diagonal pattern lines */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 20px, white 20px, white 21px)',
          }} />

          <div className="relative z-10 h-full flex items-center justify-between px-5">
            {/* Left text */}
            <div className="flex flex-col justify-center">
              <h3 className="text-xl font-display font-bold text-foreground text-left">
                FOLLOW US
              </h3>
              <p className="text-sm text-muted-foreground text-left">
                Join the Lions-X community
              </p>
            </div>

            {/* Right side: social icons */}
            <div className="flex items-center gap-2 mr-2">
              {[
                { color: '#1877F2', icon: <Facebook className="w-4 h-4" /> },
                { color: '#E4405F', icon: <Instagram className="w-4 h-4" /> },
                { color: '#ffffff', icon: <TikTokIcon /> },
                { color: '#FF0000', icon: <Youtube className="w-4 h-4" /> },
              ].map((s, i) => (
                <div
                  key={i}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${s.color}20`, color: s.color }}
                >
                  {s.icon}
                </div>
              ))}
            </div>
          </div>
        </button>
      </div>

      <SocialLinksModal open={socialOpen} onOpenChange={setSocialOpen} />
    </AppLayout>
  );
}
