import { useEffect, useState } from 'react';
import { RankMedal } from './RankMedal';
import { cn } from '@/lib/utils';

interface StarCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  rankName: string;
  newStars: number;
}

export function StarCelebration({ isOpen, onClose, rankName, newStars }: StarCelebrationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Slight delay for content animation
      setTimeout(() => setShowContent(true), 100);
    } else {
      setShowContent(false);
      setTimeout(() => setIsVisible(false), 300);
    }
  }, [isOpen]);

  if (!isVisible) return null;

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        "bg-background/90 backdrop-blur-md transition-opacity duration-300",
        showContent ? "opacity-100" : "opacity-0"
      )}
      onClick={onClose}
    >
      <div 
        className={cn(
          "flex flex-col items-center gap-6 p-8 max-w-sm w-full",
          "transition-all duration-500 ease-out",
          showContent ? "scale-100 opacity-100" : "scale-90 opacity-0"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-primary animate-float"
              style={{
                left: `${10 + Math.random() * 80}%`,
                top: `${10 + Math.random() * 80}%`,
                animationDelay: `${i * 0.2}s`,
                opacity: 0.5,
              }}
            />
          ))}
        </div>

        {/* Medal with new star highlighted */}
        <div className="relative">
          <RankMedal 
            rank={rankName} 
            stars={newStars} 
            size="xl" 
            animated
          />
          
          {/* Star glow highlight */}
          <div 
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-full flex justify-center"
          >
            <div className="animate-pulse-slow">
              <svg viewBox="0 0 24 24" className="w-10 h-10" style={{ filter: 'drop-shadow(0 0 12px gold)' }}>
                <defs>
                  <linearGradient id="new-star-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFD700" />
                    <stop offset="50%" stopColor="#FFA500" />
                    <stop offset="100%" stopColor="#FFD700" />
                  </linearGradient>
                </defs>
                <polygon
                  points="12,2 15,9 22,9 17,14 19,22 12,17 5,22 7,14 2,9 9,9"
                  fill="url(#new-star-glow)"
                  stroke="#B7791F"
                  strokeWidth="0.5"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="text-center mt-4">
          <h2 className="text-2xl font-display font-bold text-primary mb-2">
            Congratulations!
          </h2>
          <p className="text-muted-foreground">
            You've earned a star in your division.
          </p>
          <p className="text-sm text-primary/80 mt-2">
            {newStars} / 3 stars earned
          </p>
        </div>

        {/* Dismiss button */}
        <button
          onClick={onClose}
          className="mt-4 px-8 py-3 bg-primary text-primary-foreground rounded-xl font-display font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
