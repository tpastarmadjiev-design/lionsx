import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useExercises, Exercise } from '@/hooks/useExercises';
import { useTrackScreen } from '@/hooks/useAnalyticsTracker';
import { AppLayout } from '@/components/AppLayout';
import { TimedTrainingFlow } from '@/components/TimedTrainingFlow';
import { RunningTracker } from '@/components/RunningTracker';
import { TreadmillTracker } from '@/components/TreadmillTracker';
import { LocationSelector } from '@/components/training/LocationSelector';
import { ExerciseGrid } from '@/components/training/ExerciseGrid';
import { Button } from '@/components/ui/button';
import { Zap, Play, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TrainingLocation, filterExercisesByLocation } from '@/lib/exerciseLocations';
import { gaEvents } from '@/lib/gtag';
import {
  startTrainingSession,
  completeTrainingSession,
  updateStreak,
  markFirstSession,
  trackLocationPreference,
} from '@/lib/analyticsTracker';
import { useRef } from 'react';

export default function Training() {
  const { user, loading: authLoading } = useAuth();
  const { profile, addLP, getRemainingDailyLP, dailyLPCap } = useProfile();
  const { exercises, isLoading, logTraining } = useExercises();
  const [selectedLocation, setSelectedLocation] = useState<TrainingLocation | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [showFlow, setShowFlow] = useState(false);
  const analyticsSessionIdRef = useRef<string | null>(null);
  const sessionStartTimeRef = useRef<number>(0);
  const navigate = useNavigate();

  useTrackScreen('training');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleComplete = async (reps: number, skillXP: { strength: number; endurance: number; mobility: number }) => {
    if (!selectedExercise) return;
    try {
      await addLP.mutateAsync({ lp: reps, skillXP });
      await logTraining.mutateAsync({
        exerciseId: selectedExercise.id,
        lpEarned: reps,
        repsCompleted: reps,
        sessionDurationSeconds: 60,
        proofType: 'timed',
      });
      gaEvents.trainingCompleted(selectedExercise.name, reps, reps);

      // Analytics: complete session, update streak, mark first session
      if (user?.id) {
        const durationSeconds = Math.round((Date.now() - sessionStartTimeRef.current) / 1000);
        if (analyticsSessionIdRef.current) {
          completeTrainingSession(analyticsSessionIdRef.current, reps, reps, durationSeconds);
        }
        updateStreak(user.id);
        markFirstSession(user.id);
      }
    } catch (error) {
      console.error('Error completing training:', error);
    }
    analyticsSessionIdRef.current = null;
    setShowFlow(false);
    setSelectedExercise(null);
  };

  const handleCancel = () => {
    if (selectedExercise) gaEvents.trainingCancelled(selectedExercise.name);
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

  // Active training flow
  if (showFlow && selectedExercise) {
    const nameLower = selectedExercise.name.toLowerCase();
    const isRunning = nameLower === 'running';
    const isCycling = nameLower === 'cycling';
    const isTreadmill = nameLower === 'treadmill run';

    if (isTreadmill) {
      return (
        <TreadmillTracker
          exercise={selectedExercise}
          remainingDailyLP={remainingDaily}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      );
    }

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

  const filteredExercises = selectedLocation && exercises
    ? filterExercisesByLocation(exercises, selectedLocation)
    : [];

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

      {/* Location Selection or Exercise Grid */}
      {!selectedLocation ? (
        <LocationSelector onSelect={(loc) => {
          setSelectedLocation(loc);
          if (user?.id) trackLocationPreference(user.id, loc);
        }} />
      ) : (
        <ExerciseGrid
          exercises={filteredExercises}
          selectedExercise={selectedExercise}
          onSelect={setSelectedExercise}
          onBack={() => {
            setSelectedLocation(null);
            setSelectedExercise(null);
          }}
          location={selectedLocation}
          remainingDaily={remainingDaily}
        />
      )}

      {/* Start Button */}
      {selectedExercise && remainingDaily > 0 && (
        <div className="fixed bottom-24 left-4 right-4 z-40">
          <Button
            variant="hero"
            size="xl"
            className="w-full animate-slide-up"
            onClick={async () => {
              setShowFlow(true);
              sessionStartTimeRef.current = Date.now();
              if (user?.id && selectedExercise) {
                const sessionId = await startTrainingSession(user.id, selectedExercise.name, selectedLocation || undefined);
                analyticsSessionIdRef.current = sessionId;
              }
            }}
          >
            <Play className="w-5 h-5" />
            Start {selectedExercise.name}
          </Button>
        </div>
      )}
    </AppLayout>
  );
}
