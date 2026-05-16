import { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
import { StarCelebration } from './StarCelebration';
import { RankCelebration } from './RankCelebration';
import { checkMilestone, getStarsForLP } from '@/lib/divisions';
import { getRank } from '@/lib/ranks';

interface CelebrationContextType {
  checkAndTrigger: (previousLP: number, newLP: number) => void;
}

const CelebrationContext = createContext<CelebrationContextType | null>(null);

export function useCelebration() {
  const context = useContext(CelebrationContext);
  if (!context) {
    throw new Error('useCelebration must be used within a CelebrationProvider');
  }
  return context;
}

interface CelebrationProviderProps {
  children: ReactNode;
}

export function CelebrationProvider({ children }: CelebrationProviderProps) {
  const [starCelebration, setStarCelebration] = useState<{ 
    isOpen: boolean; 
    rankName: string; 
    newStars: number;
  }>({ isOpen: false, rankName: '', newStars: 0 });

  const [rankCelebration, setRankCelebration] = useState<{
    isOpen: boolean;
    newRankName: string;
  }>({ isOpen: false, newRankName: '' });

  const checkAndTrigger = useCallback((previousLP: number, newLP: number) => {
    const milestone = checkMilestone(previousLP, newLP);
    
    if (milestone.type === 'rank' && milestone.newRankName) {
      setRankCelebration({
        isOpen: true,
        newRankName: milestone.newRankName,
      });
    } else if (milestone.type === 'star' && milestone.newStars !== undefined) {
      const rank = getRank(newLP);
      setStarCelebration({
        isOpen: true,
        rankName: rank.name,
        newStars: milestone.newStars,
      });
    }
  }, []);

  return (
    <CelebrationContext.Provider value={{ checkAndTrigger }}>
      {children}
      
      <StarCelebration
        isOpen={starCelebration.isOpen}
        onClose={() => setStarCelebration(prev => ({ ...prev, isOpen: false }))}
        rankName={starCelebration.rankName}
        newStars={starCelebration.newStars}
      />
      
      <RankCelebration
        isOpen={rankCelebration.isOpen}
        onClose={() => setRankCelebration(prev => ({ ...prev, isOpen: false }))}
        newRankName={rankCelebration.newRankName}
      />
    </CelebrationContext.Provider>
  );
}
