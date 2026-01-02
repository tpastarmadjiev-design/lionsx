import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { AppLayout } from '@/components/AppLayout';
import { RANKS, getRank, getRankProgress, formatLP } from '@/lib/ranks';
import { cn } from '@/lib/utils';
import { Trophy, Lock, Check, ChevronRight } from 'lucide-react';

export default function Ranks() {
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

  const currentLP = profile?.lp || 0;
  const currentRank = getRank(currentLP);
  const currentRankIndex = RANKS.findIndex(r => r.name === currentRank.name);
  const progress = getRankProgress(currentLP);

  return (
    <AppLayout title="Rank System">
      {/* Current Rank Hero */}
      <div className="lion-card p-6 mb-6 animate-fade-in text-center">
        <div className="text-5xl mb-3">{currentRank.icon}</div>
        <h2 className={cn("text-2xl font-display font-bold mb-1", currentRank.textClass)}>
          {currentRank.name}
        </h2>
        <p className="text-muted-foreground mb-4">Current Rank</p>
        
        <div className="flex items-center justify-center gap-2 mb-2">
          <Trophy className="w-5 h-5 text-primary" />
          <span className="text-2xl font-display font-bold text-foreground">
            {formatLP(currentLP)} LP
          </span>
        </div>
        
        {currentRankIndex < RANKS.length - 1 && (
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progress to {RANKS[currentRankIndex + 1].name}</span>
              <span className="text-primary font-medium">{progress.toFixed(0)}%</span>
            </div>
            <div className="h-3 rounded-full bg-secondary overflow-hidden">
              <div 
                className={cn("h-full rounded-full transition-all duration-500", currentRank.bgClass)}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {formatLP(RANKS[currentRankIndex + 1].minLP - currentLP)} LP to next rank
            </p>
          </div>
        )}
      </div>

      {/* Rank Ladder */}
      <h3 className="text-lg font-display font-semibold text-foreground mb-4">All Ranks</h3>
      
      <div className="space-y-3">
        {RANKS.map((rank, index) => {
          const isUnlocked = currentLP >= rank.minLP;
          const isCurrent = rank.name === currentRank.name;
          
          return (
            <div
              key={rank.name}
              className={cn(
                "lion-card p-4 flex items-center gap-4 transition-all duration-200 animate-fade-in",
                isCurrent && "ring-2 ring-primary",
                !isUnlocked && "opacity-60"
              )}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center text-2xl",
                isUnlocked ? `${rank.bgClass}/20` : "bg-muted"
              )}>
                {rank.icon}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className={cn(
                    "font-display font-bold",
                    isUnlocked ? rank.textClass : "text-muted-foreground"
                  )}>
                    {rank.name}
                  </h4>
                  {isCurrent && (
                    <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {rank.maxLP === Infinity 
                    ? `${formatLP(rank.minLP)}+ LP`
                    : `${formatLP(rank.minLP)} - ${formatLP(rank.maxLP)} LP`
                  }
                </p>
              </div>
              
              <div className="flex items-center">
                {isUnlocked ? (
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", rank.bgClass)}>
                    <Check className="w-4 h-4 text-background" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
