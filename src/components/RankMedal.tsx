import { cn } from '@/lib/utils';

interface RankMedalProps {
  rank: string;
  stars?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showStars?: boolean;
  className?: string;
  animated?: boolean;
}

// Medal configurations for each rank with metallic gradients and colors
const MEDAL_CONFIGS = {
  Cub: {
    primary: '#8B6914',
    secondary: '#CD853F',
    accent: '#D2691E',
    glow: 'rgba(139, 105, 20, 0.4)',
    metallic: ['#CD853F', '#8B6914', '#A0752D', '#CD853F'],
  },
  Scout: {
    primary: '#4A5568',
    secondary: '#718096',
    accent: '#A0AEC0',
    glow: 'rgba(113, 128, 150, 0.4)',
    metallic: ['#A0AEC0', '#718096', '#4A5568', '#718096'],
  },
  Hunter: {
    primary: '#B7791F',
    secondary: '#D69E2E',
    accent: '#ECC94B',
    glow: 'rgba(214, 158, 46, 0.4)',
    metallic: ['#ECC94B', '#D69E2E', '#B7791F', '#D69E2E'],
  },
  Warrior: {
    primary: '#9B2C2C',
    secondary: '#C53030',
    accent: '#F56565',
    glow: 'rgba(197, 48, 48, 0.5)',
    metallic: ['#F56565', '#C53030', '#9B2C2C', '#C53030'],
  },
  Guardian: {
    primary: '#2B6CB0',
    secondary: '#3182CE',
    accent: '#63B3ED',
    glow: 'rgba(49, 130, 206, 0.4)',
    metallic: ['#63B3ED', '#3182CE', '#2B6CB0', '#3182CE'],
  },
  Champion: {
    primary: '#B7791F',
    secondary: '#D69E2E',
    accent: '#F6E05E',
    glow: 'rgba(246, 224, 94, 0.5)',
    metallic: ['#F6E05E', '#ECC94B', '#D69E2E', '#F6E05E'],
  },
  Elite: {
    primary: '#6B46C1',
    secondary: '#805AD5',
    accent: '#B794F4',
    glow: 'rgba(128, 90, 213, 0.5)',
    metallic: ['#B794F4', '#805AD5', '#6B46C1', '#805AD5'],
  },
  Alpha: {
    primary: '#97266D',
    secondary: '#B83280',
    accent: '#ED64A6',
    glow: 'rgba(184, 50, 128, 0.5)',
    metallic: ['#ED64A6', '#D53F8C', '#B83280', '#ED64A6'],
  },
  Legendary: {
    primary: '#B7791F',
    secondary: '#D69E2E',
    accent: '#F6E05E',
    glow: 'rgba(246, 224, 94, 0.6)',
    metallic: ['#FFD700', '#FFA500', '#DAA520', '#FFD700'],
    hasWings: true,
    hasCrystals: true,
  },
};

const SIZE_MAP = {
  sm: { width: 48, height: 48, lionScale: 0.4, starSize: 8 },
  md: { width: 80, height: 80, lionScale: 0.6, starSize: 12 },
  lg: { width: 120, height: 120, lionScale: 0.8, starSize: 16 },
  xl: { width: 200, height: 200, lionScale: 1, starSize: 24 },
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
  
  return (
    <div 
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: sizeConfig.width, height: sizeConfig.height }}
    >
      {/* Glow effect */}
      <div 
        className={cn("absolute inset-0 rounded-full blur-xl", animated && "animate-pulse-slow")}
        style={{ 
          background: `radial-gradient(circle, ${config.glow} 0%, transparent 70%)`,
        }}
      />
      
      <svg 
        viewBox="0 0 100 100" 
        className="w-full h-full relative z-10"
        style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' }}
      >
        <defs>
          {/* Metallic gradient */}
          <linearGradient id={`medal-gradient-${rank}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={config.metallic[0]} />
            <stop offset="30%" stopColor={config.metallic[1]} />
            <stop offset="70%" stopColor={config.metallic[2]} />
            <stop offset="100%" stopColor={config.metallic[3]} />
          </linearGradient>
          
          {/* Shine effect */}
          <linearGradient id={`shine-${rank}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="white" stopOpacity="0.4" />
            <stop offset="50%" stopColor="white" stopOpacity="0" />
            <stop offset="100%" stopColor="white" stopOpacity="0.2" />
          </linearGradient>
          
          {/* Inner shadow */}
          <radialGradient id={`inner-shadow-${rank}`} cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="white" stopOpacity="0.3" />
            <stop offset="100%" stopColor="black" stopOpacity="0.3" />
          </radialGradient>

          {/* Gold star gradient */}
          <linearGradient id={`star-gradient-${rank}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="50%" stopColor="#FFA500" />
            <stop offset="100%" stopColor="#FFD700" />
          </linearGradient>
        </defs>

        {/* Wings for Legendary */}
        {isLegendary && (
          <>
            <path 
              d="M5 50 Q15 35, 30 45 Q20 50, 25 55 Q10 55, 5 50" 
              fill={`url(#medal-gradient-${rank})`}
              stroke={config.primary}
              strokeWidth="0.5"
            />
            <path 
              d="M95 50 Q85 35, 70 45 Q80 50, 75 55 Q90 55, 95 50" 
              fill={`url(#medal-gradient-${rank})`}
              stroke={config.primary}
              strokeWidth="0.5"
            />
          </>
        )}

        {/* Outer decorative ring */}
        <circle 
          cx="50" cy="50" r="40" 
          fill="none" 
          stroke={`url(#medal-gradient-${rank})`}
          strokeWidth="4"
        />
        
        {/* Decorative points around */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
          <polygon
            key={i}
            points="50,8 53,14 47,14"
            fill={`url(#medal-gradient-${rank})`}
            transform={`rotate(${angle} 50 50)`}
          />
        ))}

        {/* Main medal body */}
        <circle 
          cx="50" cy="50" r="35" 
          fill={`url(#medal-gradient-${rank})`}
        />
        
        {/* Inner ring */}
        <circle 
          cx="50" cy="50" r="30" 
          fill={config.primary}
          stroke={config.secondary}
          strokeWidth="2"
        />
        
        {/* Inner shadow overlay */}
        <circle 
          cx="50" cy="50" r="30" 
          fill={`url(#inner-shadow-${rank})`}
        />

        {/* Lion head - stylized */}
        <g transform="translate(50, 48) scale(0.45)">
          {/* Mane */}
          <ellipse cx="0" cy="0" rx="38" ry="35" fill={config.accent} />
          <ellipse cx="0" cy="0" rx="32" ry="30" fill={config.secondary} />
          
          {/* Face */}
          <ellipse cx="0" cy="5" rx="24" ry="22" fill={config.secondary} />
          <ellipse cx="0" cy="5" rx="20" ry="18" fill={config.accent} opacity="0.7" />
          
          {/* Eyes */}
          <ellipse cx="-8" cy="-2" rx="4" ry="3" fill="#1a1a1a" />
          <ellipse cx="8" cy="-2" rx="4" ry="3" fill="#1a1a1a" />
          <circle cx="-7" cy="-3" r="1.5" fill="white" opacity="0.8" />
          <circle cx="9" cy="-3" r="1.5" fill="white" opacity="0.8" />
          
          {/* Nose */}
          <ellipse cx="0" cy="8" rx="5" ry="4" fill={config.primary} />
          <ellipse cx="0" cy="7" rx="3" ry="2" fill="#1a1a1a" />
          
          {/* Mouth lines */}
          <path d="M0 11 L0 16" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M0 16 Q-6 20, -10 18" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M0 16 Q6 20, 10 18" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          
          {/* Brows */}
          <path d="M-12 -8 Q-8 -12, -4 -8" stroke={config.primary} strokeWidth="2" fill="none" />
          <path d="M12 -8 Q8 -12, 4 -8" stroke={config.primary} strokeWidth="2" fill="none" />
        </g>

        {/* Shine overlay */}
        <ellipse 
          cx="40" cy="35" rx="15" ry="10" 
          fill="white" 
          opacity="0.15"
          transform="rotate(-30 40 35)"
        />

        {/* Top crown/gem for higher ranks */}
        {['Guardian', 'Champion', 'Elite', 'Alpha', 'Legendary'].includes(rank) && (
          <polygon
            points="50,5 54,12 46,12"
            fill={rank === 'Legendary' ? '#FFD700' : config.accent}
            stroke={config.primary}
            strokeWidth="0.5"
          />
        )}

        {/* Crystals for Legendary */}
        {isLegendary && (
          <>
            <polygon points="25,20 30,10 35,20" fill="#9F7AEA" stroke="#6B46C1" strokeWidth="0.5" />
            <polygon points="65,20 70,10 75,20" fill="#63B3ED" stroke="#2B6CB0" strokeWidth="0.5" />
          </>
        )}
      </svg>

      {/* Stars display */}
      {showStars && stars > 0 && rank !== 'Legendary' && (
        <div 
          className="absolute flex gap-0.5 justify-center"
          style={{ 
            bottom: size === 'sm' ? '-4px' : size === 'md' ? '-6px' : '-10px',
          }}
        >
          {Array.from({ length: stars }).map((_, i) => (
            <svg 
              key={i}
              viewBox="0 0 24 24" 
              style={{ 
                width: sizeConfig.starSize, 
                height: sizeConfig.starSize,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
              }}
            >
              <defs>
                <linearGradient id={`star-fill-${rank}-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFD700" />
                  <stop offset="50%" stopColor="#FFA500" />
                  <stop offset="100%" stopColor="#FFD700" />
                </linearGradient>
              </defs>
              <polygon
                points="12,2 15,9 22,9 17,14 19,22 12,17 5,22 7,14 2,9 9,9"
                fill={`url(#star-fill-${rank}-${i})`}
                stroke="#B7791F"
                strokeWidth="0.5"
              />
            </svg>
          ))}
        </div>
      )}
    </div>
  );
}
