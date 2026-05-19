import { Home, Dumbbell, User, LogOut, Trophy, Shield, Flame, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { cn } from '@/lib/utils';
import trainingCardBg from '@/assets/training-card-bg.jpg';

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const [expanded, setExpanded] = useState(false);

  // Close on route change
  useEffect(() => { setExpanded(false); }, [location.pathname]);

  const leftItems = [
    { path: '/dashboard', icon: Home, label: 'Home' },
    { path: '/ranks', icon: Trophy, label: 'Ranks' },
  ];

  const rightItems = [
    { path: '/profile', icon: User, label: 'Profile' },
    ...(isAdmin ? [{ path: '/admin', icon: Shield, label: 'Admin' }] : []),
  ];

  const isTrainActive = location.pathname === '/training' || location.pathname === '/challenges';

  const renderNavItem = (item: { path: string; icon: any; label: string }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    return (
      <Link
        key={item.path}
        to={item.path}
        className={cn(
          'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[56px]',
          isActive
            ? 'text-primary'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Icon className={cn('w-5 h-5', isActive && 'animate-scale-in')} />
        <span className="text-[10px] font-medium">{item.label}</span>
      </Link>
    );
  };

  const goTo = (path: string) => {
    setExpanded(false);
    navigate(path);
  };

  return (
    <>
      {/* Backdrop when expanded */}
      {expanded && (
        <div
          className="fixed inset-0 z-40 bg-background/40 animate-fade-in"
          onClick={() => setExpanded(false)}
        />
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
        <div className="flex items-center justify-around py-2 px-2 max-w-lg mx-auto relative">
          {leftItems.map(renderNavItem)}

          {/* Center Train FAB */}
          <button
            onClick={() => setExpanded(v => !v)}
            className={cn(
              'absolute left-1/2 -translate-x-1/2 -top-5 flex flex-col items-center justify-center',
              'w-16 h-16 rounded-full shadow-lg transition-all duration-300',
              'bg-teal-900 text-foreground hover:scale-105',
              expanded && 'rotate-90',
              isTrainActive && !expanded && 'ring-2 ring-teal-700 ring-offset-2 ring-offset-card'
            )}
            style={{ boxShadow: '0 0 20px rgba(13, 148, 136, 0.4)' }}
            aria-label="Open training menu"
          >
            {expanded ? (
              <X className="w-7 h-7" />
            ) : (
              <>
                <Dumbbell className="w-7 h-7" />
                <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">Train</span>
              </>
            )}
          </button>

          {/* Expanded options - two gradient cards */}
          {expanded && (
            <div className="absolute left-1/2 -translate-x-1/2 -top-44 flex gap-3 animate-scale-in origin-bottom">
              <button
                onClick={() => goTo('/training')}
                className="relative w-32 h-32 rounded-2xl overflow-hidden shadow-2xl active:scale-95 transition-transform"
              >
                <img src={trainingCardBg} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-teal-900/95 via-teal-900/50 to-transparent" />
                <div className="relative z-10 h-full flex flex-col justify-end items-center pb-3">
                  <Dumbbell className="w-7 h-7 text-foreground mb-1" />
                  <span className="text-sm font-display font-bold text-foreground">Training</span>
                </div>
              </button>
              <button
                onClick={() => goTo('/challenges')}
                className="relative w-32 h-32 rounded-2xl overflow-hidden shadow-2xl active:scale-95 transition-transform"
              >
                <img src={trainingCardBg} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-orange-900/95 via-rose-900/50 to-transparent" />
                <div className="relative z-10 h-full flex flex-col justify-end items-center pb-3">
                  <Flame className="w-7 h-7 text-foreground mb-1" />
                  <span className="text-sm font-display font-bold text-foreground">Challenge</span>
                </div>
              </button>
            </div>
          )}

          <div className="w-16" />

          {rightItems.map(renderNavItem)}

          <button
            onClick={signOut}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 text-muted-foreground hover:text-destructive min-w-[56px]"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-[10px] font-medium">Logout</span>
          </button>
        </div>
      </nav>
    </>
  );
}
