import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { AppLayout } from '@/components/AppLayout';
import { RANKS, getRank, getRankProgress, formatLP } from '@/lib/ranks';
import { cn } from '@/lib/utils';
import { Trophy, Lock, Check, Users } from 'lucide-react';

// Simulated profiles for each rank to show division population
const MOCK_PROFILES = [
  // Cub rank (0-999)
  { nickname: 'TigerCub', country: 'USA', lp: 150 },
  { nickname: 'NewLion', country: 'UK', lp: 320 },
  { nickname: 'FreshPaw', country: 'Germany', lp: 580 },
  { nickname: 'BabyRoar', country: 'France', lp: 890 },
  { nickname: 'LittleClaw', country: 'Italy', lp: 450 },
  // Scout rank (1000-2999)
  { nickname: 'ScoutMaster', country: 'Canada', lp: 1200 },
  { nickname: 'TrailBlazer', country: 'Australia', lp: 1850 },
  { nickname: 'PathFinder', country: 'Japan', lp: 2400 },
  { nickname: 'ForestEye', country: 'Brazil', lp: 2750 },
  // Hunter rank (3000-6999)
  { nickname: 'ShadowHunter', country: 'Spain', lp: 3500 },
  { nickname: 'SwiftArrow', country: 'Italy', lp: 4800 },
  { nickname: 'NightStalker', country: 'Mexico', lp: 5900 },
  { nickname: 'SilentPrey', country: 'India', lp: 6500 },
  { nickname: 'QuickHunt', country: 'Thailand', lp: 4200 },
  { nickname: 'PreciseShot', country: 'Vietnam', lp: 5100 },
  // Warrior rank (7000-14999)
  { nickname: 'IronFist', country: 'Russia', lp: 7500 },
  { nickname: 'BattleBorn', country: 'China', lp: 9200 },
  { nickname: 'WarMachine', country: 'Korea', lp: 11500 },
  { nickname: 'SteelHeart', country: 'Poland', lp: 14000 },
  { nickname: 'BladeRunner', country: 'Ukraine', lp: 8800 },
  // Guardian rank (15000-29999)
  { nickname: 'ShieldBearer', country: 'Sweden', lp: 16000 },
  { nickname: 'Protector', country: 'Norway', lp: 21000 },
  { nickname: 'Defender', country: 'Finland', lp: 27000 },
  // Champion rank (30000-45999)
  { nickname: 'GoldChamp', country: 'Netherlands', lp: 32000 },
  { nickname: 'VictoryKing', country: 'Belgium', lp: 40000 },
  // Elite rank (46000-64999)
  { nickname: 'DiamondElite', country: 'Switzerland', lp: 50000 },
  { nickname: 'PlatinumPro', country: 'Austria', lp: 60000 },
  // Alpha rank (65000-84999)
  { nickname: 'AlphaLord', country: 'Denmark', lp: 70000 },
  { nickname: 'PackLeader', country: 'Ireland', lp: 80000 },
  // Legendary rank (85000+)
  { nickname: 'LegendaryKing', country: 'Portugal', lp: 95000 },
  { nickname: 'MythicBeast', country: 'Greece', lp: 120000 },
];

function getRankMemberCount(rankName: string): number {
  const rank = RANKS.find(r => r.name === rankName);
  if (!rank) return 0;
  return MOCK_PROFILES.filter(p => p.lp >= rank.minLP && p.lp <= rank.maxLP).length;
}

function getPlayersInRank(rankName: string) {
  const rank = RANKS.find(r => r.name === rankName);
  if (!rank) return [];
  return MOCK_PROFILES
    .filter(p => p.lp >= rank.minLP && p.lp <= rank.maxLP)
    .sort((a, b) => b.lp - a.lp);
}

function getPositionInRank(userLP: number, rankName: string): { position: number; total: number } {
  const players = getPlayersInRank(rankName);
  const allPlayers = [...players, { nickname: 'You', country: '', lp: userLP }]
    .sort((a, b) => b.lp - a.lp);
  const position = allPlayers.findIndex(p => p.nickname === 'You') + 1;
  return { position, total: allPlayers.length };
}

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
  const { position, total } = getPositionInRank(currentLP, currentRank.name);

  return (
    <AppLayout title="Rank System">
      {/* Current Rank Hero */}
      <div className="lion-card p-6 mb-6 animate-fade-in text-center">
        <div className="text-5xl mb-3">{currentRank.icon}</div>
        <h2 className={cn("text-2xl font-display font-bold mb-1", currentRank.textClass)}>
          {currentRank.name}
        </h2>
        <p className="text-muted-foreground mb-2">Current Rank</p>
        
        {/* Position in division */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 mb-4">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">
            #{position} of {total} in your division
          </span>
        </div>
        
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
      <h3 className="text-lg font-display font-semibold text-foreground mb-4">All Divisions</h3>
      
      <div className="space-y-3">
        {RANKS.map((rank, index) => {
          const isUnlocked = currentLP >= rank.minLP;
          const isCurrent = rank.name === currentRank.name;
          const memberCount = getRankMemberCount(rank.name);
          const players = getPlayersInRank(rank.name);
          
          return (
            <div
              key={rank.name}
              className={cn(
                "lion-card overflow-hidden transition-all duration-200 animate-fade-in",
                isCurrent && "ring-2 ring-primary"
              )}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className={cn(
                "p-4 flex items-center gap-4",
                !isUnlocked && "opacity-60"
              )}>
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
                        You
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {rank.maxLP === Infinity 
                      ? `${formatLP(rank.minLP)}+ LP`
                      : `${formatLP(rank.minLP)} - ${formatLP(rank.maxLP)} LP`
                    }
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <Users className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {memberCount + (isCurrent ? 1 : 0)} members
                    </span>
                  </div>
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
              
              {/* Show top players in this rank */}
              {(isCurrent || players.length > 0) && (
                <div className="border-t border-border bg-muted/30 px-4 py-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Top Players</p>
                  <div className="space-y-1.5">
                    {isCurrent && (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-center font-bold text-primary">#{position}</span>
                          <span className="font-medium text-primary">You</span>
                        </div>
                        <span className={cn("font-medium", rank.textClass)}>{formatLP(currentLP)}</span>
                      </div>
                    )}
                    {players.slice(0, 3).map((player, pIndex) => {
                      const playerPosition = players.indexOf(player) + 1;
                      const displayPosition = currentLP > player.lp && isCurrent ? playerPosition + 1 : playerPosition;
                      return (
                        <div key={player.nickname} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="w-5 text-center text-muted-foreground">#{displayPosition}</span>
                            <span className="text-foreground">{player.nickname}</span>
                            <span className="text-xs text-muted-foreground">({player.country})</span>
                          </div>
                          <span className="text-muted-foreground">{formatLP(player.lp)}</span>
                        </div>
                      );
                    })}
                    {players.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center pt-1">
                        +{players.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
