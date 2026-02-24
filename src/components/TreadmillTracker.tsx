import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, Square, Timer, Zap, AlertCircle, Activity, Pause } from 'lucide-react';
import { Exercise } from '@/hooks/useExercises';
import { cn } from '@/lib/utils';

interface TreadmillTrackerProps {
  exercise: Exercise;
  remainingDailyLP: number;
  onComplete: (lpEarned: number, skillXp: { strength: number; endurance: number; mobility: number }) => void;
  onCancel: () => void;
}

// Motion detection constants
const MOTION_THRESHOLD = 15; // pixel diff threshold (0-255 per channel)
const MOTION_PIXEL_RATIO = 0.012; // 1.2% of pixels must change
const RUNNING_CONFIRM_MS = 1500; // 1.5s continuous motion → running
const STOPPED_CONFIRM_MS = 2000; // 2s no motion → stopped
const CAPTURE_FPS = 12; // low FPS for performance
const CAPTURE_WIDTH = 160; // small capture for speed
const CAPTURE_HEIGHT = 120;

type RunState = 'idle' | 'running' | 'stopped';

export function TreadmillTracker({ exercise, remainingDailyLP, onComplete, onCancel }: TreadmillTrackerProps) {
  const [step, setStep] = useState<'ready' | 'active' | 'finish'>('ready');
  const [runState, setRunState] = useState<RunState>('idle');
  const [runningTime, setRunningTime] = useState(0); // seconds actively running
  const [totalTime, setTotalTime] = useState(0); // total elapsed
  const [cycles, setCycles] = useState(0); // run→stop transitions
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevFrameRef = useRef<ImageData | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastCaptureRef = useRef<number>(0);

  // Motion tracking state
  const motionStartRef = useRef<number | null>(null);
  const stillStartRef = useRef<number | null>(null);
  const runStateRef = useRef<RunState>('idle');
  const runningTimeRef = useRef(0);
  const cyclesRef = useRef(0);

  // Timers
  const totalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const runTimerRef = useRef<NodeJS.Timeout | null>(null);

  // LP: 1 LP per 10 seconds of running
  const earnedLP = Math.floor(runningTime / 10);
  const cappedLP = Math.min(earnedLP, remainingDailyLP);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Frame-diff motion detection
  const detectMotion = useCallback((ctx: CanvasRenderingContext2D): boolean => {
    const frame = ctx.getImageData(0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);
    const prev = prevFrameRef.current;
    prevFrameRef.current = frame;
    if (!prev) return false;

    let changedPixels = 0;
    const totalPixels = CAPTURE_WIDTH * CAPTURE_HEIGHT;
    const data = frame.data;
    const pData = prev.data;

    for (let i = 0; i < data.length; i += 16) { // sample every 4th pixel for speed
      const diff = Math.abs(data[i] - pData[i]) +
                   Math.abs(data[i + 1] - pData[i + 1]) +
                   Math.abs(data[i + 2] - pData[i + 2]);
      if (diff > MOTION_THRESHOLD * 3) changedPixels++;
    }

    const sampledTotal = Math.floor(totalPixels / 4);
    return (changedPixels / sampledTotal) > MOTION_PIXEL_RATIO;
  }, []);

  const processFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const now = performance.now();
    const interval = 1000 / CAPTURE_FPS;
    if (now - lastCaptureRef.current < interval) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }
    lastCaptureRef.current = now;

    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    ctx.drawImage(videoRef.current, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);
    const hasMotion = detectMotion(ctx);
    const ts = Date.now();

    if (hasMotion) {
      stillStartRef.current = null;
      if (!motionStartRef.current) motionStartRef.current = ts;

      if (ts - motionStartRef.current >= RUNNING_CONFIRM_MS && runStateRef.current !== 'running') {
        runStateRef.current = 'running';
        setRunState('running');
        // Start running timer
        if (!runTimerRef.current) {
          runTimerRef.current = setInterval(() => {
            runningTimeRef.current += 1;
            setRunningTime(runningTimeRef.current);
          }, 1000);
        }
      }
    } else {
      motionStartRef.current = null;
      if (!stillStartRef.current) stillStartRef.current = ts;

      if (ts - stillStartRef.current >= STOPPED_CONFIRM_MS && runStateRef.current !== 'stopped' && runStateRef.current !== 'idle') {
        // Was running, now stopped → count cycle
        if (runStateRef.current === 'running') {
          cyclesRef.current += 1;
          setCycles(cyclesRef.current);
        }
        runStateRef.current = 'stopped';
        setRunState('stopped');
        // Pause running timer
        if (runTimerRef.current) {
          clearInterval(runTimerRef.current);
          runTimerRef.current = null;
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(processFrame);
  }, [detectMotion]);

  const startTracking = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError('Camera unavailable. Please check your permissions.');
      return;
    }

    setStep('active');
    setRunState('idle');
    runStateRef.current = 'idle';
    setRunningTime(0);
    runningTimeRef.current = 0;
    setTotalTime(0);
    setCycles(0);
    cyclesRef.current = 0;
    prevFrameRef.current = null;
    motionStartRef.current = null;
    stillStartRef.current = null;

    // Total elapsed timer
    totalTimerRef.current = setInterval(() => {
      setTotalTime(prev => prev + 1);
    }, 1000);

    // Start motion detection loop
    animFrameRef.current = requestAnimationFrame(processFrame);
  }, [processFrame, stopStream]);

  const stopTracking = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (totalTimerRef.current) clearInterval(totalTimerRef.current);
    if (runTimerRef.current) clearInterval(runTimerRef.current);
    stopStream();
    setStep('finish');
  }, [stopStream]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (totalTimerRef.current) clearInterval(totalTimerRef.current);
      if (runTimerRef.current) clearInterval(runTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Hidden elements for capture
  const hiddenMedia = (
    <>
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      <canvas ref={canvasRef} width={CAPTURE_WIDTH} height={CAPTURE_HEIGHT} className="hidden" />
    </>
  );

  // READY screen
  if (step === 'ready') {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col">
        {hiddenMedia}
        <Card className="flex-1 flex flex-col items-center justify-center p-6 bg-card/80 border-border/50">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6">
            <Activity className="w-10 h-10 text-primary" />
          </div>

          <h2 className="text-2xl font-display font-bold text-foreground mb-2">
            Treadmill Run
          </h2>

          <p className="text-muted-foreground text-center mb-6 max-w-sm">
            Get ready to start running! The camera will detect your movement automatically.
          </p>

          <div className="bg-secondary/50 rounded-lg p-4 mb-6 w-full max-w-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Zap className="w-4 h-4 text-primary" />
              <span>LP Rewards</span>
            </div>
            <p className="text-foreground font-medium">
              1 LP per 10 seconds of running
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Daily limit: {remainingDailyLP} LP remaining
            </p>
          </div>

          {cameraError && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6 w-full max-w-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-destructive font-medium text-sm">Camera Error</p>
                  <p className="text-xs text-muted-foreground mt-1">{cameraError}</p>
                </div>
              </div>
            </div>
          )}

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

  // ACTIVE screen
  if (step === 'active') {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col">
        {hiddenMedia}
        <Card className="flex-1 flex flex-col p-6 bg-card/80 border-border/50">
          {/* Running/Stopped indicator */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className={cn(
              "w-3 h-3 rounded-full",
              runState === 'running' ? "bg-primary animate-pulse" :
              runState === 'stopped' ? "bg-destructive" :
              "bg-muted-foreground"
            )} />
            <span className={cn(
              "text-lg font-display font-bold uppercase tracking-wider",
              runState === 'running' ? "text-primary" :
              runState === 'stopped' ? "text-destructive" :
              "text-muted-foreground"
            )}>
              {runState === 'running' ? '🏃 Running' :
               runState === 'stopped' ? '⏸️ Stopped' :
               '⏳ Waiting for movement...'}
            </span>
          </div>

          {/* Main Stats */}
          <div className="flex-1 flex flex-col items-center justify-center">
            {/* Running time - Main display */}
            <div className="text-center mb-8">
              <p className="text-muted-foreground text-sm mb-1">Running Time</p>
              <p className="text-6xl font-display font-bold text-primary tabular-nums">
                {formatTime(runningTime)}
              </p>
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-3 gap-6 w-full max-w-sm mb-8">
              <div className="text-center">
                <Timer className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                <p className="text-2xl font-bold text-foreground tabular-nums">{formatTime(totalTime)}</p>
                <p className="text-xs text-muted-foreground">Total Time</p>
              </div>
              <div className="text-center">
                <Activity className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                <p className="text-2xl font-bold text-foreground">{cycles}</p>
                <p className="text-xs text-muted-foreground">Run/Stop</p>
              </div>
              <div className="text-center">
                <Zap className="w-6 h-6 text-primary mx-auto mb-1" />
                <p className="text-2xl font-bold text-primary">{earnedLP}</p>
                <p className="text-xs text-muted-foreground">LP Earned</p>
              </div>
            </div>

            {/* Camera preview (small) */}
            <div className="w-32 h-24 rounded-lg overflow-hidden border border-border/50 bg-secondary mb-6">
              <video
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
                ref={(el) => {
                  if (el && streamRef.current) {
                    el.srcObject = streamRef.current;
                  }
                }}
              />
            </div>
          </div>

          {/* Finish Button */}
          <Button
            variant="destructive"
            size="lg"
            onClick={stopTracking}
            className="w-full gap-2"
          >
            <Square className="w-5 h-5" />
            Finish Run
          </Button>
        </Card>
      </div>
    );
  }

  // FINISH screen
  return (
    <div className="min-h-screen bg-background p-4 flex flex-col">
      <Card className="flex-1 flex flex-col items-center justify-center p-6 bg-card/80 border-border/50">
        <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6">
          <Activity className="w-10 h-10 text-primary" />
        </div>

        <h2 className="text-2xl font-display font-bold text-foreground mb-6">
          Treadmill Run Complete! 🏃
        </h2>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-6">
          <div className="bg-secondary/50 rounded-lg p-4 text-center">
            <p className="text-muted-foreground text-sm">Running Time</p>
            <p className="text-xl font-bold text-foreground">{formatTime(runningTime)}</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-4 text-center">
            <p className="text-muted-foreground text-sm">Total Time</p>
            <p className="text-xl font-bold text-foreground">{formatTime(totalTime)}</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-4 text-center">
            <p className="text-muted-foreground text-sm">Run/Stop Cycles</p>
            <p className="text-xl font-bold text-foreground">{cycles}</p>
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
            className="flex-1 gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Confirm +{cappedLP} LP
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
