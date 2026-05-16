import { Dumbbell, Heart, Wind } from 'lucide-react';

interface CircularSkillProgressProps {
  value: number;
  maxValue: number;
  label: string;
  type: 'strength' | 'endurance' | 'mobility';
}

const SKILL_CONFIG = {
  strength: {
    icon: Dumbbell,
    color: 'hsl(var(--strength))',
    bgColor: 'hsl(var(--strength) / 0.2)',
  },
  endurance: {
    icon: Heart,
    color: 'hsl(var(--endurance))',
    bgColor: 'hsl(var(--endurance) / 0.2)',
  },
  mobility: {
    icon: Wind,
    color: 'hsl(var(--mobility))',
    bgColor: 'hsl(var(--mobility) / 0.2)',
  },
};

export function CircularSkillProgress({ value, maxValue, label, type }: CircularSkillProgressProps) {
  const config = SKILL_CONFIG[type];
  const Icon = config.icon;
  const percentage = Math.min(100, Math.round((value / maxValue) * 100));
  
  // SVG circle calculations
  const size = 80;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background circle */}
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={config.bgColor}
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={config.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-display font-bold text-foreground">
            {percentage}%
          </span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground capitalize">{label}</span>
    </div>
  );
}
