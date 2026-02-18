import { Dumbbell, Heart, Wind, Navigation, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Exercise } from '@/hooks/useExercises';
import type { TrainingLocation } from '@/lib/exerciseLocations';

const categoryIcons = {
  strength: Dumbbell,
  endurance: Heart,
  mobility: Wind,
};

const categoryColors = {
  strength: 'text-strength bg-strength/20 border-strength/30',
  endurance: 'text-endurance bg-endurance/20 border-endurance/30',
  mobility: 'text-mobility bg-mobility/20 border-mobility/30',
};

const categoryBadge = {
  strength: 'bg-strength/15 text-strength',
  endurance: 'bg-endurance/15 text-endurance',
  mobility: 'bg-mobility/15 text-mobility',
};

interface ExerciseGridProps {
  exercises: Exercise[];
  selectedExercise: Exercise | null;
  onSelect: (exercise: Exercise) => void;
  onBack: () => void;
  location: TrainingLocation;
  remainingDaily: number;
}

const locationLabels: Record<TrainingLocation, string> = {
  home: 'Home',
  street: 'Street',
  gym: 'Gym',
};

export function ExerciseGrid({
  exercises,
  selectedExercise,
  onSelect,
  onBack,
  location,
  remainingDaily,
}: ExerciseGridProps) {
  // Group by category
  const grouped = exercises.reduce((acc, ex) => {
    if (!acc[ex.category]) acc[ex.category] = [];
    acc[ex.category].push(ex);
    return acc;
  }, {} as Record<string, Exercise[]>);

  return (
    <div className="animate-fade-in">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-medium">{locationLabels[location]} Exercises</span>
      </button>

      {(['strength', 'endurance', 'mobility'] as const).map((category) => {
        const exs = grouped[category];
        if (!exs || exs.length === 0) return null;
        const Icon = categoryIcons[category];

        return (
          <div key={category} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`w-5 h-5 ${categoryColors[category].split(' ')[0]}`} />
              <h2 className="text-lg font-display font-semibold text-foreground capitalize">
                {category}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {exs.map((exercise) => {
                const isSelected = selectedExercise?.id === exercise.id;
                const isRunning = exercise.name.toLowerCase() === 'running';
                const isCycling = exercise.name.toLowerCase() === 'cycling';
                const isGPS = isRunning || isCycling;
                const ExIcon = isGPS ? Navigation : categoryIcons[exercise.category as keyof typeof categoryIcons] || Dumbbell;

                return (
                  <button
                    key={exercise.id}
                    onClick={() => onSelect(exercise)}
                    disabled={remainingDaily <= 0}
                    className={cn(
                      "lion-card p-3 flex flex-col items-center gap-2 transition-all duration-200 text-center",
                      isSelected
                        ? "ring-2 ring-primary"
                        : "hover:bg-secondary/50",
                      remainingDaily <= 0 && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center border",
                      categoryColors[exercise.category as keyof typeof categoryColors]
                    )}>
                      <ExIcon className="w-5 h-5" />
                    </div>
                    <p className="font-medium text-foreground text-sm leading-tight">
                      {exercise.name}
                    </p>
                    <span className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full",
                      categoryBadge[exercise.category as keyof typeof categoryBadge]
                    )}>
                      {exercise.category}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
