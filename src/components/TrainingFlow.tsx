import { useState, useRef } from 'react';
import { Exercise } from '@/hooks/useExercises';
import { useProfile, MAX_LP_PER_EXERCISE, PROOF_BONUS_LP } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { 
  Play, 
  Camera, 
  Video, 
  Ban, 
  Check, 
  X, 
  Loader2,
  Upload,
  Dumbbell,
  Heart,
  Wind,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type FlowStep = 'select' | 'start' | 'proof' | 'uploading' | 'finish';
type ProofType = 'none' | 'photo' | 'video';

interface TrainingFlowProps {
  exercise: Exercise;
  onComplete: () => void;
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

export function TrainingFlow({ exercise, onComplete, onCancel }: TrainingFlowProps) {
  const [step, setStep] = useState<FlowStep>('start');
  const [proofType, setProofType] = useState<ProofType | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { user } = useAuth();
  const { addLP, canSkipProof, getNoProofRemaining, profile } = useProfile();
  const { logTraining } = require('@/hooks/useExercises').useExercises();

  const Icon = categoryIcons[exercise.category as keyof typeof categoryIcons];
  const colors = categoryColors[exercise.category as keyof typeof categoryColors];
  
  const baseLp = Math.min(exercise.lp_reward, MAX_LP_PER_EXERCISE);
  const lpWithProof = baseLp + PROOF_BONUS_LP;
  const noProofRemaining = getNoProofRemaining();

  const handleFileSelect = (type: 'photo' | 'video') => {
    setProofType(type);
    if (fileInputRef.current) {
      fileInputRef.current.accept = type === 'photo' 
        ? 'image/jpeg,image/png,image/webp' 
        : 'video/mp4,video/webm,video/quicktime';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate video duration
    if (proofType === 'video') {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        if (video.duration > 15) {
          toast.error('Video must be 15 seconds or less');
          return;
        }
        setProofFile(file);
        setProofPreview(URL.createObjectURL(file));
        setStep('finish');
      };
      video.src = URL.createObjectURL(file);
    } else {
      setProofFile(file);
      setProofPreview(URL.createObjectURL(file));
      setStep('finish');
    }
  };

  const handleNoProof = () => {
    if (!canSkipProof()) {
      toast.error('You need to provide proof! (3/5 no-proof limit reached)');
      return;
    }
    setProofType('none');
    setStep('finish');
  };

  const handleFinish = async () => {
    if (!user || !proofType) return;
    
    setUploading(true);
    let proofUrl: string | undefined;

    try {
      // Upload proof if exists
      if (proofFile && proofType !== 'none') {
        const fileExt = proofFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('training-proofs')
          .upload(fileName, proofFile);

        if (uploadError) {
          throw new Error('Failed to upload proof');
        }

        const { data: urlData } = supabase.storage
          .from('training-proofs')
          .getPublicUrl(fileName);
        
        proofUrl = urlData.publicUrl;
      }

      // Add LP and log training
      await addLP.mutateAsync({
        lp: baseLp,
        category: exercise.category as 'strength' | 'endurance' | 'mobility',
        proofType,
        proofUrl,
      });

      await logTraining.mutateAsync({
        exerciseId: exercise.id,
        lpEarned: proofType !== 'none' ? lpWithProof : baseLp,
        proofUrl,
        proofType,
      });

      onComplete();
    } catch (error) {
      console.error('Training error:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-lg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button onClick={onCancel} className="p-2 rounded-lg hover:bg-secondary">
          <X className="w-6 h-6 text-muted-foreground" />
        </button>
        <h2 className="text-lg font-display font-semibold text-foreground">Training</h2>
        <div className="w-10" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Exercise Card */}
        <div className="lion-card p-6 w-full max-w-sm mb-8 animate-scale-in">
          <div className="flex items-center gap-4 mb-4">
            <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center border", colors)}>
              <Icon className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-display font-bold text-foreground">{exercise.name}</h3>
              <p className="text-sm text-muted-foreground capitalize">{exercise.category}</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
            <span className="text-sm text-muted-foreground">Base LP</span>
            <span className="text-xl font-display font-bold text-primary">+{baseLp}</span>
          </div>
        </div>

        {/* Step Content */}
        {step === 'start' && (
          <div className="text-center animate-fade-in">
            <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
              <Play className="w-12 h-12 text-primary" />
            </div>
            <h3 className="text-2xl font-display font-bold text-foreground mb-2">Ready?</h3>
            <p className="text-muted-foreground mb-8">Complete the exercise, then choose your proof type</p>
            <Button variant="hero" size="xl" onClick={() => setStep('proof')}>
              <Play className="w-5 h-5" />
              Start Exercise
            </Button>
          </div>
        )}

        {step === 'proof' && (
          <div className="w-full max-w-sm space-y-4 animate-fade-in">
            <h3 className="text-xl font-display font-bold text-foreground text-center mb-6">
              Choose Proof Type
            </h3>

            {/* Photo Option */}
            <button
              onClick={() => handleFileSelect('photo')}
              className="lion-card p-4 w-full flex items-center gap-4 hover:ring-2 hover:ring-primary transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-endurance/20 flex items-center justify-center">
                <Camera className="w-6 h-6 text-endurance" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-foreground">Photo Proof</p>
                <p className="text-sm text-muted-foreground">Take a photo of your exercise</p>
              </div>
              <div className="flex items-center gap-1 text-primary">
                <Zap className="w-4 h-4" />
                <span className="font-display font-bold">+{PROOF_BONUS_LP}</span>
              </div>
            </button>

            {/* Video Option */}
            <button
              onClick={() => handleFileSelect('video')}
              className="lion-card p-4 w-full flex items-center gap-4 hover:ring-2 hover:ring-primary transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-mobility/20 flex items-center justify-center">
                <Video className="w-6 h-6 text-mobility" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-foreground">Video Proof</p>
                <p className="text-sm text-muted-foreground">15 seconds max</p>
              </div>
              <div className="flex items-center gap-1 text-primary">
                <Zap className="w-4 h-4" />
                <span className="font-display font-bold">+{PROOF_BONUS_LP}</span>
              </div>
            </button>

            {/* No Proof Option */}
            <button
              onClick={handleNoProof}
              disabled={!canSkipProof()}
              className={cn(
                "lion-card p-4 w-full flex items-center gap-4 transition-all",
                canSkipProof() 
                  ? "hover:ring-2 hover:ring-muted-foreground" 
                  : "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <Ban className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-foreground">No Proof</p>
                <p className="text-sm text-muted-foreground">
                  {noProofRemaining} of {3} remaining in this cycle
                </p>
              </div>
              {!canSkipProof() && (
                <AlertTriangle className="w-5 h-5 text-destructive" />
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {step === 'finish' && (
          <div className="w-full max-w-sm space-y-6 animate-fade-in">
            <h3 className="text-xl font-display font-bold text-foreground text-center">
              Confirm Completion
            </h3>

            {/* Proof Preview */}
            {proofPreview && proofType !== 'none' && (
              <div className="relative rounded-xl overflow-hidden border border-border">
                {proofType === 'photo' ? (
                  <img 
                    src={proofPreview} 
                    alt="Proof" 
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <video 
                    src={proofPreview} 
                    className="w-full h-48 object-cover"
                    controls
                  />
                )}
                <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
                  +{PROOF_BONUS_LP} Bonus
                </div>
              </div>
            )}

            {proofType === 'none' && (
              <div className="lion-card p-4 flex items-center gap-3">
                <Ban className="w-6 h-6 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">No Proof Selected</p>
                  <p className="text-sm text-muted-foreground">No bonus LP for this exercise</p>
                </div>
              </div>
            )}

            {/* LP Summary */}
            <div className="lion-card p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base LP</span>
                <span className="font-display font-bold text-foreground">+{baseLp}</span>
              </div>
              {proofType !== 'none' && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Proof Bonus</span>
                  <span className="font-display font-bold text-primary">+{PROOF_BONUS_LP}</span>
                </div>
              )}
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="font-medium text-foreground">Total</span>
                <span className="text-xl font-display font-bold text-primary">
                  +{proofType !== 'none' ? lpWithProof : baseLp} LP
                </span>
              </div>
            </div>

            <Button 
              variant="hero" 
              size="xl" 
              className="w-full"
              onClick={handleFinish}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Finish Training
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
