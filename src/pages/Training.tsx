import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useExercises, Exercise } from '@/hooks/useExercises';
import { useTrackScreen } from '@/hooks/useAnalyticsTracker';
import { AppLayout } from '@/components/AppLayout';
import { TimedTrainingFlow } from '@/components/TimedTrainingFlow';
import { RunningTracker } from '@/components/RunningTracker';
import { Button } from '@/components/ui/button';
import { Dumbbell, Heart, Wind, Zap, Play, Timer, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';


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
  const { profile, addLP, getRemainingDailyLP, dailyLPCap } = useProfile();
  const { exercisesByCategory, isLoading, logTraining } = useExercises();
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [showFlow, setShowFlow] = useState(false);
  const navigate = useNavigate();

  useTrackScreen('training');

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

  const handleComplete = async (reps: number, skillXP: { strength: number; endurance: number; mobility: number }) => {
    if (!selectedExercise) return;
    
    try {
      // Add LP with skill distribution
      await addLP.mutateAsync({
        lp: reps,
        skillXP,
      });

      // Log the training
      await logTraining.mutateAsync({
        exerciseId: selectedExercise.id,
        lpEarned: reps,
        proofType: 'timed',
      });
    } catch (error) {
      console.error('Error completing training:', error);
    }
    
    setShowFlow(false);
    setSelectedExercise(null);
  };

  const handleCancel = () => {
    setShowFlow(false);
  };

  const remainingDaily = getRemainingDailyLP();

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-display text-xl">Loading...</div>
      </div>
    );
  }

  if (showFlow && selectedExercise) {
    const isRunning = selectedExercise.name.toLowerCase() === 'running';
    const isCycling = selectedExercise.name.toLowerCase() === 'cycling';
    
    if (isRunning || isCycling) {
      return (
        <RunningTracker
          exercise={selectedExercise}
          remainingDailyLP={remainingDaily}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      );
    }
    
    return (
      <TimedTrainingFlow
        exercise={selectedExercise}
        remainingDailyLP={remainingDaily}
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
        
        {/* Progress bar */}
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((dailyLPCap - remainingDaily) / dailyLPCap) * 100}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {dailyLPCap - remainingDaily} / {dailyLPCap} LP earned today
        </p>
      </div>

      {/* Info Card */}
      <div className="lion-card p-4 mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
            <Timer className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">60-Second Challenge</p>
            <p className="text-xs text-muted-foreground">Each rep/second = 1 LP. AI tracks your form!</p>
          </div>
        </div>
      </div>

      {/* Exercise Categories */}
      {(['strength', 'endurance', 'mobility'] as const).map((category, catIndex) => {
        const Icon = categoryIcons[category];
        const exercises = exercisesByCategory?.[category] || [];
        
        if (exercises.length === 0) return null;
        
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
                const isSelected = selectedExercise?.id === exercise.id;
                const isPlank = exercise.name.toLowerCase().includes('plank');
                const isRunning = exercise.name.toLowerCase() === 'running';
                const isCycling = exercise.name.toLowerCase() === 'cycling';
                const timedHoldNames = ['plank', 'wall sit', 'hip circles', 'shoulder stretch hold', 'deep squat hold', 'cobra stretch'];
                const isTimedHold = timedHoldNames.includes(exercise.name.toLowerCase());
                
                // Determine LP display text
                let lpText = '1 LP/rep';
                if (isTimedHold) lpText = '1 LP/2sec';
                if (isRunning || isCycling) lpText = '1 LP/20m';
                
                // Use different icon for running/cycling
                const isGPS = isRunning || isCycling;
                const ExerciseIcon = isGPS ? Navigation : Icon;
                
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
                        <ExerciseIcon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-foreground">{exercise.name}</p>
                        <p className="text-xs text-muted-foreground">{exercise.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-muted-foreground">
                        {lpText}
                      </span>
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
