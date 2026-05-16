import { exerciseInstructions } from '@/lib/exerciseDetectors';
import { Camera, MapPin, Lightbulb } from 'lucide-react';

interface ExerciseInstructionsProps {
  exerciseName: string;
}

export function ExerciseInstructions({ exerciseName }: ExerciseInstructionsProps) {
  const key = exerciseName.toLowerCase();
  const instructions = exerciseInstructions[key];
  
  if (!instructions) return null;

  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/50">
        <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-medium text-foreground">Positioning</p>
          <p className="text-xs text-muted-foreground">{instructions.positioning}</p>
        </div>
      </div>
      
      <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/50">
        <Camera className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-medium text-foreground">Camera Setup</p>
          <p className="text-xs text-muted-foreground">{instructions.cameraGuide}</p>
        </div>
      </div>
      
      <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/50">
        <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-medium text-foreground">Tips</p>
          <ul className="text-xs text-muted-foreground list-disc list-inside">
            {instructions.tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
