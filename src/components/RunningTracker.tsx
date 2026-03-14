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
const GPS_LOCK_DURATION = 8000; // ms - wait before counting distance
const MAX_ACCURACY = 20; // meters - ignore points with worse accuracy
const MIN_DISTANCE_BETWEEN_POINTS = 5; // meters - ignore smaller moves (drift)
const MAX_SPEED_KMH = 25; // km/h - above = teleport/GPS jump
const MIN_SPEED_KMH = 0.5; // km/h - below = standing still
const SMOOTHING_BUFFER_SIZE = 3; // number of accepted points to average

// Haversine formula to calculate distance between two GPS points in meters
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

// Average position from multiple points
function averagePosition(positions: Position[]): Position {
  const len = positions.length;
  const sumLat = positions.reduce((s, p) => s + p.lat, 0);
  const sumLng = positions.reduce((s, p) => s + p.lng, 0);
  return {
    lat: sumLat / len,
    lng: sumLng / len,
    timestamp: positions[len - 1].timestamp,
  };
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
  
  const positionsRef = useRef<Position[]>([]);
  const acceptedPositionsRef = useRef<Position[]>([]); // smoothing buffer (last N accepted)
  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const gpsLockTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gpsLockedRef = useRef<boolean>(false);
  const lastAcceptedRef = useRef<Position | null>(null); // last point used for distance

  // Check permission status on mount
  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
        result.onchange = () => {
          setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
        };
      }).catch(() => {
        // Some browsers don't support permissions API
        setPermissionStatus('unknown');
      });
    }
  }, []);

  // LP calculation: 1 LP per 20 meters
  const LP_PER_20_METERS = 1;
  const earnedLP = Math.floor(totalDistance / 20) * LP_PER_20_METERS;
  const cappedLP = Math.min(earnedLP, remainingDailyLP);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${Math.round(meters)} m`;
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
    consecutiveValidRef.current = 0;
    movementUnlockedRef.current = false;
    setLowAccuracy(false);
    // Start timer
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
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

        // Check GPS accuracy
        if (position.coords.accuracy && position.coords.accuracy > LOW_ACCURACY_THRESHOLD) {
          setLowAccuracy(true);
        } else {
          setLowAccuracy(false);
        }

        // Calculate distance from last position
        if (positionsRef.current.length > 0) {
          const lastPos = positionsRef.current[positionsRef.current.length - 1];
          const distance = calculateDistance(lastPos, newPos);
          const timeDiff = (newPos.timestamp - lastPos.timestamp) / 1000;
          
          if (timeDiff > 0) {
            const speedMs = distance / timeDiff;
            const speedKmh = speedMs * 3.6;

            // Teleportation detection: ignore unrealistic jumps
            if (speedMs > MAX_TELEPORT_SPEED) {
              // GPS teleport — skip this point entirely
              positionsRef.current.push(newPos);
              setGpsError(null);
              return;
            }

            // Check minimum distance AND minimum speed
            const isValidMovement = distance >= MIN_DISTANCE_THRESHOLD && speedKmh >= MIN_SPEED_KMH;

            if (isValidMovement) {
              consecutiveValidRef.current += 1;

              // Only award distance after enough consecutive valid updates
              if (consecutiveValidRef.current >= CONSECUTIVE_VALID_REQUIRED) {
                movementUnlockedRef.current = true;
              }

              if (movementUnlockedRef.current) {
                setTotalDistance(prev => prev + distance);
              }

              setCurrentSpeed(speedMs);
            } else {
              // Invalid movement — reset consecutive counter but keep unlocked state
              consecutiveValidRef.current = 0;
              setCurrentSpeed(0);
            }
          }
        }

        positionsRef.current.push(newPos);
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
    setStep('finish');
  }, []);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    
    // Calculate skill XP based on capped LP
    const skillXp = {
      strength: exercise.skill_strength * cappedLP,
      endurance: exercise.skill_endurance * cappedLP,
      mobility: exercise.skill_mobility * cappedLP,
    };

    await onComplete(cappedLP, skillXp);
    setIsSubmitting(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
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

          <div className="bg-secondary/50 rounded-lg p-4 mb-6 w-full max-w-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Zap className="w-4 h-4 text-primary" />
              <span>LP Rewards</span>
            </div>
            <p className="text-foreground font-medium">
              1 LP per 20 meters • 50 LP per kilometer
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Daily limit: {remainingDailyLP} LP remaining
            </p>
          </div>

          {/* Permission warning if denied */}
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
              <p className="text-amber-500 text-sm">Low GPS accuracy detected. Running tracking may not work correctly until the signal improves.</p>
            </div>
          )}

          {/* Main Stats */}
          <div className="flex-1 flex flex-col items-center justify-center">
            {/* Distance - Main Display */}
            <div className="text-center mb-8">
              <p className="text-muted-foreground text-sm mb-1">Distance</p>
              <p className="text-5xl font-display font-bold text-primary">
                {formatDistance(totalDistance)}
              </p>
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
                <p className="text-2xl font-bold text-primary">{earnedLP}</p>
                <p className="text-xs text-muted-foreground">LP Earned</p>
              </div>
            </div>

            {/* GPS Indicator */}
            <div className="flex items-center gap-2 text-muted-foreground mb-8">
              <div className={`w-2 h-2 rounded-full ${gpsError ? 'bg-destructive' : 'bg-green-500 animate-pulse'}`} />
              <span className="text-sm">{gpsError ? 'GPS Signal Lost' : 'GPS Active'}</span>
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
            <p className="text-xl font-bold text-foreground">{formatDistance(totalDistance)}</p>
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
          <div className="bg-primary/20 rounded-lg p-4 text-center">
            <p className="text-primary text-sm">LP Earned</p>
            <p className="text-xl font-bold text-primary">{cappedLP}</p>
          </div>
        </div>

        {earnedLP > remainingDailyLP && (
          <p className="text-amber-500 text-sm mb-4">
            ⚠️ Daily LP cap reached. {earnedLP - cappedLP} LP not counted.
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
