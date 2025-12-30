import { getRank, getRankProgress, formatLP, getNextRank, DAILY_LP_CAP } from '@/lib/ranks';
import { Crown, Flame, TrendingUp } from 'lucide-react';

interface RankDisplayProps {
  lp: number;
  dailyLP: number;
}

export function RankDisplay({ lp, dailyLP }: RankDisplayProps) {
  const rank = getRank(lp);
  const nextRank = getNextRank(lp);
  const progress = getRankProgress(lp);
  const remainingDaily = Math.max(0, DAILY_LP_CAP - dailyLP);

  return (
    <div className="lion-card space-y-4 animate-fade-in">
      {/* Current Rank Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-14 h-14 rounded-xl ${rank.bgClass} flex items-center justify-center lion-glow`}>
            <Crown className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Current Rank</p>
            <h3 className={`text-2xl font-display font-bold ${rank.textClass}`}>{rank.name}</h3>
          </div>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground text-sm">Total LP</p>
          <p className="text-2xl font-display font-bold text-foreground">{formatLP(lp)}</p>
        </div>
      </div>

      {/* Progress to Next Rank */}
      {nextRank && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-4 h-4" /> Next: {nextRank.name}
            </span>
            <span className="text-foreground font-medium">{Math.round(progress)}%</span>
          </div>
          <div className="skill-bar h-2">
            <div
              className="skill-bar-fill bg-gradient-to-r from-primary to-accent"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {formatLP(nextRank.minLP - lp)} LP to {nextRank.name}
          </p>
        </div>
      )}

      {/* Daily LP Status */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
        <Flame className={`w-5 h-5 ${remainingDaily > 0 ? 'text-accent' : 'text-muted-foreground'}`} />
        <div className="flex-1">
          <p className="text-sm text-foreground">Daily LP</p>
          <p className="text-xs text-muted-foreground">
            {dailyLP} / {DAILY_LP_CAP} earned today
          </p>
        </div>
        <div className="text-right">
          <span className={`text-lg font-display font-bold ${remainingDaily > 0 ? 'text-accent' : 'text-muted-foreground'}`}>
            {remainingDaily}
          </span>
          <p className="text-xs text-muted-foreground">remaining</p>
        </div>
      </div>
    </div>
  );
}
