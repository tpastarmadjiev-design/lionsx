import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MapPin, Play, Square, Timer, Zap, Navigation, AlertCircle } from 'lucide-react';
import { Exercise } from '@/hooks/useExercises';

interface RunningTrackerProps {
  exercise: Exercise;
  remainingDailyLP: number;
  onComplete: (lpEarned: number, skillXp: { strength: number; endurance: number; mobility: number }) => void;
  onCancel: () => void;
}

interface Position {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
}

// GPS tracking constants
const MAX_ACCURACY = 30;
const MIN_DISTANCE_BETWEEN_POINTS = 1.5;
const MAX_SPEED_KMH = 25;
const MIN_SPEED_KMH = 0.3;

// Reward constants
const GPS_LOCK_MIN_SECONDS = 5;
const TIME_LP_INTERVAL = 10;
const ACTIVE_SPEED_THRESHOLD_KMH = 1.5;
const MILESTONE_DISTANCE = 100;
const MILESTONE_BONUS_LP = 3;
const MOVEMENT_STALE_SECONDS = 5;

// Milestone celebration timing
const MILESTONE_FADE_IN = 300;
const MILESTONE_VISIBLE = 1200;
const MILESTONE_FADE_OUT = 500;
const MILESTONE_TOTAL = MILESTONE_FADE_IN + MILESTONE_VISIBLE + MILESTONE_FADE_OUT;

function calculateDistance(pos1: Position, pos2: Position): number {
  const R = 6371000;
  const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
  const dLon = (pos2.lng - pos1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function MilestoneCelebration({ distance }: { distance: number }) {
  const [phase, setPhase] = useState<'in' | 'visible' | 'out' | 'gone'>('in');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('visible'), MILESTONE_FADE_IN);
    const t2 = setTimeout(() => setPhase('out'), MILESTONE_FADE_IN + MILESTONE_VISIBLE);
    const t3 = setTimeout(() => setPhase('gone'), MILESTONE_TOTAL);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  if (phase === 'gone') return null;

  const opacity = phase === 'in' ? 'opacity-0' : phase === 'out' ? 'opacity-0' : 'opacity-100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div
        className={`${opacity} transition-opacity bg-background/90 backdrop-blur-sm border border-amber-400/40 rounded-2xl flex flex-col items-center justify-center text-center shadow-2xl`}
        style={{
          width: 280,
          height: 200,
          transitionDuration: phase === 'in' ? `${MILESTONE_FADE_IN}ms` : phase === 'out' ? `${MILESTONE_FADE_OUT}ms` : '0ms',
          boxShadow: '0 0 40px hsl(45 100% 50% / 0.15)',
        }}
      >
        <Zap className="w-10 h-10 text-amber-400 mb-2 drop-shadow-[0_0_8px_hsl(45_100%_50%/0.5)]" fill="currentColor" />
        <p className="text-xl font-display font-bold text-amber-400 leading-tight drop-shadow-[0_0_6px_hsl(45_100%_50%/0.3)]">
          {distance}m Reached!
        </p>
        <p className="text-sm font-semibold text-amber-300/80 mt-1">
          +{MILESTONE_BONUS_LP} LP
        </p>
      </div>
    </div>
  );
}

function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const to = value;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  return <>{display}</>;
}

export function RunningTracker({ exercise, remainingDailyLP, onComplete, onCancel }: RunningTrackerProps) {
  const [step, setStep] = useState<'ready' | 'active' | 'finish'>('ready');
  const [totalDistance, setTotalDistance] = useState(0);
  const [displayDistance, setDisplayDistance] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const [lowAccuracy, setLowAccuracy] = useState(false);
  const [gpsLocked, setGpsLocked] = useState(false);
  const [gpsLockFading, setGpsLockFading] = useState(false);
  const [timeLPEarned, setTimeLPEarned] = useState(0);
  const [milestonesHit, setMilestonesHit] = useState(0);
  const [activeMilestone, setActiveMilestone] = useState<number | null>(null);
  const [milestoneKey, setMilestoneKey] = useState(0);

  const positionsRef = useRef<Position[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastAcceptedRef = useRef<Position | null>(null);
  const gpsLockTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timeLPRef = useRef(0);
  const lastTimeLPSecondRef = useRef(0);
  const lastMilestoneRef = useRef(0);
  const currentSpeedRef = useRef(0);
  const realDistanceRef = useRef(0);
  const displayDistanceRef = useRef(0);
  const lastDistanceIncreaseRef = useRef(0);
  const gpsMinTimePassed = useRef(false);
  const gpsAccuracyOk = useRef(false);

  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
        result.onchange = () => {
          setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
        };
      }).catch(() => {
        setPermissionStatus('unknown');
      });
    }
  }, []);

  const distanceBonusLP = milestonesHit * MILESTONE_BONUS_LP;
  const totalLP = timeLPEarned + distanceBonusLP;
  const cappedLP = Math.min(totalLP, remainingDailyLP);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistanceRounded = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters} m`;
  };

  const formatSpeed = (metersPerSecond: number): string => {
    const kmPerHour = metersPerSecond * 3.6;
    return `${kmPerHour.toFixed(1)} km/h`;
  };

  const tryGpsLock = useCallback(() => {
    if (gpsMinTimePassed.current && gpsAccuracyOk.current) {
      setGpsLockFading(true);
      setTimeout(() => {
        setGpsLocked(true);
        setGpsLockFading(false);
      }, 300);
    }
  }, []);

  const isActivelyRunning = useCallback((elapsed: number): boolean => {
    const speedKmh = currentSpeedRef.current * 3.6;
    if (speedKmh < ACTIVE_SPEED_THRESHOLD_KMH) return false;
    const timeSinceLastIncrease = elapsed - lastDistanceIncreaseRef.current;
    if (timeSinceLastIncrease > MOVEMENT_STALE_SECONDS) return false;
    return true;
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('GPS is not supported on this device');
      return;
    }

    setStep('active');
    setGpsError(null);
    startTimeRef.current = Date.now();
    positionsRef.current = [];
    lastAcceptedRef.current = null;
    setLowAccuracy(false);
    setGpsLocked(false);
    setGpsLockFading(false);
    gpsMinTimePassed.current = false;
    gpsAccuracyOk.current = false;
    timeLPRef.current = 0;
    lastTimeLPSecondRef.current = 0;
    lastMilestoneRef.current = 0;
    currentSpeedRef.current = 0;
    realDistanceRef.current = 0;
    displayDistanceRef.current = 0;
    lastDistanceIncreaseRef.current = 0;

    // Min time lock
    gpsLockTimerRef.current = setTimeout(() => {
      gpsMinTimePassed.current = true;
      // If accuracy already ok, lock now. Otherwise wait for accuracy callback.
      if (gpsAccuracyOk.current) {
        setGpsLockFading(true);
        setTimeout(() => {
          setGpsLocked(true);
          setGpsLockFading(false);
        }, 300);
      }
    }, GPS_LOCK_MIN_SECONDS * 1000);

    // Timer — handles time-based LP
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedTime(elapsed);

      // Time-based LP: 1 LP every 10s if actively running
      const speedKmh = currentSpeedRef.current * 3.6;
      const timeSinceMove = elapsed - lastDistanceIncreaseRef.current;
      const active = speedKmh >= ACTIVE_SPEED_THRESHOLD_KMH && timeSinceMove <= MOVEMENT_STALE_SECONDS;

      if (active) {
        const timeLPNow = Math.floor(elapsed / TIME_LP_INTERVAL);
        if (timeLPNow > lastTimeLPSecondRef.current) {
          const newLP = timeLPNow - lastTimeLPSecondRef.current;
          timeLPRef.current += newLP;
          lastTimeLPSecondRef.current = timeLPNow;
          setTimeLPEarned(timeLPRef.current);
        }
      } else {
        lastTimeLPSecondRef.current = Math.floor(elapsed / TIME_LP_INTERVAL);
      }
    }, 1000);

    // Start GPS tracking
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newPos: Position = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          timestamp: position.timestamp,
          accuracy: position.coords.accuracy,
        };

        if (position.coords.accuracy && position.coords.accuracy > MAX_ACCURACY) {
          setLowAccuracy(true);
          return;
        }
        setLowAccuracy(false);

        // Mark accuracy as OK for GPS lock
        if (!gpsAccuracyOk.current) {
          gpsAccuracyOk.current = true;
          if (gpsMinTimePassed.current) {
            setGpsLockFading(true);
            setTimeout(() => {
              setGpsLocked(true);
              setGpsLockFading(false);
            }, 300);
          }
        }

        positionsRef.current.push(newPos);

        if (!lastAcceptedRef.current) {
          lastAcceptedRef.current = newPos;
          return;
        }

        const lastAccepted = lastAcceptedRef.current;
        const rawDistance = calculateDistance(lastAccepted, newPos);
        const timeDiff = (newPos.timestamp - lastAccepted.timestamp) / 1000;

        if (rawDistance < MIN_DISTANCE_BETWEEN_POINTS) {
          return;
        }

        if (timeDiff > 0) {
          const speedKmh = (rawDistance / timeDiff) * 3.6;

          if (speedKmh > MAX_SPEED_KMH) {
            return;
          }

          if (speedKmh < MIN_SPEED_KMH) {
            return;
          }

          const speedMs = rawDistance / timeDiff;
          setCurrentSpeed(speedMs);
          currentSpeedRef.current = speedMs;
        }

        // Update real distance
        realDistanceRef.current += rawDistance;
        const realDist = realDistanceRef.current;
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        lastDistanceIncreaseRef.current = elapsed;

        setTotalDistance(realDist);

        // Smoothed display distance: round to 10m, only increase
        const rounded = Math.floor(realDist / 10) * 10;
        if (rounded > displayDistanceRef.current) {
          displayDistanceRef.current = rounded;
          setDisplayDistance(rounded);
        }

        // Milestones use real distance
        const newMilestoneCount = Math.floor(realDist / MILESTONE_DISTANCE);
        if (newMilestoneCount > lastMilestoneRef.current) {
          lastMilestoneRef.current = newMilestoneCount;
          setMilestonesHit(newMilestoneCount);
          setActiveMilestone(newMilestoneCount * MILESTONE_DISTANCE);
          setMilestoneKey(k => k + 1);
          // Haptic feedback if available
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
        }

        lastAcceptedRef.current = newPos;
        setGpsError(null);
      },
      (error) => {
        console.log('GPS Error:', error.code, error.message);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError('Browser needs location permission. Tap the lock icon in your browser\'s address bar → Site settings → Allow Location.');
            setPermissionStatus('denied');
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsError('Location unavailable. Make sure you\'re outside with clear sky view.');
            break;
          case error.TIMEOUT:
            setGpsError('GPS signal weak. Move to an open area...');
            break;
          default:
            setGpsError('GPS error occurred. Please try again.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (gpsLockTimerRef.current) {
      clearTimeout(gpsLockTimerRef.current);
      gpsLockTimerRef.current = null;
    }
    setStep('finish');
  }, []);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    const skillXp = {
      strength: exercise.skill_strength * cappedLP,
      endurance: exercise.skill_endurance * cappedLP,
      mobility: exercise.skill_mobility * cappedLP,
    };
    await onComplete(cappedLP, skillXp);
    setIsSubmitting(false);
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (gpsLockTimerRef.current) {
        clearTimeout(gpsLockTimerRef.current);
      }
    };
  }, []);

  // Ready screen
  if (step === 'ready') {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col">
        <Card className="flex-1 flex flex-col items-center justify-center p-6 bg-card/80 backdrop-blur border-border/50">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6">
            <Navigation className="w-10 h-10 text-primary" />
          </div>

          <h2 className="text-2xl font-display font-bold text-foreground mb-2">
            {exercise.name}
          </h2>

          <p className="text-muted-foreground text-center mb-6 max-w-sm">
            {exercise.description}
          </p>

          <div className="bg-secondary/50 rounded-lg p-4 mb-4 w-full max-w-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Timer className="w-4 h-4 text-primary" />
              <span>Time LP</span>
            </div>
            <p className="text-foreground font-medium">
              1 LP every 10 seconds of active running
            </p>
          </div>

          <div className="bg-secondary/50 rounded-lg p-4 mb-6 w-full max-w-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Zap className="w-4 h-4 text-primary" />
              <span>Distance Bonus</span>
            </div>
            <p className="text-foreground font-medium">
              +{MILESTONE_BONUS_LP} LP at every {MILESTONE_DISTANCE}m milestone
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Daily limit: {remainingDailyLP} LP remaining
            </p>
          </div>

          {permissionStatus === 'denied' && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6 w-full max-w-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-destructive font-medium text-sm">Location Blocked</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your browser blocked location access. Tap the lock icon (🔒) in your browser's address bar → Site settings → Allow Location, then reload.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6 w-full max-w-sm">
            <div className="flex items-start gap-2">
              <MapPin className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-500 font-medium text-sm">GPS Required</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Make sure you're outside with a clear view of the sky. Your browser will ask for location permission when you start.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 w-full max-w-sm">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button onClick={startTracking} className="flex-1 gap-2">
              <Play className="w-4 h-4" />
              Start Run
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Active tracking screen
  if (step === 'active') {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col">
        <Card className="flex-1 flex flex-col p-6 bg-card/80 backdrop-blur border-border/50">
          {/* GPS Error Banner */}
          {gpsError && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-destructive text-sm">{gpsError}</p>
            </div>
          )}

          {/* Low Accuracy Warning */}
          {lowAccuracy && !gpsError && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-amber-500 text-sm">Low GPS accuracy. Points with accuracy worse than {MAX_ACCURACY}m are being skipped.</p>
            </div>
          )}

          {/* Main Stats */}
          <div className="flex-1 flex flex-col items-center justify-center">
            {/* Distance - Main Display */}
            <div className="text-center mb-8">
              <p className="text-muted-foreground text-sm mb-1">Distance</p>
              {!gpsLocked ? (
                <div className={`flex flex-col items-center gap-2 transition-opacity duration-300 ${gpsLockFading ? 'opacity-0' : 'opacity-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                    <p className="text-3xl font-display font-bold text-primary animate-pulse">
                      GPS Locking...
                    </p>
                    <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                  </div>
                  <p className="text-xs text-muted-foreground">Acquiring satellite signal</p>
                </div>
              ) : (
                <p className="text-5xl font-display font-bold text-primary animate-fade-in">
                  {formatDistanceRounded(displayDistance)}
                </p>
              )}
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-3 gap-6 w-full max-w-sm mb-8">
              <div className="text-center">
                <Timer className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                <p className="text-2xl font-bold text-foreground">{formatTime(elapsedTime)}</p>
                <p className="text-xs text-muted-foreground">Time</p>
              </div>
              <div className="text-center">
                <Navigation className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                <p className="text-2xl font-bold text-foreground">{formatSpeed(currentSpeed)}</p>
                <p className="text-xs text-muted-foreground">Speed</p>
              </div>
              <div className="text-center">
                <Zap className="w-6 h-6 text-primary mx-auto mb-1" />
                <p className="text-2xl font-bold text-primary">{timeLPEarned + distanceBonusLP}</p>
                <p className="text-xs text-muted-foreground">LP Earned</p>
              </div>
            </div>

            {/* GPS Indicator */}
            <div className="flex items-center gap-2 text-muted-foreground mb-8">
              <div className={`w-2 h-2 rounded-full ${gpsError ? 'bg-destructive' : 'bg-green-500 animate-pulse'}`} />
              <span className="text-sm">{gpsError ? 'GPS Signal Lost' : gpsLocked ? 'GPS Active' : 'GPS Locking...'}</span>
            </div>
          </div>

          {/* Stop Button */}
          <Button
            variant="destructive"
            size="lg"
            onClick={stopTracking}
            className="w-full gap-2"
          >
            <Square className="w-5 h-5" />
            Stop Run
          </Button>
        </Card>

        {/* Milestone celebration overlay */}
        {activeMilestone !== null && (
          <MilestoneCelebration key={milestoneKey} distance={activeMilestone} />
        )}
      </div>
    );
  }

  // Finish screen
  return (
    <div className="min-h-screen bg-background p-4 flex flex-col">
      <Card className="flex-1 flex flex-col items-center justify-center p-6 bg-card/80 backdrop-blur border-border/50">
        <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6">
          <Navigation className="w-10 h-10 text-primary" />
        </div>

        <h2 className="text-2xl font-display font-bold text-foreground mb-6">
          Run Complete! 🏃
        </h2>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-6">
          <div className="bg-secondary/50 rounded-lg p-4 text-center">
            <p className="text-muted-foreground text-sm">Distance</p>
            <p className="text-xl font-bold text-foreground">{formatDistanceRounded(displayDistance)}</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-4 text-center">
            <p className="text-muted-foreground text-sm">Time</p>
            <p className="text-xl font-bold text-foreground">{formatTime(elapsedTime)}</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-4 text-center">
            <p className="text-muted-foreground text-sm">Avg Speed</p>
            <p className="text-xl font-bold text-foreground">
              {elapsedTime > 0 ? formatSpeed(totalDistance / elapsedTime) : '0.0 km/h'}
            </p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-4 text-center">
            <p className="text-muted-foreground text-sm">Milestones</p>
            <p className="text-xl font-bold text-foreground">{milestonesHit} × {MILESTONE_DISTANCE}m</p>
          </div>
        </div>

        {/* LP Breakdown with animated numbers */}
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 w-full max-w-sm mb-6">
          <p className="text-sm font-semibold text-primary mb-3 text-center">LP Summary</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-foreground">
              <span>⏱ Time LP</span>
              <span className="font-medium">
                <AnimatedNumber value={timeLPEarned} /> LP
              </span>
            </div>
            <div className="flex justify-between text-foreground">
              <span>🏃 Distance Bonus ({milestonesHit} × {MILESTONE_BONUS_LP})</span>
              <span className="font-medium">
                <AnimatedNumber value={distanceBonusLP} duration={600} /> LP
              </span>
            </div>
            <div className="border-t border-primary/20 pt-2 flex justify-between text-primary font-bold">
              <span>Total</span>
              <span>
                <AnimatedNumber value={cappedLP} duration={1000} /> LP
              </span>
            </div>
          </div>
        </div>

        {totalLP > remainingDailyLP && (
          <p className="text-amber-500 text-sm mb-4">
            ⚠️ Daily LP cap reached. {totalLP - cappedLP} LP not counted.
          </p>
        )}

        {/* Skill Preview */}
        <div className="bg-secondary/30 rounded-lg p-4 w-full max-w-sm mb-6">
          <p className="text-sm text-muted-foreground mb-2">Skill XP Preview</p>
          <div className="flex justify-around">
            <div className="text-center">
              <p className="text-foreground font-medium">+{exercise.skill_strength * cappedLP}</p>
              <p className="text-xs text-muted-foreground">Strength</p>
            </div>
            <div className="text-center">
              <p className="text-primary font-medium">+{exercise.skill_endurance * cappedLP}</p>
              <p className="text-xs text-muted-foreground">Endurance</p>
            </div>
            <div className="text-center">
              <p className="text-foreground font-medium">+{exercise.skill_mobility * cappedLP}</p>
              <p className="text-xs text-muted-foreground">Mobility</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 w-full max-w-sm">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Discard
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting || cappedLP === 0}
            className="flex-1"
          >
            {isSubmitting ? 'Saving...' : 'Confirm'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
