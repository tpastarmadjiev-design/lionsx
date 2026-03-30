import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface ExerciseGifPreviewProps {
  exerciseName: string;
  gifUrl: string;
  onConfirm: () => void;
}

export function ExerciseGifPreview({ exerciseName, gifUrl, onConfirm }: ExerciseGifPreviewProps) {
  return (
    <div className="w-full max-w-sm space-y-6 animate-fade-in flex flex-col items-center">
      {/* GIF */}
      <div className="w-[80%] rounded-2xl overflow-hidden border border-border bg-secondary/30">
        <img
          src={gifUrl}
          alt={`${exerciseName} demonstration`}
          className="w-full h-auto object-contain"
          loading="eager"
        />
      </div>

      {/* Exercise name */}
      <h3 className="text-xl font-display font-bold text-foreground text-center">
        {exerciseName}
      </h3>

      {/* Got it button */}
      <Button
        variant="hero"
        size="xl"
        className="w-full"
        onClick={onConfirm}
      >
        <Check className="w-5 h-5" />
        Got it
      </Button>
    </div>
  );
}
