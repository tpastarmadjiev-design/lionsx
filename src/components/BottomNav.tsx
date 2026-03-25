import { Home, Dumbbell, User, LogOut, Shield, Trophy, Heart } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { cn } from '@/lib/utils';
import { SocialLinksModal } from '@/components/SocialLinksModal';

export function BottomNav() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const [socialOpen, setSocialOpen] = useState(false);

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Home' },
    { path: '/training', icon: Dumbbell, label: 'Train' },
    { path: '/ranks', icon: Trophy, label: 'Ranks' },
    { path: '/profile', icon: User, label: 'Profile' },
    { path: '__social__', icon: Heart, label: 'Follow' },
    ...(isAdmin ? [{ path: '/admin', icon: Shield, label: 'Admin' }] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
      <div className="flex items-center justify-around py-2 px-2 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200',
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive && 'animate-scale-in')} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={signOut}
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 text-muted-foreground hover:text-destructive"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-xs font-medium">Logout</span>
        </button>
      </div>
    </nav>
  );
}
