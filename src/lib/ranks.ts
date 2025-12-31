export interface Rank {
  name: string;
  minLP: number;
  maxLP: number;
  color: string;
  bgClass: string;
  textClass: string;
  icon: string;
}

export const RANKS: Rank[] = [
  { name: 'Cub', minLP: 0, maxLP: 999, color: 'rank-cub', bgClass: 'bg-rank-cub', textClass: 'text-rank-cub', icon: '🐱' },
  { name: 'Scout', minLP: 1000, maxLP: 2999, color: 'rank-scout', bgClass: 'bg-rank-scout', textClass: 'text-rank-scout', icon: '🔍' },
  { name: 'Hunter', minLP: 3000, maxLP: 6999, color: 'rank-hunter', bgClass: 'bg-rank-hunter', textClass: 'text-rank-hunter', icon: '🏹' },
  { name: 'Warrior', minLP: 7000, maxLP: 14999, color: 'rank-warrior', bgClass: 'bg-rank-warrior', textClass: 'text-rank-warrior', icon: '⚔️' },
  { name: 'Guardian', minLP: 15000, maxLP: 29999, color: 'rank-guardian', bgClass: 'bg-rank-guardian', textClass: 'text-rank-guardian', icon: '🛡️' },
  { name: 'Champion', minLP: 30000, maxLP: 45999, color: 'rank-champion', bgClass: 'bg-rank-champion', textClass: 'text-rank-champion', icon: '🏆' },
  { name: 'Elite', minLP: 46000, maxLP: 64999, color: 'rank-elite', bgClass: 'bg-rank-elite', textClass: 'text-rank-elite', icon: '💎' },
  { name: 'Alpha', minLP: 65000, maxLP: 84999, color: 'rank-alpha', bgClass: 'bg-rank-alpha', textClass: 'text-rank-alpha', icon: '👑' },
  { name: 'Legendary', minLP: 85000, maxLP: Infinity, color: 'rank-legendary', bgClass: 'bg-rank-legendary', textClass: 'text-rank-legendary', icon: '🦁' },
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

export function getRankIndex(lp: number): number {
  const rank = getRank(lp);
  return RANKS.findIndex(r => r.name === rank.name);
}
