import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background pb-20">
      {title && (
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
          <div className="container px-4 py-4">
            <h1 className="text-2xl font-display font-bold text-foreground">{title}</h1>
          </div>
        </header>
      )}
      <main className="container px-4 py-6">{children}</main>
      <BottomNav />
    </div>
  );
}
