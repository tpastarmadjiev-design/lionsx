import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useTrackScreen } from '@/hooks/useAnalyticsTracker';
import { AppLayout } from '@/components/AppLayout';
import { CircularSkillProgress } from '@/components/CircularSkillProgress';
import { Crown, ChevronRight, Facebook, Instagram, Youtube } from 'lucide-react';

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-foreground/50">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.7a8.16 8.16 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.13z" />
  </svg>
);
import { useEffect, useState } from 'react';
import { getRank, getNextRank, getRankProgress, formatLP } from '@/lib/ranks';
import { SocialLinksModal } from '@/components/SocialLinksModal';
import { FeedbackIconButton } from '@/components/FeedbackForm';

import trainingCardBg from '@/assets/training-card-bg.jpg';
import shopCardBg from '@/assets/shop-card-bg.jpg';
import ranksCardBg from '@/assets/ranks-card-bg.jpg';
import followCardBg from '@/assets/follow-card-bg.png';
import challengePromoImg from '@/assets/challenge-promo.jpg';

const MAX_SKILL = 10000;

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading, getEffectiveDailyLP, dailyLPCap } = useProfile();
  const navigate = useNavigate();
  
  const [socialOpen, setSocialOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [discordOpen, setDiscordOpen] = useState(false);
  const [discordPending, setDiscordPending] = useState(false);
  useTrackScreen('dashboard');

  useEffect(() => {
    if (!user?.id) return;
    const key = `challengePromoLastShown:${user.id}`;
    const discordKey = `discordPromoLastShown:${user.id}`;
    const ONE_HOUR = 60 * 60 * 1000;
    const last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last < ONE_HOUR) return;
    const t = setTimeout(() => {
      setPromoOpen(true);
      localStorage.setItem(key, String(Date.now()));
      const lastDiscord = Number(localStorage.getItem(discordKey) || 0);
      if (Date.now() - lastDiscord >= ONE_HOUR) {
        setDiscordPending(true);
        localStorage.setItem(discordKey, String(Date.now()));
      }
    }, 400);
    return () => clearTimeout(t);
  }, [user?.id]);

  const closePromo = () => {
    setPromoOpen(false);
    if (discordPending) {
      setDiscordPending(false);
      setTimeout(() => setDiscordOpen(true), 300);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
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

        {/* Feedback icon */}
        <FeedbackIconButton />
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
        {/* Training + Challenges Cards (side by side) */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/training')}
            className="relative h-32 rounded-2xl overflow-hidden group"
          >
            <img
              src={trainingCardBg}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-teal-900/90 via-teal-900/40 to-transparent" />
            <div className="relative z-10 h-full flex flex-col justify-end px-4 pb-3">
              <h3 className="text-lg font-display font-bold text-foreground text-left leading-tight">
                Training
              </h3>
              <p className="text-[11px] text-muted-foreground text-left">
                Begin a workout
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate('/challenges')}
            className="relative h-32 rounded-2xl overflow-hidden group"
          >
            <img
              src={trainingCardBg}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-orange-900/90 via-rose-900/40 to-transparent" />
            <div className="relative z-10 h-full flex flex-col justify-end px-4 pb-3">
              <h3 className="text-lg font-display font-bold text-foreground text-left leading-tight">
                Challenges
              </h3>
              <p className="text-[11px] text-muted-foreground text-left">
                Random 6-exercise gauntlet
              </p>
            </div>
          </button>
        </div>

        {/* Our Shop Card */}
        <button
          onClick={() => window.open('https://lions-wear.com', '_blank')}
          className="relative w-full h-32 rounded-2xl overflow-hidden group"
        >
          <img 
            src={shopCardBg} 
            alt="" 
            className="absolute inset-0 w-full h-full object-cover scale-110"
            style={{ objectPosition: 'center 40%' }}
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
          <img 
            src={followCardBg} 
            alt="" 
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#8B2035]/85 via-[#8B2035]/40 to-[#1a0a0f]/60" />
          <div className="relative z-10 h-full flex flex-col justify-center px-5">
            <h3 className="text-xl font-display font-bold text-foreground text-left">
              FOLLOW US
            </h3>
            <p className="text-sm text-muted-foreground text-left">
              Join the Lions-X community
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <Facebook className="w-4 h-4 text-foreground/50" />
              <Instagram className="w-4 h-4 text-foreground/50" />
              <TikTokIcon />
              <Youtube className="w-4 h-4 text-foreground/50" />
            </div>
          </div>
          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-foreground opacity-60 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      <SocialLinksModal open={socialOpen} onOpenChange={setSocialOpen} />

      {promoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
          onClick={closePromo}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-[75vw] h-[75vh] max-w-md rounded-2xl p-[1px] bg-gradient-to-br from-primary/70 via-accent/40 to-primary/70 shadow-[0_0_60px_-10px_hsl(var(--primary)/0.6)] animate-scale-in"
          >
            <div className="relative w-full h-full rounded-2xl bg-card border border-border overflow-hidden">
              {/* Background image */}
              <img
                src={challengePromoImg}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectPosition: 'center 30%' }}
              />
              {/* Dark gradient overlay for readability */}
              <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background/95" />

              {/* Content */}
              <div className="relative z-10 w-full h-full flex flex-col items-center justify-end text-center px-6 py-8">
                <p className="text-xs font-display uppercase tracking-[0.3em] text-primary mb-3 drop-shadow-lg">New Mode</p>
                <h2 className="text-3xl sm:text-4xl font-display font-black uppercase text-foreground leading-tight mb-3 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                  Challenge<br />Yourself.
                </h2>
                <p className="text-sm text-foreground/80 mb-5 max-w-xs drop-shadow-md">
                  6 random exercises. No daily limit. Pure results.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                  <span className="px-3 py-1 rounded-full text-xs font-display font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 backdrop-blur-sm">Easy +30LP</span>
                  <span className="px-3 py-1 rounded-full text-xs font-display font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40 backdrop-blur-sm">Medium +50LP</span>
                  <span className="px-3 py-1 rounded-full text-xs font-display font-bold bg-rose-500/20 text-rose-300 border border-rose-400/40 backdrop-blur-sm">Hard +75LP</span>
                </div>
                <button
                  onClick={() => { closePromo(); navigate('/challenges'); }}
                  className="w-full max-w-xs h-12 rounded-xl font-display font-bold uppercase tracking-wider text-primary-foreground bg-gradient-to-r from-primary to-accent shadow-lg hover:shadow-[0_0_24px_-2px_hsl(var(--primary)/0.7)] transition-all"
                >
                  Start a Challenge
                </button>
                <button
                  onClick={closePromo}
                  className="mt-3 text-xs text-foreground/70 hover:text-foreground transition-colors underline-offset-4 hover:underline"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {discordOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
          onClick={() => setDiscordOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-[75vw] h-[75vh] max-w-md rounded-2xl p-[1px] bg-gradient-to-br from-indigo-500/70 via-violet-500/40 to-indigo-500/70 shadow-[0_0_60px_-10px_rgba(88,101,242,0.6)] animate-scale-in"
          >
            <div className="relative w-full h-full rounded-2xl bg-card border border-border overflow-hidden">
              {/* Background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#5865F2]/30 via-background to-[#404EED]/20" />
              <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background/95" />

              {/* Content */}
              <div className="relative z-10 w-full h-full flex flex-col items-center justify-center text-center px-6 py-8">
                <div className="w-20 h-20 rounded-2xl bg-[#5865F2] flex items-center justify-center mb-5 shadow-[0_0_40px_-5px_rgba(88,101,242,0.8)]">
                  <svg viewBox="0 0 24 24" fill="white" className="w-12 h-12">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                </div>
                <p className="text-xs font-display uppercase tracking-[0.3em] text-indigo-300 mb-3 drop-shadow-lg">Community</p>
                <h2 className="text-3xl sm:text-4xl font-display font-black uppercase text-foreground leading-tight mb-4 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                  Join Our<br />Discord.
                </h2>
                <p className="text-sm text-foreground/80 mb-6 max-w-xs drop-shadow-md">
                  Connect with other Players. Share your thoughts, ideas, bugs, progress. Help us Improve.
                </p>
                <a
                  href="https://discord.gg/YzrhcACptR"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setDiscordOpen(false)}
                  className="w-full max-w-xs h-12 rounded-xl font-display font-bold uppercase tracking-wider text-white bg-gradient-to-r from-[#5865F2] to-[#7289DA] shadow-lg hover:shadow-[0_0_24px_-2px_rgba(88,101,242,0.8)] transition-all flex items-center justify-center"
                >
                  Join the Community
                </a>
                <button
                  onClick={() => setDiscordOpen(false)}
                  className="mt-3 text-xs text-foreground/70 hover:text-foreground transition-colors underline-offset-4 hover:underline"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
