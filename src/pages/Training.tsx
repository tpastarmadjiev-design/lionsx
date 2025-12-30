import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useExercises, Exercise } from '@/hooks/useExercises';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Dumbbell, Heart, Wind, Check, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DAILY_LP_CAP } from '@/lib/ranks';
import { useEffect } from 'react';

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
  const { profile, addLP } = useProfile();
  const { exercisesByCategory, logTraining, isLoading } = useExercises();
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [completing, setCompleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleComplete = async () => {
    if (!selectedExercise || !profile) return;
    
    setCompleting(true);
    try {
      await addLP.mutateAsync({
        lp: selectedExercise.lp_reward,
        category: selectedExercise.category as 'strength' | 'endurance' | 'mobility',
      });
      
      await logTraining.mutateAsync({
        exerciseId: selectedExercise.id,
        lpEarned: selectedExercise.lp_reward,
      });
      
      setSelectedExercise(null);
    } catch (error) {
      // Error handled in mutation
    } finally {
      setCompleting(false);
    }
  };

  const remainingDaily = profile ? Math.max(0, DAILY_LP_CAP - profile.daily_lp) : 0;

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-display text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <AppLayout title="Training">
      {/* Daily LP Status */}
      <div className="lion-card mb-6 flex items-center justify-between animate-fade-in">
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

      {/* Exercise Categories */}
      {(['strength', 'endurance', 'mobility'] as const).map((category, catIndex) => {
        const Icon = categoryIcons[category];
        const exercises = exercisesByCategory?.[category] || [];
        
        return (
          <div 
            key={category} 
            className="mb-6 animate-fade-in"
            style={{ animationDelay: `${catIndex * 0.1}s` }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`w-5 h-5 ${categoryColors[category].split(' ')[0]}`} />
              <h2 className="text-lg font-display font-semibold text-foreground capitalize">
                {category}
              </h2>
            </div>
            
            <div className="grid gap-2">
              {exercises.map((exercise) => (
                <button
                  key={exercise.id}
                  onClick={() => setSelectedExercise(exercise)}
                  disabled={remainingDaily <= 0}
                  className={cn(
                    "lion-card p-4 flex items-center justify-between transition-all duration-200",
                    selectedExercise?.id === exercise.id
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
                      +{exercise.lp_reward}
                    </span>
                    <p className="text-xs text-muted-foreground">LP</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* Complete Button */}
      {selectedExercise && remainingDaily > 0 && (
        <div className="fixed bottom-24 left-4 right-4 z-40">
          <Button
            variant="hero"
            size="xl"
            className="w-full animate-slide-up"
            onClick={handleComplete}
            disabled={completing}
          >
            <Check className="w-5 h-5" />
            {completing ? 'Completing...' : `Complete ${selectedExercise.name} (+${Math.min(selectedExercise.lp_reward, remainingDaily)} LP)`}
          </Button>
        </div>
      )}
    </AppLayout>
  );
}
