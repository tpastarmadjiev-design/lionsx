import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Facebook, Instagram, Youtube } from 'lucide-react';

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.7a8.16 8.16 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.13z" />
  </svg>
);

const socialLinks = [
  { name: 'Facebook', icon: Facebook, url: 'https://www.facebook.com/profile.php?id=61587451220946&sk=followers', color: '#1877F2' },
  { name: 'Instagram', icon: Instagram, url: 'https://www.instagram.com/lionsxoriginal/', color: '#E4405F' },
  { name: 'TikTok', icon: TikTokIcon, url: 'https://www.tiktok.com/@lions_x_original', color: '#ffffff' },
  { name: 'YouTube', icon: Youtube, url: 'https://www.youtube.com/@Lions_X_original', color: '#FF0000' },
];

interface SocialLinksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SocialLinksModal({ open, onOpenChange }: SocialLinksModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-foreground font-display text-xl">
            Follow Us
          </DialogTitle>
          <p className="text-center text-muted-foreground text-sm">
            Join the Lions-X community
          </p>
        </DialogHeader>
        <div className="flex justify-around items-center py-6">
          {socialLinks.map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 group"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${link.color}20`, color: link.color }}
                >
                  <Icon />
                </div>
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                  {link.name}
                </span>
              </a>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
