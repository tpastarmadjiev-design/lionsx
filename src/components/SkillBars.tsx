import { Dumbbell, Heart, Wind, TrendingUp } from 'lucide-react';

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
      bgColor: 'bg-strength/20',
      color: 'text-strength',
    },
    {
      name: 'Endurance',
      value: endurance,
      icon: Heart,
      gradient: 'bg-gradient-to-r from-endurance to-blue-400',
      bgColor: 'bg-endurance/20',
      color: 'text-endurance',
    },
    {
      name: 'Mobility',
      value: mobility,
      icon: Wind,
      gradient: 'bg-gradient-to-r from-mobility to-emerald-400',
      bgColor: 'bg-mobility/20',
      color: 'text-mobility',
    },
  ];

  const totalXP = strength + endurance + mobility;

  return (
    <div className="lion-card space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-display font-semibold text-foreground">Skills</h3>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <TrendingUp className="w-4 h-4" />
          <span className="font-display font-bold text-foreground">{totalXP.toLocaleString()}</span>
          <span>total XP</span>
        </div>
      </div>
      
      <div className="space-y-4">
        {skills.map((skill) => {
          const Icon = skill.icon;
          const percentage = Math.min(100, (skill.value / MAX_SKILL) * 100);
          
          return (
            <div key={skill.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg ${skill.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${skill.color}`} />
                  </div>
                  <span className="text-sm font-medium text-foreground">{skill.name}</span>
                </div>
                <div className="text-right">
                  <span className={`text-lg font-display font-bold ${skill.color}`}>
                    {skill.value.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">XP</span>
                </div>
              </div>
              <div className="skill-bar h-2">
                <div
                  className={`skill-bar-fill ${skill.gradient} transition-all duration-500`}
                  style={{ width: `${Math.max(2, percentage)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{Math.round(percentage)}% to max</span>
                <span>{(MAX_SKILL - skill.value).toLocaleString()} XP to go</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
