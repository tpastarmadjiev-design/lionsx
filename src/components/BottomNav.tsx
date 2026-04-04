import { Home, Dumbbell, User, LogOut, Trophy } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const location = useLocation();
  const { signOut } = useAuth();

  const leftItems = [
    { path: '/dashboard', icon: Home, label: 'Home' },
    { path: '/ranks', icon: Trophy, label: 'Ranks' },
  ];

  const rightItems = [
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  const isTrainActive = location.pathname === '/training';

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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
      <div className="flex items-center justify-around py-2 px-2 max-w-lg mx-auto relative">
        {/* Left items */}
        {leftItems.map(renderNavItem)}

        {/* Center Train FAB */}
        <Link
          to="/training"
          className={cn(
            'absolute left-1/2 -translate-x-1/2 -top-5 flex flex-col items-center justify-center',
            'w-16 h-16 rounded-full shadow-lg transition-all duration-200',
            'bg-primary text-primary-foreground hover:scale-105',
            isTrainActive && 'ring-2 ring-primary ring-offset-2 ring-offset-card'
          )}
          style={{ boxShadow: 'var(--shadow-glow)' }}
        >
          <Dumbbell className="w-7 h-7" />
          <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">Train</span>
        </Link>

        {/* Spacer for center button */}
        <div className="w-16" />

        {/* Right items */}
        {rightItems.map(renderNavItem)}

        {/* Logout */}
        <button
          onClick={signOut}
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 text-muted-foreground hover:text-destructive min-w-[56px]"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[10px] font-medium">Logout</span>
        </button>
      </div>
    </nav>
  );
}
