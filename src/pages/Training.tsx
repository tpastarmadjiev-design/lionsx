import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile, MAX_LP_PER_EXERCISE, PROOF_BONUS_LP } from '@/hooks/useProfile';
import { useExercises, Exercise } from '@/hooks/useExercises';
import { AppLayout } from '@/components/AppLayout';
import { TrainingFlow } from '@/components/TrainingFlow';
import { Button } from '@/components/ui/button';
import { Dumbbell, Heart, Wind, Zap, Play, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DAILY_LP_CAP } from '@/lib/ranks';

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

export default function Training() {
  const { user, loading: authLoading } = useAuth();
  const { profile, getNoProofRemaining } = useProfile();
  const { exercisesByCategory, isLoading } = useExercises();
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [showFlow, setShowFlow] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleStartTraining = () => {
    if (selectedExercise) {
      setShowFlow(true);
    }
  };

  const handleComplete = () => {
    setShowFlow(false);
    setSelectedExercise(null);
  };

  const handleCancel = () => {
    setShowFlow(false);
  };

  const remainingDaily = profile ? Math.max(0, DAILY_LP_CAP - profile.daily_lp) : 0;
  const noProofRemaining = getNoProofRemaining();

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-display text-xl">Loading...</div>
      </div>
    );
  }

  if (showFlow && selectedExercise) {
    return (
      <TrainingFlow
        exercise={selectedExercise}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <AppLayout title="Training">
      {/* Daily LP Status */}
      <div className="lion-card mb-4 animate-fade-in">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Daily LP Available</p>
              <p className="text-xs text-muted-foreground">Resets at midnight</p>
            </div>
          </div>
          <span className={cn(
            "text-2xl font-display font-bold",
            remainingDaily > 0 ? "text-primary" : "text-muted-foreground"
          )}>
            {remainingDaily}
          </span>
        </div>
        
        {/* No-proof remaining indicator */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 text-sm">
          <AlertCircle className={cn(
            "w-4 h-4",
            noProofRemaining > 0 ? "text-accent" : "text-destructive"
          )} />
          <span className="text-muted-foreground">
            No-proof exercises remaining: 
            <span className={cn(
              "ml-1 font-semibold",
              noProofRemaining > 0 ? "text-accent" : "text-destructive"
            )}>
              {noProofRemaining}/3
            </span>
          </span>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="lion-card p-3 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <p className="text-xs text-muted-foreground mb-1">Max per exercise</p>
          <p className="text-lg font-display font-bold text-foreground">{MAX_LP_PER_EXERCISE} LP</p>
        </div>
        <div className="lion-card p-3 animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <p className="text-xs text-muted-foreground mb-1">Proof bonus</p>
          <p className="text-lg font-display font-bold text-primary">+{PROOF_BONUS_LP} LP</p>
        </div>
      </div>

      {/* Exercise Categories */}
      {(['strength', 'endurance', 'mobility'] as const).map((category, catIndex) => {
        const Icon = categoryIcons[category];
        const exercises = exercisesByCategory?.[category] || [];
        
        return (
          <div 
            key={category} 
            className="mb-6 animate-fade-in"
            style={{ animationDelay: `${0.2 + catIndex * 0.1}s` }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`w-5 h-5 ${categoryColors[category].split(' ')[0]}`} />
              <h2 className="text-lg font-display font-semibold text-foreground capitalize">
                {category}
              </h2>
            </div>
            
            <div className="grid gap-2">
              {exercises.map((exercise) => {
                const baseLp = Math.min(exercise.lp_reward, MAX_LP_PER_EXERCISE);
                const isSelected = selectedExercise?.id === exercise.id;
                
                return (
                  <button
                    key={exercise.id}
                    onClick={() => setSelectedExercise(exercise)}
                    disabled={remainingDaily <= 0}
                    className={cn(
                      "lion-card p-4 flex items-center justify-between transition-all duration-200",
                      isSelected
                        ? "ring-2 ring-primary"
                        : "hover:bg-secondary/50",
                      remainingDaily <= 0 && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center border",
                        categoryColors[category]
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-foreground">{exercise.name}</p>
                        <p className="text-xs text-muted-foreground">{exercise.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-display font-bold text-primary">
                        +{baseLp}
                      </span>
                      <p className="text-xs text-muted-foreground">LP</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Start Button */}
      {selectedExercise && remainingDaily > 0 && (
        <div className="fixed bottom-24 left-4 right-4 z-40">
          <Button
            variant="hero"
            size="xl"
            className="w-full animate-slide-up"
            onClick={handleStartTraining}
          >
            <Play className="w-5 h-5" />
            Start {selectedExercise.name}
          </Button>
        </div>
      )}
    </AppLayout>
  );
}
