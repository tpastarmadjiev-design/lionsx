import { Dumbbell, Heart, Wind } from 'lucide-react';

interface SkillBarsProps {
  strength: number;
  endurance: number;
  mobility: number;
}

const MAX_SKILL = 10000; // Max points per skill for visual representation

export function SkillBars({ strength, endurance, mobility }: SkillBarsProps) {
  const skills = [
    {
      name: 'Strength',
      value: strength,
      icon: Dumbbell,
      gradient: 'bg-gradient-to-r from-strength to-red-400',
      color: 'text-strength',
    },
    {
      name: 'Endurance',
      value: endurance,
      icon: Heart,
      gradient: 'bg-gradient-to-r from-endurance to-blue-400',
      color: 'text-endurance',
    },
    {
      name: 'Mobility',
      value: mobility,
      icon: Wind,
      gradient: 'bg-gradient-to-r from-mobility to-emerald-400',
      color: 'text-mobility',
    },
  ];

  return (
    <div className="lion-card space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
      <h3 className="text-lg font-display font-semibold text-foreground">Skills</h3>
      
      <div className="space-y-4">
        {skills.map((skill) => {
          const Icon = skill.icon;
          const percentage = Math.min(100, (skill.value / MAX_SKILL) * 100);
          
          return (
            <div key={skill.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${skill.color}`} />
                  <span className="text-sm font-medium text-foreground">{skill.name}</span>
                </div>
                <span className={`text-sm font-display font-bold ${skill.color}`}>
                  {skill.value.toLocaleString()}
                </span>
              </div>
              <div className="skill-bar">
                <div
                  className={`skill-bar-fill ${skill.gradient}`}
                  style={{ width: `${Math.max(2, percentage)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
