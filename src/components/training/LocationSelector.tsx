import { ChevronRight, Home, TreePine, Dumbbell } from 'lucide-react';
import type { TrainingLocation } from '@/lib/exerciseLocations';

import homeBg from '@/assets/location-home-bg.jpg';
import streetBg from '@/assets/location-street-bg.jpg';
import gymBg from '@/assets/location-gym-bg.jpg';

interface LocationSelectorProps {
  onSelect: (location: TrainingLocation) => void;
}

const locations = [
  {
    id: 'home' as TrainingLocation,
    title: 'HOME',
    subtitle: 'Work out with minimal equipment',
    bg: homeBg,
    gradient: 'from-amber-900/80',
    Icon: Home,
  },
  {
    id: 'street' as TrainingLocation,
    title: 'STREET',
    subtitle: 'Calisthenics & outdoor exercises',
    bg: streetBg,
    gradient: 'from-teal-900/80',
    Icon: TreePine,
  },
  {
    id: 'gym' as TrainingLocation,
    title: 'GYM',
    subtitle: 'Full equipment workout',
    bg: gymBg,
    gradient: 'from-blue-900/80',
    Icon: Dumbbell,
  },
];

export function LocationSelector({ onSelect }: LocationSelectorProps) {
  return (
    <div className="space-y-4 animate-fade-in">
      <p className="text-sm text-muted-foreground text-center mb-2">
        Choose your training environment
      </p>
      {locations.map((loc, i) => (
        <button
          key={loc.id}
          onClick={() => onSelect(loc.id)}
          className="relative w-full h-32 rounded-2xl overflow-hidden group animate-fade-in"
          style={{ animationDelay: `${i * 0.1}s` }}
        >
          <img
            src={loc.bg}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <div className={`absolute inset-0 bg-gradient-to-r ${loc.gradient} to-transparent`} />
          <div className="relative z-10 h-full flex items-center px-5 gap-4">
            <div className="w-12 h-12 rounded-xl bg-foreground/10 backdrop-blur-sm flex items-center justify-center border border-foreground/10">
              <loc.Icon className="w-6 h-6 text-foreground" />
            </div>
            <div className="text-left">
              <h3 className="text-xl font-display font-bold text-foreground">
                {loc.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {loc.subtitle}
              </p>
            </div>
          </div>
          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-foreground opacity-60 group-hover:opacity-100 transition-opacity" />
        </button>
      ))}
    </div>
  );
}
