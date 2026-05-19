import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useExercises, type Exercise } from '@/hooks/useExercises';
import { useTrackScreen } from '@/hooks/useAnalyticsTracker';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { PoseTracker } from '@/components/PoseTracker';
import { ExerciseInstructions } from '@/components/ExerciseInstructions';
import { getExerciseType } from '@/components/TimedTrainingFlow';
import {
  Flame, Zap, Trophy, Play, Square, ChevronRight, Check, Loader2, ArrowLeft,
  Dumbbell as DumbbellIcon, Activity, Wind,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import trainingCardBg from '@/assets/training-card-bg.jpg';
import challengeEasyBg from '@/assets/challenge-easy.png';
import challengeMediumBg from '@/assets/challenge-medium.png';
import challengeHardBg from '@/assets/challenge-hard.png';

const DIFFICULTY_BG: Record<'easy' | 'medium' | 'hard', string> = {
  easy: challengeEasyBg,
  medium: challengeMediumBg,
  hard: challengeHardBg,
};

type Difficulty = 'easy' | 'medium' | 'hard';
type Category = 'strength' | 'endurance' | 'mobility';

interface ChallengeExercise {
  name: string;
  target: number;
  completed: number;
}

interface ChallengeRow {
  id: string;
  user_id: string;
  difficulty: Difficulty;
  exercises: ChallengeExercise[];
  status: 'active' | 'completed' | 'abandoned';
  lp_awarded: number;
  started_at: string;
  completed_at: string | null;
}

const DIFFICULTY_CONFIG: Record<Difficulty, {
  reps: number; bonus: number; label: string;
  gradient: string; glow: string; icon: string;
}> = {
  easy: {
    reps: 15, bonus: 30, label: 'Easy', icon: '🟢',
    gradient: 'from-emerald-900/95 via-emerald-800/60 to-transparent',
    glow: 'bg-emerald-500/20',
  },
  medium: {
    reps: 25, bonus: 50, label: 'Medium', icon: '🟡',
    gradient: 'from-amber-900/95 via-orange-800/60 to-transparent',
    glow: 'bg-amber-500/20',
  },
  hard: {
    reps: 40, bonus: 75, label: 'Hard', icon: '🔴',
    gradient: 'from-rose-900/95 via-red-800/60 to-transparent',
    glow: 'bg-rose-500/25',
  },
};

const CHALLENGE_POOL = [
  'Push-ups', 'Diamond Push-ups', 'Pike Push-ups',
  'Squats', 'Lunges', 'Calf Raises', 'Jumps',
  'Burpees', 'Mountain Climbers', 'Jumping Jacks', 'High Knees', 'Jump Rope',
  'Sit-ups', 'Toe Touches', 'Cat-Cow Stretch',
  'Pull-ups', 'Dips',
  'Bench Press', 'Lat Pulldown', 'Seated Cable Row',
  'Dumbbell Bicep Curls', 'Dumbbell Hammer Curls',
  'Dumbbell Shoulder Press', 'Dumbbell Lateral Raises',
  'Dumbbell Front Raises', 'Dumbbell Bent-over Rows',
  'Dumbbell Goblet Squat', 'Dumbbell Thrusters',
  'Dumbbell Chest Press', 'Dumbbell Tricep Overhead Extension',
  'Dumbbell Punches', 'Deadlift', 'Dumbbell Windmill',
];

const CATEGORY_ICON: Record<Category, typeof DumbbellIcon> = {
  strength: DumbbellIcon,
  endurance: Activity,
  mobility: Wind,
};

const CATEGORY_COLOR: Record<Category, string> = {
  strength: 'text-strength',
  endurance: 'text-endurance',
  mobility: 'text-mobility',
};

function pickRandom(pool: string[], n: number): string[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export default function Challenges() {
  const { user, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const { exercises } = useExercises();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useTrackScreen('challenges');

  const [view, setView] = useState<'picker' | 'slot' | 'list' | 'exec'>('picker');
  const [activeChallenge, setActiveChallenge] = useState<ChallengeRow | null>(null);
  const [execIndex, setExecIndex] = useState<number | null>(null);
  const [showCelebration, setShowCelebration] = useState<{ lp: number } | null>(null);

  // name -> Exercise map (for category icon + gif + instructions)
  const exerciseByName = useMemo(() => {
    const m = new Map<string, Exercise>();
    (exercises || []).forEach(e => m.set(e.name.toLowerCase(), e));
    return m;
  }, [exercises]);

  const getCategory = (name: string): Category => {
    const ex = exerciseByName.get(name.toLowerCase());
    return (ex?.category as Category) || 'strength';
  };

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  const { data: existing, isLoading } = useQuery({
    queryKey: ['active-challenge', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ChallengeRow | null;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (existing && !activeChallenge) {
      setActiveChallenge(existing);
      setView('list');
    }
  }, [existing, activeChallenge]);

  const handlePickDifficulty = (_diff: Difficulty) => {
    setView('slot');
  };

  const handleSlotDone = async (diff: Difficulty, names: string[]) => {
    if (!user?.id) return;
    const exs: ChallengeExercise[] = names.map(name => ({
      name,
      target: DIFFICULTY_CONFIG[diff].reps,
      completed: 0,
    }));
    const { data, error } = await supabase
      .from('challenges')
      .insert({
        user_id: user.id,
        difficulty: diff,
        exercises: exs as any,
        status: 'active',
      })
      .select('*')
      .single();
    if (error) {
      toast.error('Failed to start challenge');
      console.error(error);
      setView('picker');
      return;
    }
    setActiveChallenge(data as unknown as ChallengeRow);
    setView('list');
  };

  const persistExercises = async (next: ChallengeExercise[]) => {
    if (!activeChallenge) return;
    const { error } = await supabase
      .from('challenges')
      .update({ exercises: next as any })
      .eq('id', activeChallenge.id);
    if (error) console.error('persistExercises', error);
  };

  const handleRepProgress = async (idx: number, newCompleted: number) => {
    if (!activeChallenge) return;
    const next = activeChallenge.exercises.map((e, i) =>
      i === idx ? { ...e, completed: newCompleted } : e
    );
    setActiveChallenge({ ...activeChallenge, exercises: next });
    await persistExercises(next);
  };

  const handleExitExec = (idx: number, finalCount: number) => {
    if (!activeChallenge) return;
    const next = activeChallenge.exercises.map((e, i) =>
      i === idx ? { ...e, completed: Math.min(finalCount, e.target) } : e
    );
    setActiveChallenge({ ...activeChallenge, exercises: next });
    persistExercises(next);
    setExecIndex(null);
    setView('list');

    const allDone = next.every(e => e.completed >= e.target);
    if (allDone) finishChallenge(next);
  };

  const finishChallenge = async (finalExs: ChallengeExercise[]) => {
    if (!activeChallenge || !user?.id || !profile) return;
    const bonus = DIFFICULTY_CONFIG[activeChallenge.difficulty].bonus;

    const skillStrength = Math.floor(bonus * 0.4);
    const skillEndurance = Math.floor(bonus * 0.4);
    const skillMobility = Math.floor(bonus * 0.2);

    await supabase
      .from('profiles')
      .update({
        lp: profile.lp + bonus,
        strength: profile.strength + skillStrength,
        endurance: profile.endurance + skillEndurance,
        mobility: profile.mobility + skillMobility,
      })
      .eq('id', user.id);

    await supabase
      .from('challenges')
      .update({
        status: 'completed',
        lp_awarded: bonus,
        completed_at: new Date().toISOString(),
        exercises: finalExs as any,
      })
      .eq('id', activeChallenge.id);

    queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
    queryClient.invalidateQueries({ queryKey: ['active-challenge', user.id] });
    setShowCelebration({ lp: bonus });
    setActiveChallenge(null);
  };

  const handleAbandon = async () => {
    if (!activeChallenge) return;
    await supabase
      .from('challenges')
      .update({ status: 'abandoned' })
      .eq('id', activeChallenge.id);
    queryClient.invalidateQueries({ queryKey: ['active-challenge', user?.id] });
    setActiveChallenge(null);
    setView('picker');
  };

  if (authLoading || isLoading) {
    return (
      <AppLayout title="Challenges">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (view === 'exec' && activeChallenge && execIndex !== null) {
    const ex = activeChallenge.exercises[execIndex];
    const exData = exerciseByName.get(ex.name.toLowerCase());
    return (
      <ChallengeExecution
        exerciseName={ex.name}
        target={ex.target}
        initialCompleted={ex.completed}
        gifUrl={exData?.gif_url || null}
        category={(exData?.category as Category) || 'strength'}
        onRepChange={(n) => handleRepProgress(execIndex, n)}
        onExit={(finalCount) => handleExitExec(execIndex, finalCount)}
      />
    );
  }

  if (view === 'slot') {
    return (
      <AppLayout title="Spinning...">
        <SlotMachine
          pool={CHALLENGE_POOL}
          onDone={(names) => {
            const diff = (window as any).__lx_pickedDifficulty as Difficulty;
            handleSlotDone(diff, names);
          }}
        />
      </AppLayout>
    );
  }

  if (view === 'list' && activeChallenge) {
    const allDone = activeChallenge.exercises.every(e => e.completed >= e.target);
    return (
      <AppLayout title="Active Challenge">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              {DIFFICULTY_CONFIG[activeChallenge.difficulty].label} Challenge
            </p>
            <p className="text-sm text-foreground">
              Bonus: <span className="text-primary font-bold">+{DIFFICULTY_CONFIG[activeChallenge.difficulty].bonus} LP</span>
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleAbandon}>
            Abandon
          </Button>
        </div>

        <div className="space-y-3">
          {activeChallenge.exercises.map((ex, i) => {
            const done = ex.completed >= ex.target;
            const pct = Math.min(100, (ex.completed / ex.target) * 100);
            const cat = getCategory(ex.name);
            const CatIcon = CATEGORY_ICON[cat];
            return (
              <button
                key={i}
                disabled={done}
                onClick={() => { setExecIndex(i); setView('exec'); }}
                className={cn(
                  "w-full p-4 rounded-xl border text-left transition-all",
                  done
                    ? "border-emerald-700/40 bg-emerald-900/20 opacity-70"
                    : "border-border bg-card hover:border-primary/50"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    {done ? (
                      <Check className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center bg-secondary/60",
                        CATEGORY_COLOR[cat]
                      )}>
                        <CatIcon className="w-4 h-4" />
                      </div>
                    )}
                    <span className="font-display font-semibold text-foreground">{ex.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-bold", done ? "text-emerald-500" : "text-foreground")}>
                      {ex.completed}/{ex.target}
                    </span>
                    {!done && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={cn("h-full transition-all", done ? "bg-emerald-500" : "bg-primary")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {allDone && (
          <Button
            variant="hero"
            size="xl"
            className="w-full mt-6"
            onClick={() => finishChallenge(activeChallenge.exercises)}
          >
            <Trophy className="w-5 h-5" />
            Claim +{DIFFICULTY_CONFIG[activeChallenge.difficulty].bonus} LP
          </Button>
        )}

        {showCelebration && (
          <CelebrationOverlay
            lp={showCelebration.lp}
            onClose={() => { setShowCelebration(null); setView('picker'); }}
          />
        )}
      </AppLayout>
    );
  }

  // Picker
  return (
    <AppLayout title="Challenges">
      {showCelebration && (
        <CelebrationOverlay
          lp={showCelebration.lp}
          onClose={() => setShowCelebration(null)}
        />
      )}
      <div className="mb-6">
        <h2 className="text-2xl font-display font-bold text-foreground mb-1">Pick Your Gauntlet</h2>
        <p className="text-sm text-muted-foreground">
          6 random exercises. Hit every target. No daily cap on bonus LP.
        </p>
      </div>

      <div className="space-y-3">
        {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((d, idx) => {
          const c = DIFFICULTY_CONFIG[d];
          return (
            <button
              key={d}
              onClick={() => {
                (window as any).__lx_pickedDifficulty = d;
                handlePickDifficulty(d);
              }}
              className="relative w-full h-28 rounded-2xl overflow-hidden group active:scale-[0.98] transition-transform"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              {/* Atmospheric background image */}
              <img
                src={DIFFICULTY_BG[d]}
                alt=""
                className="absolute inset-0 w-full h-full object-cover object-[center_20%]"
              />
              {/* Color gradient */}
              <div className={cn("absolute inset-0 bg-gradient-to-t", c.gradient)} />
              {/* Pulsing glow */}
              <div className={cn(
                "absolute -inset-8 rounded-full blur-3xl animate-pulse-glow pointer-events-none",
                c.glow
              )} />
              {/* Shimmer sweep */}
              <div
                className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
                }}
              />
              <div className="relative z-10 h-full flex items-center justify-between px-5">
                <div className="text-left">
                  <p className="text-3xl font-black text-foreground">{c.label}</p>
                  <p className="text-xs text-foreground/80">{c.reps} reps × 6 exercises</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-foreground">
                    <Zap className="w-4 h-4" />
                    <span className="text-lg font-bold">+{c.bonus} LP</span>
                  </div>
                  <p className="text-[10px] text-foreground/70">bonus</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </AppLayout>
  );
}

// ─── Slot Machine ───
function SlotMachine({ pool, onDone }: { pool: string[]; onDone: (names: string[]) => void }) {
  const finalRef = useRef<string[]>([]);
  const [slots, setSlots] = useState<string[]>(() => pickRandom(pool, 6));
  const [phase, setPhase] = useState<'spinning' | 'settling' | 'done'>('spinning');

  useEffect(() => {
    finalRef.current = pickRandom(pool, 6);
    let tick = 0;
    const total = 30;
    const iv = setInterval(() => {
      tick++;
      if (tick < total) {
        setSlots(pickRandom(pool, 6));
      } else if (tick === total) {
        setSlots(finalRef.current);
        setPhase('settling');
      } else {
        clearInterval(iv);
        setPhase('done');
        setTimeout(() => onDone(finalRef.current), 600);
      }
    }, 50);
    return () => clearInterval(iv);
  }, [pool, onDone]);

  return (
    <div className="flex flex-col items-center pt-4">
      <div className="flex items-center gap-2 mb-4 text-primary">
        <Flame className="w-5 h-5 animate-pulse" />
        <span className="font-display font-bold uppercase tracking-wider text-sm">
          {phase === 'done' ? 'Locked In!' : 'Rolling...'}
        </span>
        <Flame className="w-5 h-5 animate-pulse" />
      </div>
      <div className="w-full space-y-2">
        {slots.map((name, i) => (
          <div
            key={i}
            className={cn(
              "h-14 rounded-xl border bg-card flex items-center justify-center font-display font-bold text-foreground transition-all",
              phase === 'spinning' ? "border-primary/30 blur-[1px]" : "border-primary scale-[1.01]"
            )}
          >
            {name}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Execution: shows ready (GIF + instructions) -> active (PoseTracker + stop) ───
function ChallengeExecution({
  exerciseName,
  target,
  initialCompleted,
  gifUrl,
  category,
  onRepChange,
  onExit,
}: {
  exerciseName: string;
  target: number;
  initialCompleted: number;
  gifUrl: string | null;
  category: Category;
  onRepChange: (n: number) => void;
  onExit: (finalCount: number) => void;
}) {
  const [step, setStep] = useState<'ready' | 'active'>('ready');
  const [count, setCount] = useState(initialCompleted);
  const [cameraActive, setCameraActive] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const countRef = useRef(initialCompleted);
  const exerciseType = useMemo(() => getExerciseType(exerciseName), [exerciseName]);
  const CatIcon = CATEGORY_ICON[category];

  const handleRep = () => {
    if (countRef.current >= target) return;
    countRef.current += 1;
    setCount(countRef.current);
    onRepChange(countRef.current);
    if (countRef.current >= target) {
      setCameraActive(false);
      setTimeout(() => onExit(countRef.current), 600);
    }
  };

  const startActive = () => {
    setCameraActive(true);
    setStep('active');
  };

  const stopAndExit = () => {
    setCameraActive(false);
    onExit(countRef.current);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button
          onClick={stopAndExit}
          className="p-2 rounded-lg hover:bg-secondary"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <h2 className="text-lg font-display font-semibold text-foreground">{exerciseName}</h2>
        <div className="w-9" />
      </div>

      <div className="flex-1 flex flex-col items-center p-4 overflow-y-auto">
        {step === 'ready' && (
          <div className="w-full max-w-sm space-y-5 animate-fade-in">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center border bg-secondary/60",
                CATEGORY_COLOR[category]
              )}>
                <CatIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-display font-bold text-foreground">{exerciseName}</h3>
                <p className="text-sm text-muted-foreground capitalize">{category} · Target: {target} reps</p>
              </div>
            </div>

            <div className="lion-card p-4 space-y-4">
              {gifUrl && (
                <div className="w-full rounded-xl overflow-hidden border border-border bg-secondary/30">
                  <img
                    src={gifUrl}
                    alt={`${exerciseName} demonstration`}
                    className="w-full h-auto object-contain"
                    loading="eager"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 p-2.5 rounded-lg bg-secondary/50 text-sm">
                  <Zap className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-muted-foreground">Target</span>
                  <span className="ml-auto font-medium text-primary">{target} reps</span>
                </div>
                <div className="flex-1 flex items-center gap-2 p-2.5 rounded-lg bg-secondary/50 text-sm">
                  <Trophy className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-muted-foreground">Progress</span>
                  <span className="ml-auto font-medium text-foreground">{initialCompleted}/{target}</span>
                </div>
              </div>

              <ExerciseInstructions exerciseName={exerciseName} />
            </div>

            <Button
              variant="hero"
              size="xl"
              className="w-full"
              onClick={startActive}
            >
              <Play className="w-5 h-5" />
              {initialCompleted > 0 ? 'Resume Exercise' : 'Start Exercise'}
            </Button>
          </div>
        )}

        {step === 'active' && (
          <>
            <div className="w-full max-w-lg mx-auto relative overflow-hidden rounded-xl mb-4" style={{ aspectRatio: '3/4' }}>
              <PoseTracker
                exercise={exerciseType}
                isActive={cameraActive}
                facingMode="user"
                onRepComplete={handleRep}
              />
              <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
                <div className="px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-sm">
                  <span className="text-sm font-bold text-foreground">
                    {count} / {target}
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-full bg-primary/90">
                  <span className="text-sm font-bold text-primary-foreground">
                    {Math.max(0, target - count)} left
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full max-w-lg space-y-2">
              <div className="h-3 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, (count / target) * 100)}%` }}
                />
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setConfirmStop(true)}
              >
                <Square className="w-4 h-4" />
                Stop & Save Progress
              </Button>
            </div>
          </>
        )}
      </div>

      {confirmStop && (
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-display font-bold text-foreground mb-2">Stop and save?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Your progress ({count}/{target}) will be saved. You can resume later.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmStop(false)}>
                Keep Going
              </Button>
              <Button variant="destructive" className="flex-1" onClick={stopAndExit}>
                Stop
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Celebration ───
function CelebrationOverlay({ lp, onClose }: { lp: number; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] bg-background/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="text-center">
        <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center animate-scale-in">
          <Trophy className="w-12 h-12 text-primary-foreground" />
        </div>
        <h2 className="text-4xl font-display font-black text-foreground mb-2">CHALLENGE COMPLETE!</h2>
        <p className="text-2xl font-display font-bold text-primary mb-6">+{lp} LP</p>
        <Button variant="hero" size="lg" onClick={onClose}>
          Continue
        </Button>
      </div>
    </div>
  );
}
