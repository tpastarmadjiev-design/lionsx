import { RANKS, getRank, getRankIndex } from './ranks';

export interface DivisionInfo {
  rankName: string;
  stars: number;
  progressToNextStar: number;
  lpInCurrentQuarter: number;
  lpPerQuarter: number;
  isMaxRank: boolean;
}

/**
 * Calculate how many stars (0-3) a user has earned within their current rank
 * Each rank is divided into 4 equal quarters (except Legendary which has no quarters)
 */
export function getStarsForLP(lp: number): number {
  const rank = getRank(lp);
  const rankIndex = getRankIndex(lp);
  
  // Legendary rank doesn't have star divisions
  if (rank.name === 'Legendary') {
    return 0;
  }
  
  const rankRange = rank.maxLP - rank.minLP + 1;
  const quarterSize = rankRange / 4;
  const progressInRank = lp - rank.minLP;
  
  // Calculate which quarter we're in (0-3)
  const quarter = Math.floor(progressInRank / quarterSize);
  
  // Stars represent completed quarters (0, 1, 2, or 3)
  return Math.min(quarter, 3);
}

/**
 * Get detailed division info for a given LP value
 */
export function getDivisionInfo(lp: number): DivisionInfo {
  const rank = getRank(lp);
  const isMaxRank = rank.name === 'Legendary';
  
  if (isMaxRank) {
    return {
      rankName: rank.name,
      stars: 0,
      progressToNextStar: 100,
      lpInCurrentQuarter: 0,
      lpPerQuarter: 0,
      isMaxRank: true,
    };
  }
  
  const rankRange = rank.maxLP - rank.minLP + 1;
  const quarterSize = rankRange / 4;
  const progressInRank = lp - rank.minLP;
  
  const currentQuarter = Math.floor(progressInRank / quarterSize);
  const stars = Math.min(currentQuarter, 3);
  
  const lpInCurrentQuarter = progressInRank % quarterSize;
  const progressToNextStar = (lpInCurrentQuarter / quarterSize) * 100;
  
  return {
    rankName: rank.name,
    stars,
    progressToNextStar,
    lpInCurrentQuarter,
    lpPerQuarter: quarterSize,
    isMaxRank: false,
  };
}

/**
 * Calculate LP thresholds for each star within a rank
 */
export function getStarThresholds(rankName: string): number[] {
  const rank = RANKS.find(r => r.name === rankName);
  if (!rank || rank.name === 'Legendary') return [];
  
  const rankRange = rank.maxLP - rank.minLP + 1;
  const quarterSize = rankRange / 4;
  
  return [
    rank.minLP + quarterSize,      // 1 star
    rank.minLP + quarterSize * 2,  // 2 stars  
    rank.minLP + quarterSize * 3,  // 3 stars
    rank.minLP + rankRange,        // Rank promotion
  ];
}

/**
 * Check what milestone was crossed when LP changed
 */
export interface MilestoneResult {
  type: 'none' | 'star' | 'rank';
  newStars?: number;
  newRankName?: string;
  previousRankName?: string;
}

export function checkMilestone(previousLP: number, newLP: number): MilestoneResult {
  if (newLP <= previousLP) {
    return { type: 'none' };
  }
  
  const previousRank = getRank(previousLP);
  const newRank = getRank(newLP);
  
  // Check for rank promotion
  if (newRank.name !== previousRank.name) {
    return { 
      type: 'rank', 
      newRankName: newRank.name,
      previousRankName: previousRank.name,
    };
  }
  
  // Check for star progression within same rank
  const previousStars = getStarsForLP(previousLP);
  const newStars = getStarsForLP(newLP);
  
  if (newStars > previousStars) {
    return { 
      type: 'star', 
      newStars,
    };
  }
  
  return { type: 'none' };
}
