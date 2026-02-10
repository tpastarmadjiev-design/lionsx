import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface SuspiciousActivityWarningProps {
  open: boolean;
  onClose: () => void;
}

export function SuspiciousActivityWarning({ open, onClose }: SuspiciousActivityWarningProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-yellow-500">
            <AlertTriangle className="w-5 h-5" />
            Unusual Movement Detected
          </DialogTitle>
          <DialogDescription className="pt-2 space-y-3 text-sm">
            <p>
              Your movement pattern seems irregular or too fast to be natural.
              Please try to perform the exercise correctly so your points stay valid.
            </p>
            <p className="italic text-muted-foreground">
              Remember: the one who tries to cheat is actually cheating themselves.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose} className="w-full">OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
