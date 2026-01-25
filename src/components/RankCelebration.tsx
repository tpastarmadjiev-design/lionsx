import { useEffect, useState } from 'react';
import { RankMedal } from './RankMedal';
import { cn } from '@/lib/utils';
import { getRank } from '@/lib/ranks';

interface RankCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  newRankName: string;
}

export function RankCelebration({ isOpen, onClose, newRankName }: RankCelebrationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [showMedal, setShowMedal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Staggered animations for more dramatic effect
      setTimeout(() => setShowContent(true), 100);
      setTimeout(() => setShowMedal(true), 400);
    } else {
      setShowMedal(false);
      setShowContent(false);
      setTimeout(() => setIsVisible(false), 400);
    }
  }, [isOpen]);

  if (!isVisible) return null;

  const rank = getRank(Infinity); // Just to get rank colors - we pass the name directly

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        "bg-background/95 backdrop-blur-lg transition-opacity duration-500",
        showContent ? "opacity-100" : "opacity-0"
      )}
      onClick={onClose}
    >
      {/* Radial glow background */}
      <div 
        className={cn(
          "absolute inset-0 transition-opacity duration-1000",
          showMedal ? "opacity-100" : "opacity-0"
        )}
        style={{
          background: `radial-gradient(circle at center, hsl(var(--primary) / 0.2) 0%, transparent 60%)`,
        }}
      />

      {/* Particle effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 rounded-full bg-primary/60"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${2 + Math.random() * 2}s ease-in-out infinite`,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>

      <div 
        className={cn(
          "flex flex-col items-center gap-8 p-8 max-w-md w-full relative",
          "transition-all duration-700 ease-out",
          showContent ? "scale-100 opacity-100" : "scale-75 opacity-0"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Medal with dramatic entrance */}
        <div 
          className={cn(
            "relative transition-all duration-700 ease-out",
            showMedal ? "scale-100 opacity-100" : "scale-50 opacity-0"
          )}
        >
          {/* Outer glow ring */}
          <div 
            className={cn(
              "absolute inset-0 rounded-full blur-2xl transition-opacity duration-1000",
              showMedal ? "opacity-100" : "opacity-0"
            )}
            style={{
              background: `radial-gradient(circle, hsl(var(--primary) / 0.5) 0%, transparent 70%)`,
              transform: 'scale(1.5)',
            }}
          />
          
          {/* Shine sweep effect */}
          <div 
            className={cn(
              "absolute inset-0 rounded-full overflow-hidden",
              showMedal && "animate-shine-sweep"
            )}
            style={{ 
              background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)',
              transform: 'scale(1.2)',
            }}
          />

          <RankMedal 
            rank={newRankName} 
            stars={0} 
            size="xl" 
            showStars={false}
            animated
          />
        </div>

        {/* Message */}
        <div 
          className={cn(
            "text-center transition-all duration-500 delay-300",
            showMedal ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          <h2 className="text-3xl font-display font-bold text-primary mb-3">
            Congratulations!
          </h2>
          <p className="text-xl text-foreground">
            You are now <span className="text-primary font-bold">{newRankName}</span>.
          </p>
          <p className="text-muted-foreground mt-2">
            Keep training to reach the next level!
          </p>
        </div>

        {/* Dismiss button */}
        <button
          onClick={onClose}
          className={cn(
            "mt-4 px-10 py-4 bg-primary text-primary-foreground rounded-xl",
            "font-display font-bold uppercase tracking-wider text-lg",
            "transition-all hover:scale-105 active:scale-95 delay-500",
            showMedal ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          Let's Go!
        </button>
      </div>
    </div>
  );
}
