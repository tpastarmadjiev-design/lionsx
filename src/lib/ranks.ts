export interface Rank {
  name: string;
  minLP: number;
  maxLP: number;
  color: string;
  bgClass: string;
  textClass: string;
}

export const RANKS: Rank[] = [
  { name: 'Bronze', minLP: 0, maxLP: 999, color: 'rank-bronze', bgClass: 'bg-rank-bronze', textClass: 'text-rank-bronze' },
  { name: 'Silver', minLP: 1000, maxLP: 2999, color: 'rank-silver', bgClass: 'bg-rank-silver', textClass: 'text-rank-silver' },
  { name: 'Gold', minLP: 3000, maxLP: 5999, color: 'rank-gold', bgClass: 'bg-rank-gold', textClass: 'text-rank-gold' },
  { name: 'Platinum', minLP: 6000, maxLP: 9999, color: 'rank-platinum', bgClass: 'bg-rank-platinum', textClass: 'text-rank-platinum' },
  { name: 'Diamond', minLP: 10000, maxLP: 14999, color: 'rank-diamond', bgClass: 'bg-rank-diamond', textClass: 'text-rank-diamond' },
  { name: 'Master', minLP: 15000, maxLP: 24999, color: 'rank-master', bgClass: 'bg-rank-master', textClass: 'text-rank-master' },
  { name: 'Lion', minLP: 25000, maxLP: Infinity, color: 'rank-lion', bgClass: 'bg-rank-lion', textClass: 'text-rank-lion' },
];

export const DAILY_LP_CAP = 500;

export function getRank(lp: number): Rank {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (lp >= RANKS[i].minLP) {
      return RANKS[i];
    }
  }
  return RANKS[0];
}

export function getNextRank(lp: number): Rank | null {
  const currentRank = getRank(lp);
  const currentIndex = RANKS.findIndex(r => r.name === currentRank.name);
  if (currentIndex < RANKS.length - 1) {
    return RANKS[currentIndex + 1];
  }
  return null;
}

export function getRankProgress(lp: number): number {
  const currentRank = getRank(lp);
  const nextRank = getNextRank(lp);
  
  if (!nextRank) return 100;
  
  const progressInRank = lp - currentRank.minLP;
  const rankRange = nextRank.minLP - currentRank.minLP;
  
  return Math.min(100, (progressInRank / rankRange) * 100);
}

export function formatLP(lp: number): string {
  if (lp >= 1000) {
    return `${(lp / 1000).toFixed(1)}K`;
  }
  return lp.toString();
}
