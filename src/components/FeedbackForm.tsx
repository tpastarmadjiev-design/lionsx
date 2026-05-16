import { useState } from 'react';
import { MessageSquare, Star, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="lion-card mt-4 w-full p-4 flex items-center gap-3 animate-fade-in hover:bg-secondary/50 transition-colors"
        style={{ animationDelay: '0.4s' }}
      >
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-primary" />
        </div>
        <div className="text-left">
          <p className="font-display font-semibold text-foreground">Send Feedback</p>
          <p className="text-xs text-muted-foreground">Help us improve Lions-X</p>
        </div>
      </button>

      {isOpen && <FeedbackModal onClose={() => setIsOpen(false)} />}
    </>
  );
}

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [whatLiked, setWhatLiked] = useState('');
  const [bugs, setBugs] = useState('');
  const [improvements, setImprovements] = useState('');
  const [rating, setRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('feedback' as any).insert({
        user_id: user?.id,
        what_liked: whatLiked || null,
        bugs: bugs || null,
        improvements: improvements || null,
        rating,
      });
      if (error) throw error;
      toast.success('Thank you for your feedback!', { duration: 2000 });
      onClose();
    } catch (err) {
      console.error('Feedback error:', err);
      toast.error('Failed to send feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary">
          <X className="w-6 h-6 text-muted-foreground" />
        </button>
        <h2 className="text-lg font-display font-semibold text-foreground">Send Feedback</h2>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Rating */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Rate your experience *
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className="p-1"
              >
                <Star
                  className={`w-8 h-8 transition-colors ${
                    star <= rating
                      ? 'text-primary fill-primary'
                      : 'text-muted-foreground/30'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* What liked */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            What did you like?
          </label>
          <textarea
            value={whatLiked}
            onChange={(e) => setWhatLiked(e.target.value)}
            placeholder="Tell us what worked well..."
            className="w-full h-24 rounded-lg bg-secondary/50 border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Bugs */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Any bugs or issues?
          </label>
          <textarea
            value={bugs}
            onChange={(e) => setBugs(e.target.value)}
            placeholder="Describe any problems you encountered..."
            className="w-full h-24 rounded-lg bg-secondary/50 border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Improvements */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            What would you improve?
          </label>
          <textarea
            value={improvements}
            onChange={(e) => setImprovements(e.target.value)}
            placeholder="Share your ideas and suggestions..."
            className="w-full h-24 rounded-lg bg-secondary/50 border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || rating === 0}
          className="w-full gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send Feedback
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
