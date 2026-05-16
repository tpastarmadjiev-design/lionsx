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
const GPS_LOCK_SECONDS = 8;
const TIME_LP_INTERVAL = 10; // seconds
const TIME_LP_SPEED_THRESHOLD = 0.5; // km/h
const MILESTONE_DISTANCE = 100; // meters
const MILESTONE_BONUS_LP = 3;

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
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="animate-pulse bg-background/90 backdrop-blur-sm border border-primary/30 rounded-2xl flex flex-col items-center justify-center text-center shadow-2xl" style={{ width: 320, height: 320 }}>
        <Zap className="w-10 h-10 text-primary mb-2" fill="currentColor" />
        <p className="text-lg font-display font-bold text-primary leading-tight">
          You've Reached {distance}m!
        </p>
        <p className="text-sm font-semibold text-primary/80 mt-1">
          +{MILESTONE_BONUS_LP} LP
        </p>
      </div>
    </div>
  );
}

export function RunningTracker({ exercise, remainingDailyLP, onComplete, onCancel }: RunningTrackerProps) {
  const [step, setStep] = useState<'ready' | 'active' | 'finish'>('ready');
  const [totalDistance, setTotalDistance] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const [lowAccuracy, setLowAccuracy] = useState(false);
  const [gpsLocked, setGpsLocked] = useState(false);
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

  // Distance bonus LP
  const distanceBonusLP = milestonesHit * MILESTONE_BONUS_LP;
  const totalLP = timeLPEarned + distanceBonusLP;
  const cappedLP = Math.min(totalLP, remainingDailyLP);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistanceRounded = (meters: number): string => {
    const rounded = Math.floor(meters / 10) * 10;
    if (rounded >= 1000) {
      return `${(rounded / 1000).toFixed(2)} km`;
    }
    return `${rounded} m`;
  };

  const formatSpeed = (metersPerSecond: number): string => {
    const kmPerHour = metersPerSecond * 3.6;
    return `${kmPerHour.toFixed(1)} km/h`;
  };

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
    timeLPRef.current = 0;
    lastTimeLPSecondRef.current = 0;
    lastMilestoneRef.current = 0;
    currentSpeedRef.current = 0;

    // GPS lock timer
    gpsLockTimerRef.current = setTimeout(() => {
      setGpsLocked(true);
    }, GPS_LOCK_SECONDS * 1000);

    // Start timer — also handles time-based LP
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedTime(elapsed);

      // Time-based LP: 1 LP every 10s if speed > threshold
      const speedKmh = currentSpeedRef.current * 3.6;
      if (speedKmh > TIME_LP_SPEED_THRESHOLD) {
        const timeLPNow = Math.floor(elapsed / TIME_LP_INTERVAL);
        if (timeLPNow > lastTimeLPSecondRef.current) {
          const newLP = timeLPNow - lastTimeLPSecondRef.current;
          timeLPRef.current += newLP;
          lastTimeLPSecondRef.current = timeLPNow;
          setTimeLPEarned(timeLPRef.current);
        }
      } else {
        // Update the checkpoint so standing still doesn't accumulate
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

        setTotalDistance(prev => {
          const newTotal = prev + rawDistance;

          // Check milestones
          const newMilestoneCount = Math.floor(newTotal / MILESTONE_DISTANCE);
          if (newMilestoneCount > lastMilestoneRef.current) {
            lastMilestoneRef.current = newMilestoneCount;
            setMilestonesHit(newMilestoneCount);
            setActiveMilestone(newMilestoneCount * MILESTONE_DISTANCE);
            setMilestoneKey(k => k + 1);
          }

          return newTotal;
        });

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
      strength: Math.round((exercise.skill_strength / 100) * cappedLP),
      endurance: Math.round((exercise.skill_endurance / 100) * cappedLP),
      mobility: Math.round((exercise.skill_mobility / 100) * cappedLP),
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

          {exercise.gif_url && (
            <div className="w-full max-w-sm rounded-xl overflow-hidden border border-border bg-secondary/30 mb-4">
              <img src={exercise.gif_url} alt={exercise.name} className="w-full" />
            </div>
          )}

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
                <div className="flex flex-col items-center gap-2">
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
                <p className="text-5xl font-display font-bold text-primary">
                  {formatDistanceRounded(totalDistance)}
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
            <p className="text-xl font-bold text-foreground">{formatDistanceRounded(totalDistance)}</p>
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

        {/* LP Breakdown */}
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 w-full max-w-sm mb-6">
          <p className="text-sm font-semibold text-primary mb-3 text-center">LP Summary</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-foreground">
              <span>⏱ Time LP ({timeLPEarned})</span>
              <span className="font-medium">{timeLPEarned} LP</span>
            </div>
            <div className="flex justify-between text-foreground">
              <span>🏃 Distance Bonus ({milestonesHit} × {MILESTONE_BONUS_LP})</span>
              <span className="font-medium">{distanceBonusLP} LP</span>
            </div>
            <div className="border-t border-primary/20 pt-2 flex justify-between text-primary font-bold">
              <span>Total</span>
              <span>{cappedLP} LP</span>
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
              <p className="text-foreground font-medium">+{Math.round((exercise.skill_strength / 100) * cappedLP)}</p>
              <p className="text-xs text-muted-foreground">Strength</p>
            </div>
            <div className="text-center">
              <p className="text-primary font-medium">+{Math.round((exercise.skill_endurance / 100) * cappedLP)}</p>
              <p className="text-xs text-muted-foreground">Endurance</p>
            </div>
            <div className="text-center">
              <p className="text-foreground font-medium">+{Math.round((exercise.skill_mobility / 100) * cappedLP)}</p>
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
