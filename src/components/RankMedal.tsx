import { cn } from '@/lib/utils';
import cubMedalImage from '@/assets/cub-medal.jpg';

interface RankMedalProps {
  rank: string;
  stars?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showStars?: boolean;
  className?: string;
  animated?: boolean;
}

// Aggressive medal configurations with bold metallic colors
const MEDAL_CONFIGS = {
  Cub: {
    primary: '#5C4033',
    secondary: '#8B6914',
    accent: '#A0752D',
    glow: 'rgba(139, 105, 20, 0.5)',
    innerGlow: '#CD853F',
  },
  Scout: {
    primary: '#2D3748',
    secondary: '#4A5568',
    accent: '#718096',
    glow: 'rgba(74, 85, 104, 0.5)',
    innerGlow: '#A0AEC0',
  },
  Hunter: {
    primary: '#744210',
    secondary: '#975A16',
    accent: '#D69E2E',
    glow: 'rgba(151, 90, 22, 0.6)',
    innerGlow: '#ECC94B',
  },
  Warrior: {
    primary: '#742A2A',
    secondary: '#9B2C2C',
    accent: '#E53E3E',
    glow: 'rgba(155, 44, 44, 0.6)',
    innerGlow: '#FC8181',
  },
  Guardian: {
    primary: '#1A365D',
    secondary: '#2B6CB0',
    accent: '#4299E1',
    glow: 'rgba(43, 108, 176, 0.6)',
    innerGlow: '#90CDF4',
  },
  Champion: {
    primary: '#744210',
    secondary: '#B7791F',
    accent: '#ECC94B',
    glow: 'rgba(183, 121, 31, 0.7)',
    innerGlow: '#F6E05E',
  },
  Elite: {
    primary: '#44337A',
    secondary: '#6B46C1',
    accent: '#9F7AEA',
    glow: 'rgba(107, 70, 193, 0.7)',
    innerGlow: '#D6BCFA',
  },
  Alpha: {
    primary: '#521B41',
    secondary: '#97266D',
    accent: '#ED64A6',
    glow: 'rgba(151, 38, 109, 0.7)',
    innerGlow: '#F687B3',
  },
  Legendary: {
    primary: '#744210',
    secondary: '#D69E2E',
    accent: '#F6E05E',
    glow: 'rgba(246, 224, 94, 0.8)',
    innerGlow: '#FEFCBF',
  },
};

const SIZE_MAP = {
  sm: { width: 48, height: 56, starSize: 8 },
  md: { width: 80, height: 94, starSize: 12 },
  lg: { width: 120, height: 140, starSize: 16 },
  xl: { width: 200, height: 234, starSize: 24 },
};

// Ranks that use custom images instead of SVG
const IMAGE_MEDALS: Record<string, string> = {
  Cub: cubMedalImage,
};

export function RankMedal({ 
  rank, 
  stars = 0, 
  size = 'md', 
  showStars = true,
  className,
  animated = false,
}: RankMedalProps) {
  const config = MEDAL_CONFIGS[rank as keyof typeof MEDAL_CONFIGS] || MEDAL_CONFIGS.Cub;
  const sizeConfig = SIZE_MAP[size];
  const isLegendary = rank === 'Legendary';
  const hasCustomImage = IMAGE_MEDALS[rank];
  
  // If this rank has a custom image, render image instead of SVG
  if (hasCustomImage) {
    return (
      <div 
        className={cn("relative inline-flex items-center justify-center", className)}
        style={{ width: sizeConfig.width, height: sizeConfig.height }}
      >
        {/* Outer glow */}
        <div 
          className={cn("absolute inset-0 blur-xl", animated && "animate-pulse")}
          style={{ 
            background: `radial-gradient(ellipse at center, ${config.glow} 0%, transparent 70%)`,
          }}
        />
        
        <img 
          src={hasCustomImage}
          alt={`${rank} medal`}
          className="w-full h-full object-contain relative z-10"
          style={{ filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.5))' }}
        />

        {/* Stars display at bottom */}
        {showStars && stars > 0 && rank !== 'Legendary' && (
          <div 
            className="absolute flex gap-0.5 justify-center"
            style={{ 
              bottom: size === 'sm' ? '-2px' : size === 'md' ? '-4px' : '-8px',
            }}
          >
            {Array.from({ length: stars }).map((_, i) => (
              <svg 
                key={i}
                viewBox="0 0 24 24" 
                style={{ 
                  width: sizeConfig.starSize, 
                  height: sizeConfig.starSize,
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                }}
              >
                <defs>
                  <linearGradient id={`star-gold-img-${rank}-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFD700" />
                    <stop offset="50%" stopColor="#FFA500" />
                    <stop offset="100%" stopColor="#FFD700" />
                  </linearGradient>
                </defs>
                <polygon
                  points="12,2 15,9 22,9 17,14 19,22 12,17 5,22 7,14 2,9 9,9"
                  fill={`url(#star-gold-img-${rank}-${i})`}
                  stroke="#B7791F"
                  strokeWidth="1"
                />
              </svg>
            ))}
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div 
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: sizeConfig.width, height: sizeConfig.height }}
    >
      {/* Outer glow */}
      <div 
        className={cn("absolute inset-0 blur-xl", animated && "animate-pulse")}
        style={{ 
          background: `radial-gradient(ellipse at center, ${config.glow} 0%, transparent 70%)`,
        }}
      />
      
      <svg 
        viewBox="0 0 100 117" 
        className="w-full h-full relative z-10"
        style={{ filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.5))' }}
      >
        <defs>
          {/* Main metallic gradient */}
          <linearGradient id={`medal-main-${rank}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={config.accent} />
            <stop offset="25%" stopColor={config.secondary} />
            <stop offset="50%" stopColor={config.primary} />
            <stop offset="75%" stopColor={config.secondary} />
            <stop offset="100%" stopColor={config.accent} />
          </linearGradient>
          
          {/* Inner face gradient */}
          <radialGradient id={`medal-face-${rank}`} cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor={config.innerGlow} stopOpacity="0.4" />
            <stop offset="50%" stopColor={config.secondary} />
            <stop offset="100%" stopColor={config.primary} />
          </radialGradient>
          
          {/* Shine effect */}
          <linearGradient id={`shine-${rank}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="white" stopOpacity="0.5" />
            <stop offset="50%" stopColor="white" stopOpacity="0" />
            <stop offset="100%" stopColor="white" stopOpacity="0.2" />
          </linearGradient>

          {/* Star gradient */}
          <linearGradient id={`star-gold-${rank}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="50%" stopColor="#FFA500" />
            <stop offset="100%" stopColor="#FFD700" />
          </linearGradient>
        </defs>

        {/* Medal ribbon/banner at top */}
        <path 
          d="M25,0 L75,0 L80,8 L75,16 L25,16 L20,8 Z" 
          fill={`url(#medal-main-${rank})`}
          stroke={config.primary}
          strokeWidth="1"
        />
        
        {/* Ribbon tails */}
        <path 
          d="M20,8 L10,4 L12,12 L20,8" 
          fill={config.secondary}
          stroke={config.primary}
          strokeWidth="0.5"
        />
        <path 
          d="M80,8 L90,4 L88,12 L80,8" 
          fill={config.secondary}
          stroke={config.primary}
          strokeWidth="0.5"
        />

        {/* Main shield body - aggressive angular shape */}
        <path 
          d="M15,20 L50,12 L85,20 L85,55 L75,75 L50,95 L25,75 L15,55 Z" 
          fill={`url(#medal-face-${rank})`}
          stroke={`url(#medal-main-${rank})`}
          strokeWidth="3"
        />
        
        {/* Inner shield border */}
        <path 
          d="M22,26 L50,20 L78,26 L78,52 L70,68 L50,85 L30,68 L22,52 Z" 
          fill="none"
          stroke={config.accent}
          strokeWidth="1.5"
          opacity="0.6"
        />

        {/* Aggressive claw marks / battle scars */}
        <g opacity="0.3">
          <path 
            d="M30,35 L45,55" 
            stroke={config.innerGlow}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path 
            d="M35,32 L50,52" 
            stroke={config.innerGlow}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path 
            d="M40,30 L55,50" 
            stroke={config.innerGlow}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>

        {/* Central aggressive emblem - fangs/spikes */}
        <g transform="translate(50, 52)">
          {/* Center spike */}
          <polygon 
            points="0,-25 5,-8 0,-12 -5,-8" 
            fill={config.accent}
            stroke={config.primary}
            strokeWidth="0.5"
          />
          
          {/* Side fangs */}
          <polygon 
            points="-18,-15 -8,-5 -12,0 -20,-8" 
            fill={config.accent}
            stroke={config.primary}
            strokeWidth="0.5"
          />
          <polygon 
            points="18,-15 8,-5 12,0 20,-8" 
            fill={config.accent}
            stroke={config.primary}
            strokeWidth="0.5"
          />
          
          {/* Lower fangs */}
          <polygon 
            points="-12,5 -5,10 -8,18 -15,12" 
            fill={config.secondary}
            stroke={config.primary}
            strokeWidth="0.5"
          />
          <polygon 
            points="12,5 5,10 8,18 15,12" 
            fill={config.secondary}
            stroke={config.primary}
            strokeWidth="0.5"
          />
          
          {/* Center diamond */}
          <polygon 
            points="0,-8 8,0 0,8 -8,0" 
            fill={config.innerGlow}
            stroke={config.accent}
            strokeWidth="1"
          />
        </g>

        {/* Corner spikes for higher ranks */}
        {['Guardian', 'Champion', 'Elite', 'Alpha', 'Legendary'].includes(rank) && (
          <>
            <polygon 
              points="15,20 8,28 15,32 20,25" 
              fill={config.accent}
              stroke={config.primary}
              strokeWidth="0.5"
            />
            <polygon 
              points="85,20 92,28 85,32 80,25" 
              fill={config.accent}
              stroke={config.primary}
              strokeWidth="0.5"
            />
          </>
        )}

        {/* Additional spikes for Elite+ */}
        {['Elite', 'Alpha', 'Legendary'].includes(rank) && (
          <>
            <polygon 
              points="25,75 18,80 25,88 30,82" 
              fill={config.accent}
              stroke={config.primary}
              strokeWidth="0.5"
            />
            <polygon 
              points="75,75 82,80 75,88 70,82" 
              fill={config.accent}
              stroke={config.primary}
              strokeWidth="0.5"
            />
          </>
        )}

        {/* Crown for Legendary */}
        {isLegendary && (
          <g transform="translate(50, 8)">
            <polygon 
              points="0,-8 -12,0 -8,0 -6,-4 0,-2 6,-4 8,0 12,0" 
              fill="#FFD700"
              stroke="#B7791F"
              strokeWidth="0.5"
            />
            <circle cx="-6" cy="-5" r="2" fill="#FF6B6B" />
            <circle cx="0" cy="-8" r="2" fill="#4ECDC4" />
            <circle cx="6" cy="-5" r="2" fill="#9F7AEA" />
          </g>
        )}

        {/* Shine overlay */}
        <path 
          d="M22,26 L50,20 L60,24 L30,40 L22,35 Z" 
          fill="white"
          opacity="0.15"
        />

        {/* Bottom point decoration */}
        <polygon 
          points="50,95 45,100 50,110 55,100" 
          fill={`url(#medal-main-${rank})`}
          stroke={config.primary}
          strokeWidth="1"
        />
      </svg>

      {/* Stars display at bottom */}
      {showStars && stars > 0 && rank !== 'Legendary' && (
        <div 
          className="absolute flex gap-0.5 justify-center"
          style={{ 
            bottom: size === 'sm' ? '-2px' : size === 'md' ? '-4px' : '-8px',
          }}
        >
          {Array.from({ length: stars }).map((_, i) => (
            <svg 
              key={i}
              viewBox="0 0 24 24" 
              style={{ 
                width: sizeConfig.starSize, 
                height: sizeConfig.starSize,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
              }}
            >
              <polygon
                points="12,2 15,9 22,9 17,14 19,22 12,17 5,22 7,14 2,9 9,9"
                fill={`url(#star-gold-${rank})`}
                stroke="#B7791F"
                strokeWidth="1"
              />
            </svg>
          ))}
        </div>
      )}
    </div>
  );
}
