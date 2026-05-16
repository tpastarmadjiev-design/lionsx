import { getRank, getRankProgress, formatLP, getNextRank, RANKS, getRankIndex } from '@/lib/ranks';
import { getDivisionInfo } from '@/lib/divisions';
import { RankMedal } from './RankMedal';
import { Flame, TrendingUp, Star } from 'lucide-react';

interface RankDisplayProps {
  lp: number;
  dailyLP: number;
  dailyLPCap: number;
}

export function RankDisplay({ lp, dailyLP, dailyLPCap }: RankDisplayProps) {
  const rank = getRank(lp);
  const nextRank = getNextRank(lp);
  const progress = getRankProgress(lp);
  const remainingDaily = Math.max(0, dailyLPCap - dailyLP);
  const rankIndex = getRankIndex(lp);
  const divisionInfo = getDivisionInfo(lp);

  return (
    <div className="lion-card space-y-4 animate-fade-in">
      {/* Current Rank Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RankMedal 
            rank={rank.name} 
            stars={divisionInfo.stars} 
            size="lg"
            animated
          />
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider">Current Rank</p>
            <h3 className={`text-2xl font-display font-bold ${rank.textClass}`}>{rank.name}</h3>
            <p className="text-xs text-muted-foreground">
              Rank {rankIndex + 1} of {RANKS.length}
            </p>
            {/* Star progress */}
            {!divisionInfo.isMaxRank && (
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3].map((starNum) => (
                  <Star
                    key={starNum}
                    className={`w-4 h-4 ${
                      starNum <= divisionInfo.stars 
                        ? 'text-yellow-400 fill-yellow-400' 
                        : 'text-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground text-xs uppercase tracking-wider">Total LP</p>
          <p className="text-3xl font-display font-bold text-foreground">{formatLP(lp)}</p>
          <p className="text-xs text-muted-foreground">{lp.toLocaleString()} points</p>
        </div>
      </div>

      {/* Star Progress (within current rank) */}
      {!divisionInfo.isMaxRank && (
        <div className="space-y-2 p-3 rounded-lg bg-secondary/20 border border-border/30">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-400" /> 
              Star {divisionInfo.stars + 1} Progress
            </span>
            <span className="text-foreground font-display font-bold">
              {Math.round(divisionInfo.progressToNextStar)}%
            </span>
          </div>
          <div className="skill-bar h-2">
            <div
              className="skill-bar-fill bg-yellow-400/80 transition-all duration-500"
              style={{ width: `${divisionInfo.progressToNextStar}%` }}
            />
          </div>
        </div>
      )}

      {/* Progress to Next Rank */}
      {nextRank && (
        <div className="space-y-2 p-3 rounded-lg bg-secondary/30 border border-border/50">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-4 h-4" /> Next: <span className={nextRank.textClass}>{nextRank.name}</span>
            </span>
            <span className="text-foreground font-display font-bold">{Math.round(progress)}%</span>
          </div>
          <div className="skill-bar h-3">
            <div
              className={`skill-bar-fill ${rank.bgClass} transition-all duration-500`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatLP(lp)} LP</span>
            <span>{formatLP(nextRank.minLP - lp)} to go</span>
            <span>{formatLP(nextRank.minLP)} LP</span>
          </div>
        </div>
      )}

      {nextRank === null && (
        <div className="p-4 rounded-lg bg-gradient-to-r from-rank-legendary/20 to-rank-alpha/20 border border-rank-legendary/30 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Star className="w-5 h-5 text-rank-legendary fill-rank-legendary" />
            <p className="text-rank-legendary font-display font-bold text-lg">Maximum Rank Achieved!</p>
            <Star className="w-5 h-5 text-rank-legendary fill-rank-legendary" />
          </div>
          <p className="text-sm text-muted-foreground">You are a true Lion. Keep training to increase your legend!</p>
        </div>
      )}

      {/* Daily LP Status */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
        <Flame className={`w-5 h-5 ${remainingDaily > 0 ? 'text-accent animate-pulse' : 'text-muted-foreground'}`} />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Daily LP</p>
          <p className="text-xs text-muted-foreground">
            {dailyLP} / {dailyLPCap} earned today
          </p>
        </div>
        <div className="text-right">
          <span className={`text-xl font-display font-bold ${remainingDaily > 0 ? 'text-accent' : 'text-muted-foreground'}`}>
            {remainingDaily}
          </span>
          <p className="text-xs text-muted-foreground">remaining</p>
        </div>
      </div>
    </div>
  );
}
