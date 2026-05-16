import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getRank } from '@/lib/ranks';
import { getCountryFlag } from '@/lib/countryFlags';
import { getDivisionInfo } from '@/lib/divisions';
import { Star, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserProfile {
  id: string;
  nickname: string;
  country: string;
  lp: number;
  strength?: number;
  endurance?: number;
  mobility?: number;
  avatar_url?: string | null;
}

interface UserProfileModalProps {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfileModal({ user, open, onOpenChange }: UserProfileModalProps) {
  if (!user) return null;

  const rank = getRank(user.lp);
  const divisionInfo = getDivisionInfo(user.lp);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">Player Profile</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center py-4">
          {/* Avatar */}
          <div className="relative mb-4">
            {user.avatar_url ? (
              <img 
                src={user.avatar_url} 
                alt={user.nickname}
                className="w-24 h-24 rounded-2xl object-cover lion-glow"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center lion-glow">
                <span className="text-4xl font-display font-bold text-primary-foreground">
                  {user.nickname.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className={`absolute -bottom-2 -right-2 w-12 h-12 rounded-xl ${rank.bgClass} flex items-center justify-center shadow-lg`}>
              <span className="text-xl">{rank.icon}</span>
            </div>
          </div>

          {/* Name & Country */}
          <h2 className="text-2xl font-display font-bold text-foreground">{user.nickname}</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {getCountryFlag(user.country)} {user.country}
          </p>

          {/* Rank & Stars */}
          <div className="mt-4 flex flex-col items-center">
            <p className={`text-xl font-display font-semibold ${rank.textClass}`}>{rank.name}</p>
            {!divisionInfo.isMaxRank && (
              <div className="flex gap-1 mt-2">
                {[1, 2, 3].map((starNum) => (
                  <Star
                    key={starNum}
                    className={cn(
                      "w-5 h-5",
                      starNum <= divisionInfo.stars 
                        ? 'text-yellow-400 fill-yellow-400' 
                        : 'text-muted-foreground/30'
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          {/* LP */}
          <div className="mt-4 flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10">
            <Trophy className="w-5 h-5 text-primary" />
            <span className="text-xl font-display font-bold text-foreground">
              {user.lp.toLocaleString()} LP
            </span>
          </div>

          {/* Stats */}
          {(user.strength !== undefined || user.endurance !== undefined || user.mobility !== undefined) && (
            <div className="mt-6 w-full grid grid-cols-3 gap-2">
              <div className="p-3 rounded-lg bg-strength/10 text-center">
                <p className="text-xs text-muted-foreground">Strength</p>
                <p className="text-lg font-display font-bold text-strength">
                  {(user.strength || 0).toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-endurance/10 text-center">
                <p className="text-xs text-muted-foreground">Endurance</p>
                <p className="text-lg font-display font-bold text-endurance">
                  {(user.endurance || 0).toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-mobility/10 text-center">
                <p className="text-xs text-muted-foreground">Mobility</p>
                <p className="text-lg font-display font-bold text-mobility">
                  {(user.mobility || 0).toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
