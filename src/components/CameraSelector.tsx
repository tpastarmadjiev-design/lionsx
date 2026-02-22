import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, SwitchCamera, Check, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CameraFacing = 'environment' | 'user';

interface CameraSelectorProps {
  onSelect: (facing: CameraFacing) => void;
  onCancel: () => void;
}

export function CameraSelector({ onSelect, onCancel }: CameraSelectorProps) {
  const [selected, setSelected] = useState<CameraFacing | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
      <div className="w-full max-w-sm space-y-6 animate-fade-in">
        {/* Title */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
            <SwitchCamera className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-display font-bold text-foreground">Choose Camera</h2>
          <p className="text-sm text-muted-foreground">Which camera would you like to use for this exercise?</p>
        </div>

        {/* Camera Options */}
        <div className="grid grid-cols-2 gap-3">
          {/* Rear Camera */}
          <button
            onClick={() => setSelected('environment')}
            className={cn(
              "relative flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all duration-200",
              "hover:scale-[1.03] active:scale-[0.98]",
              selected === 'environment'
                ? "border-primary bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.25)]"
                : "border-border bg-card hover:border-primary/40"
            )}
          >
            {selected === 'environment' && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
            <div className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center transition-colors",
              selected === 'environment' ? "bg-primary/20" : "bg-secondary"
            )}>
              <Camera className="w-7 h-7 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground text-sm">Rear Camera</p>
              <p className="text-xs text-muted-foreground mt-0.5">Recommended</p>
            </div>
          </button>

          {/* Front Camera */}
          <button
            onClick={() => setSelected('user')}
            className={cn(
              "relative flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all duration-200",
              "hover:scale-[1.03] active:scale-[0.98]",
              selected === 'user'
                ? "border-primary bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.25)]"
                : "border-border bg-card hover:border-primary/40"
            )}
          >
            {selected === 'user' && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
            <div className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center transition-colors",
              selected === 'user' ? "bg-primary/20" : "bg-secondary"
            )}>
              <SwitchCamera className="w-7 h-7 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground text-sm">Front Camera</p>
              <p className="text-xs text-muted-foreground mt-0.5">Mirrored view</p>
            </div>
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="hero"
            size="xl"
            className="flex-1"
            disabled={!selected}
            onClick={() => selected && onSelect(selected)}
          >
            <Play className="w-5 h-5" />
            Start Exercise
          </Button>
        </div>
      </div>
    </div>
  );
}
