import { useState, useEffect, useCallback, useRef } from 'react';
import { Exercise } from '@/hooks/useExercises';
import { Button } from '@/components/ui/button';
import { PoseTracker } from '@/components/PoseTracker';
import { SuspiciousActivityWarning } from '@/components/SuspiciousActivityWarning';
import { 
  Play, 
  Check, 
  X, 
  Loader2,
  Dumbbell,
  Heart,
  Wind,
  Timer,
  Zap,
  Plus,
  Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DAILY_LP_CAP } from '@/lib/ranks';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  createSessionSuspicionTracker,
  getSuspicionFlags,
  computeSuspicionScore,
  getAverageAxisDistribution,
  getAverageTempo,
  type SessionSuspicionTracker,
} from '@/lib/antiCheat';

// Session-level flags: persist across exercise sessions until sign-out
let cameraPermissionGrantedThisSession = false;
let cameraPermissionDeniedThisSession = false;

// Call this on sign-out to reset the flags
export function resetCameraPermissionFlag() {
  cameraPermissionGrantedThisSession = false;
  cameraPermissionDeniedThisSession = false;
}

type FlowStep = 'ready' | 'camera-init' | 'camera-ready' | 'countdown' | 'active' | 'manual-input' | 'finish';

interface TimedTrainingFlowProps {
  exercise: Exercise;
  remainingDailyLP: number;
  onComplete: (reps: number, skillDistribution: { strength: number; endurance: number; mobility: number }) => void;
  onCancel: () => void;
}

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

const TIMER_DURATION = 60; // 60 seconds

// Map exercise names to PoseTracker exercise types
function getExerciseType(name: string): 'sit-ups' | 'push-ups' | 'jumps' | 'plank' | 'dips' | 'pull-ups' | 'bench-press' {
  const normalized = name.toLowerCase();
  if (normalized.includes('sit')) return 'sit-ups';
  if (normalized.includes('push')) return 'push-ups';
  if (normalized.includes('jump')) return 'jumps';
  if (normalized.includes('plank')) return 'plank';
  if (normalized.includes('dip')) return 'dips';
  if (normalized.includes('pull')) return 'pull-ups';
  if (normalized.includes('bench')) return 'bench-press';
  return 'push-ups'; // Default fallback
}

export function TimedTrainingFlow({ 
  exercise, 
  remainingDailyLP,
  onComplete, 
  onCancel 
}: TimedTrainingFlowProps) {
  // If permission was denied this session, skip straight to showing the denied message
  const initialStep: FlowStep = cameraPermissionDeniedThisSession 
    ? 'ready' // will show denied message
    : cameraPermissionGrantedThisSession 
      ? 'camera-init' 
      : 'ready';
  const [step, setStep] = useState<FlowStep>(initialStep);
  const [cameraActive, setCameraActive] = useState(cameraPermissionGrantedThisSession && !cameraPermissionDeniedThisSession);
  const [timeRemaining, setTimeRemaining] = useState(TIMER_DURATION);
  const [repCount, setRepCount] = useState(0);
  const [detectedReps, setDetectedReps] = useState(0);
  const [manualCount, setManualCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [showWarning, setShowWarning] = useState(false);
  const [countdownValue, setCountdownValue] = useState<number | string | null>(null);
  const warningShownRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const suspicionTrackerRef = useRef<SessionSuspicionTracker>(createSessionSuspicionTracker());
  const { user } = useAuth();
  
  const Icon = categoryIcons[exercise.category as keyof typeof categoryIcons];
  const colors = categoryColors[exercise.category as keyof typeof categoryColors];
  const isPlank = exercise.name.toLowerCase().includes('plank');
  const exerciseType = getExerciseType(exercise.name);
  
  // Calculate LP (capped by daily limit)
  const earnedLP = Math.min(repCount, remainingDailyLP);
  
  // Calculate skill distribution from exercise
  const skillDistribution = {
    strength: (exercise as any).skill_strength || 0,
    endurance: (exercise as any).skill_endurance || 0,
    mobility: (exercise as any).skill_mobility || 0,
  };

  // Log suspicion flags to database
  const logSuspicionFlags = useCallback(async () => {
    if (!user?.id) return;
    const tracker = suspicionTrackerRef.current;
    const flags = getSuspicionFlags(tracker);
    const score = computeSuspicionScore(flags);
    const axisDist = getAverageAxisDistribution(tracker);
    const avgTempo = getAverageTempo(tracker);
    const orientationChange = tracker.orientationSamples.length > 1
      ? Math.round(Math.max(...tracker.orientationSamples) - Math.min(...tracker.orientationSamples))
      : null;

    // Only log if any flags triggered or score > 0
    const anyFlag = Object.values(flags).some(Boolean);

    if (anyFlag || score > 0) {
      await supabase.from('suspicion_flags').insert({
        user_id: user.id,
        exercise_name: exercise.name,
        unrealistic_speed: flags.unrealisticSpeed,
        single_axis_motion: flags.singleAxisMotion,
        micro_movements: flags.microMovements,
        volume_spike: flags.volumeSpike,
        no_orientation_change: flags.noOrientationChange,
        suspicion_score: score,
        average_tempo: avgTempo,
        axis_distribution: axisDist,
        orientation_change: orientationChange,
        total_reps: tracker.totalReps,
      });

      // Show warning once per session
      if (!warningShownRef.current) {
        warningShownRef.current = true;
        setShowWarning(true);
      }
    }
  }, [user?.id, exercise.name]);

  // Step 1: User clicks "Start" -> request camera
  const handleInitCamera = useCallback(() => {
    setStep('camera-init');
    setCameraActive(true);
  }, []);

  // Step 2: Camera ready callback
  const handleCameraReady = useCallback(() => {
    cameraPermissionGrantedThisSession = true;
    setStep('camera-ready');
  }, []);

  // Step 3: Camera error -> mark denied for session, cancel and go back
  const handleCameraError = useCallback(() => {
    cameraPermissionDeniedThisSession = true;
    setCameraActive(false);
    onCancel();
  }, [onCancel]);

  // Step 4: User presses "Start Exercise" -> play countdown
  const handleStartCountdown = useCallback(() => {
    setStep('countdown');
    let count = 3;
    setCountdownValue(count);

    countdownRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdownValue(count);
      } else if (count === 0) {
        setCountdownValue('GO!');
      } else {
        clearInterval(countdownRef.current!);
        setCountdownValue(null);
        // Now start the actual exercise
        setStep('active');
        setTimeRemaining(TIMER_DURATION);
        setRepCount(0);
        setDetectedReps(0);
        setManualCount(0);
        suspicionTrackerRef.current = createSessionSuspicionTracker();

        timerRef.current = setInterval(() => {
          setTimeRemaining(prev => {
            if (prev <= 1) {
              clearInterval(timerRef.current!);
              setCameraActive(false);
              setDetectedReps(repCount);
              setStep('manual-input');
              logSuspicionFlags();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }, 1000);
  }, [repCount, logSuspicionFlags]);

  // Cleanup timer, countdown and camera on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCameraActive(false);
    };
  }, []);

  // Handle rep/second detected
  const handleRepComplete = useCallback(() => {
    setRepCount(prev => prev + 1);
  }, []);

  // For plank - each second counts as a rep
  const handleSecondComplete = useCallback(() => {
    setRepCount(prev => prev + 1);
  }, []);

  // Confirm reps and complete
  const handleConfirm = useCallback((finalCount: number) => {
    setIsSubmitting(true);
    
    // Cap LP by daily remaining
    const actualLP = Math.min(finalCount, remainingDailyLP);
    
    // Calculate skill XP based on distribution percentages
    const skillXP = {
      strength: Math.floor(actualLP * (skillDistribution.strength / 100)),
      endurance: Math.floor(actualLP * (skillDistribution.endurance / 100)),
      mobility: Math.floor(actualLP * (skillDistribution.mobility / 100)),
    };
    
    onComplete(actualLP, skillXP);
  }, [remainingDailyLP, skillDistribution, onComplete]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-lg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button 
          onClick={() => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
            setCameraActive(false);
            onCancel();
          }} 
          className="p-2 rounded-lg hover:bg-secondary"
        >
          <X className="w-6 h-6 text-muted-foreground" />
        </button>
        <h2 className="text-lg font-display font-semibold text-foreground">
          {step === 'active' ? 'GO!' : step === 'manual-input' ? 'Confirm Reps' : step === 'countdown' ? 'Get Ready!' : step === 'camera-init' ? 'Setting Up...' : step === 'camera-ready' ? 'Ready' : 'Training'}
        </h2>
        <div className="w-10" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
        
        {/* Single PoseTracker instance - persists across camera-init, camera-ready, countdown, active */}
        {(step === 'camera-init' || step === 'camera-ready' || step === 'countdown' || step === 'active') && (
          <div className="w-full max-w-sm mb-4 relative">
            {step === 'camera-init' && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/60 rounded-xl">
                <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                <p className="text-muted-foreground text-sm">Setting up camera...</p>
              </div>
            )}
            <PoseTracker
              exercise={exerciseType}
              isActive={cameraActive}
              onRepComplete={handleRepComplete}
              onSecondComplete={isPlank ? handleSecondComplete : undefined}
              suspicionTracker={suspicionTrackerRef.current}
              onCameraReady={handleCameraReady}
              onCameraError={handleCameraError}
            />
            {/* Countdown Overlay */}
            {step === 'countdown' && countdownValue !== null && (
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <span className="text-8xl font-display font-black text-primary drop-shadow-lg animate-pulse">
                  {countdownValue}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Ready Step */}
        {step === 'ready' && (
          <div className="w-full max-w-sm space-y-6 animate-fade-in">
            {/* Exercise Card */}
            <div className="lion-card p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center border", colors)}>
                  <Icon className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-display font-bold text-foreground">{exercise.name}</h3>
                  <p className="text-sm text-muted-foreground capitalize">{exercise.category}</p>
                </div>
              </div>
              
              {/* Info */}
              <div className="space-y-2 p-3 rounded-lg bg-secondary/50">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Timer className="w-4 h-4" />
                    Duration
                  </span>
                  <span className="font-medium text-foreground">60 seconds</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    {isPlank ? 'Each second' : 'Each rep'}
                  </span>
                  <span className="font-medium text-primary">= 1 LP</span>
                </div>
              </div>
            </div>
            
            {/* Daily LP remaining */}
            <div className="text-center text-sm text-muted-foreground">
              Daily LP remaining: <span className="text-primary font-semibold">{remainingDailyLP} / {DAILY_LP_CAP}</span>
            </div>

            {/* Camera denied message */}
            {cameraPermissionDeniedThisSession && (
              <div className="text-center text-sm text-destructive p-3 rounded-lg bg-destructive/10">
                Camera permission is required to start this exercise. Please enable camera access in your browser settings and try again.
              </div>
            )}

            {/* Start Button */}
            <Button 
              variant="hero" 
              size="xl" 
              className="w-full"
              onClick={handleInitCamera}
              disabled={cameraPermissionDeniedThisSession}
            >
              <Play className="w-5 h-5" />
              Start 60s Challenge
            </Button>
          </div>
        )}

        {/* Camera Ready - Show Start Exercise button */}
        {step === 'camera-ready' && (
          <div className="w-full max-w-sm space-y-4 animate-fade-in">
            <div className="text-center text-sm text-muted-foreground">
              Camera ready. Position yourself and press start!
            </div>
            <Button 
              variant="hero" 
              size="xl" 
              className="w-full"
              onClick={handleStartCountdown}
            >
              <Play className="w-5 h-5" />
              Start Exercise
            </Button>
          </div>
        )}

        {/* Active Step - Timer Running */}
        {step === 'active' && (
          <div className="w-full max-w-sm space-y-4 animate-fade-in">
            {/* Timer Display */}
            <div className="text-center mb-4">
              <div 
                key={timeRemaining <= 10 ? 'countdown' : 'normal'}
                className={cn(
                  "text-6xl font-display font-bold tabular-nums transition-colors duration-200",
                  timeRemaining <= 10 ? "text-destructive" : "text-primary"
                )}
              >
                {formatTime(timeRemaining)}
              </div>
              <p className="text-muted-foreground text-sm mt-1">
                {isPlank ? 'Hold your plank!' : 'Keep going!'}
              </p>
            </div>

            {/* Rep Counter */}
            <div className="lion-card p-4 flex items-center justify-between">
              <span className="text-muted-foreground">
                {isPlank ? 'Seconds Held' : 'Reps Detected'}
              </span>
              <span className="text-3xl font-display font-bold text-primary">
                {repCount}
              </span>
            </div>
          </div>
        )}

        {/* Manual Input Step */}
        {step === 'manual-input' && (
          <div className="w-full max-w-sm space-y-6 animate-fade-in">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <Timer className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-display font-bold text-foreground">Time's Up!</h3>
              <p className="text-muted-foreground mt-2">
                We detected <span className="text-primary font-bold">{repCount}</span> {isPlank ? 'seconds' : 'reps'}.
              </p>
            </div>

            {/* Manual adjustment */}
            <div className="lion-card p-4">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Adjust if needed (max +15%):
              </p>
              {(() => {
                const maxManualAdd = Math.floor(repCount * 0.15);
                const maxAllowed = repCount + maxManualAdd;
                const currentValue = manualCount || repCount;
                
                return (
                  <div className="flex items-center justify-center gap-4">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 rounded-full"
                      onClick={() => setManualCount(prev => Math.max(0, (prev || repCount) - 1))}
                      disabled={currentValue <= 0}
                    >
                      <Minus className="w-5 h-5" />
                    </Button>
                    <span className="text-4xl font-display font-bold text-primary w-20 text-center">
                      {currentValue}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 rounded-full"
                      onClick={() => setManualCount(prev => Math.min(maxAllowed, (prev || repCount) + 1))}
                      disabled={currentValue >= maxAllowed}
                    >
                      <Plus className="w-5 h-5" />
                    </Button>
                  </div>
                );
              })()}
            </div>

            {/* LP earned preview */}
            <div className="lion-card p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{isPlank ? 'Seconds' : 'Reps'} × 1 LP</span>
                <span className="font-medium text-foreground">{manualCount || repCount} LP</span>
              </div>
              {(manualCount || repCount) > remainingDailyLP && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>Daily cap limit</span>
                  <span>-{(manualCount || repCount) - remainingDailyLP} LP</span>
                </div>
              )}
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="font-medium text-foreground">Total Earned</span>
                <span className="text-xl font-display font-bold text-primary">
                  +{Math.min(manualCount || repCount, remainingDailyLP)} LP
                </span>
              </div>
            </div>

            {/* Skill distribution preview */}
            <div className="lion-card p-4">
              <p className="text-xs text-muted-foreground mb-3">Skill XP Distribution</p>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="p-2 rounded-lg bg-strength/10">
                  <Dumbbell className="w-4 h-4 text-strength mx-auto mb-1" />
                  <span className="font-semibold text-strength">
                    +{Math.floor(Math.min(manualCount || repCount, remainingDailyLP) * (skillDistribution.strength / 100))}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-endurance/10">
                  <Heart className="w-4 h-4 text-endurance mx-auto mb-1" />
                  <span className="font-semibold text-endurance">
                    +{Math.floor(Math.min(manualCount || repCount, remainingDailyLP) * (skillDistribution.endurance / 100))}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-mobility/10">
                  <Wind className="w-4 h-4 text-mobility mx-auto mb-1" />
                  <span className="font-semibold text-mobility">
                    +{Math.floor(Math.min(manualCount || repCount, remainingDailyLP) * (skillDistribution.mobility / 100))}
                  </span>
                </div>
              </div>
            </div>

            <Button 
              variant="hero" 
              size="xl" 
              className="w-full"
              onClick={() => handleConfirm(manualCount || repCount)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Confirm & Save
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Suspicious Activity Warning Popup */}
      <SuspiciousActivityWarning open={showWarning} onClose={() => setShowWarning(false)} />
    </div>
  );
}
