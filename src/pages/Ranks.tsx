import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useTrackScreen } from '@/hooks/useAnalyticsTracker';
import { AppLayout } from '@/components/AppLayout';
import { RANKS, getRank, getRankProgress, formatLP } from '@/lib/ranks';
import { getDivisionInfo } from '@/lib/divisions';
import { getCountryFlag } from '@/lib/countryFlags';
import { RankMedal } from '@/components/RankMedal';
import { UserProfileModal } from '@/components/UserProfileModal';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Trophy, Lock, Check, Users, Star, ChevronDown, ChevronUp } from 'lucide-react';

interface UserProfile {
  id: string;
  nickname: string;
  country: string;
  lp: number;
  strength?: number;
  endurance?: number;
  mobility?: number;
  avatar_url?: string | null;
}

function getRankMemberCount(rankName: string, allUsers: UserProfile[]): number {
  const rank = RANKS.find(r => r.name === rankName);
  if (!rank) return 0;
  return allUsers.filter(p => p.lp >= rank.minLP && p.lp <= rank.maxLP).length;
}

function getPlayersInRank(rankName: string, allUsers: UserProfile[], currentUserId?: string): UserProfile[] {
  const rank = RANKS.find(r => r.name === rankName);
  if (!rank) return [];
  return allUsers
    .filter(p => p.lp >= rank.minLP && p.lp <= rank.maxLP && p.id !== currentUserId)
    .sort((a, b) => b.lp - a.lp);
}

function getPositionInRank(userLP: number, rankName: string, allUsers: UserProfile[], currentUserId?: string): { position: number; total: number } {
  const rank = RANKS.find(r => r.name === rankName);
  if (!rank) return { position: 1, total: 1 };
  
  const playersInRank = allUsers.filter(p => p.lp >= rank.minLP && p.lp <= rank.maxLP);
  const sortedPlayers = [...playersInRank].sort((a, b) => b.lp - a.lp);
  const position = sortedPlayers.findIndex(p => p.id === currentUserId) + 1;
  return { position: position || 1, total: playersInRank.length };
}

// Expandable Leaderboard Component
function ExpandableLeaderboard({ 
  players, 
  currentLP, 
  isCurrent, 
  position, 
  rankTextClass,
  onPlayerClick,
}: { 
  players: UserProfile[];
  currentLP: number;
  isCurrent: boolean;
  position: number;
  rankTextClass: string;
  onPlayerClick: (player: UserProfile) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayPlayers = expanded ? players : players.slice(0, 3);

  return (
    <div className="border-t border-border bg-muted/30 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">Top Players</p>
        {players.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                View all ({players.length}) <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        )}
      </div>
      <div className={cn("space-y-1.5", expanded && "max-h-60 overflow-y-auto")}>
        {isCurrent && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="w-5 text-center font-bold text-primary">#{position}</span>
              <span className="font-medium text-primary">You</span>
            </div>
            <span className={cn("font-medium", rankTextClass)}>{formatLP(currentLP)}</span>
          </div>
        )}
        {displayPlayers.map((player) => {
          const playerPosition = players.indexOf(player) + 1;
          const displayPosition = currentLP > player.lp && isCurrent ? playerPosition + 1 : playerPosition;
          return (
            <button
              key={player.id}
              onClick={() => onPlayerClick(player)}
              className="w-full flex items-center justify-between text-sm hover:bg-muted/50 -mx-2 px-2 py-1 rounded transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 text-center text-muted-foreground">#{displayPosition}</span>
                <span className="text-foreground">{player.nickname}</span>
                <span className="text-xs text-muted-foreground">({getCountryFlag(player.country)} {player.country})</span>
              </div>
              <span className="text-muted-foreground">{formatLP(player.lp)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Ranks() {
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading } = useProfile();
  const navigate = useNavigate();
  const currentRankRef = useRef<HTMLDivElement>(null);
  
  useTrackScreen('ranks');

  const [selectedPlayer, setSelectedPlayer] = useState<UserProfile | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Fetch all users for leaderboard with full profile data (using public view to exclude email)
  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-profiles-public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles_public')
        .select('id, nickname, country, lp, strength, endurance, mobility, avatar_url')
        .order('lp', { ascending: false });
      
      if (error) throw error;
      return data as UserProfile[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const currentLP = profile?.lp || 0;
  const currentRank = getRank(currentLP);
  const currentRankIndex = RANKS.findIndex(r => r.name === currentRank.name);
  const progress = getRankProgress(currentLP);
  const { position, total } = getPositionInRank(currentLP, currentRank.name, allUsers, user?.id);
  const divisionInfo = getDivisionInfo(currentLP);

  // Auto-scroll to current rank after render
  useEffect(() => {
    if (!authLoading && !isLoading && currentRankRef.current) {
      setTimeout(() => {
        currentRankRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [authLoading, isLoading, currentRank.name]);

  const handlePlayerClick = (player: UserProfile) => {
    setSelectedPlayer(player);
    setModalOpen(true);
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-display text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <AppLayout title="Rank System">
      {/* User Profile Modal */}
      <UserProfileModal 
        user={selectedPlayer} 
        open={modalOpen} 
        onOpenChange={setModalOpen} 
      />

      {/* Current Rank Hero */}
      <div className="lion-card p-6 mb-6 animate-fade-in text-center">
        <RankMedal 
          rank={currentRank.name} 
          stars={divisionInfo.stars} 
          size="xl" 
          animated 
          className="mx-auto mb-4"
        />
        <h2 className={cn("text-2xl font-display font-bold mb-1", currentRank.textClass)}>
          {currentRank.name}
        </h2>
        <p className="text-muted-foreground mb-2">Current Rank</p>
        
        {/* Star display */}
        {!divisionInfo.isMaxRank && (
          <div className="flex justify-center gap-1 mb-3">
            {[1, 2, 3].map((starNum) => (
              <Star
                key={starNum}
                className={cn(
                  "w-6 h-6 transition-all",
                  starNum <= divisionInfo.stars 
                    ? 'text-yellow-400 fill-yellow-400' 
                    : 'text-muted-foreground/30'
                )}
              />
            ))}
          </div>
        )}
        
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
        {/* Reverse order: highest rank at top */}
        {[...RANKS].reverse().map((rank, index) => {
          const isUnlocked = currentLP >= rank.minLP;
          const isCurrent = rank.name === currentRank.name;
          const memberCount = getRankMemberCount(rank.name, allUsers);
          const players = getPlayersInRank(rank.name, allUsers, user?.id);
          
          return (
            <div
              key={rank.name}
              ref={isCurrent ? currentRankRef : undefined}
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
                <RankMedal 
                  rank={rank.name} 
                  stars={isCurrent ? divisionInfo.stars : 0} 
                  size="sm"
                  showStars={isCurrent}
                />
                
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
                <ExpandableLeaderboard
                  players={players}
                  currentLP={currentLP}
                  isCurrent={isCurrent}
                  position={position}
                  rankTextClass={rank.textClass}
                  onPlayerClick={handlePlayerClick}
                />
              )}
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
