import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { z } from 'zod';

const signInSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Required'),
});

const Index = () => {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    const { error } = await signIn(email, password);
    setIsSubmitting(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setErrors({ general: 'Invalid credentials' });
      } else {
        setErrors({ general: error.message });
      }
    } else {
      // Trigger the symbol open animation
      setIsTransitioning(true);
      // Navigate after animation completes
      setTimeout(() => {
        navigate('/dashboard');
      }, 800);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      {/* Static ambient background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-foreground/[0.02] rounded-full blur-3xl pointer-events-none" />
      
      {/* Main content container */}
      <div className={`relative z-10 flex flex-col items-center w-full max-w-sm px-6 ${isTransitioning ? 'pointer-events-none' : ''}`}>
        
        {/* Symbol Container - The emotional core */}
        <div className="mb-6 relative flex items-center justify-center">
          {/* Pulsing glow layers - subtle aura */}
          <div 
            className={`absolute w-72 h-72 rounded-full blur-3xl pointer-events-none ${
              isTransitioning ? 'animate-symbol-glow-expand' : 'animate-pulse-glow'
            }`}
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)' }}
          />
          <div 
            className={`absolute w-48 h-48 rounded-full blur-2xl pointer-events-none ${
              isTransitioning ? 'animate-symbol-glow-expand' : 'animate-pulse-glow'
            }`}
            style={{ 
              background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 60%)',
              animationDelay: '0.5s'
            }}
          />
          
          {/* SVG Symbol - Exact pattern from reference image */}
          <div className="relative w-28 h-44 flex items-center justify-center">
            {/* Top half - for split animation */}
            <svg 
              viewBox="0 0 60 100" 
              className={`absolute w-28 h-44 drop-shadow-[0_0_20px_rgba(255,255,255,0.1)] ${
                isTransitioning ? 'animate-symbol-open-top' : ''
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="square"
              strokeLinejoin="miter"
              style={{ color: 'hsl(var(--foreground))' }}
            >
              {/* Top horizontal: left to right */}
              <path d="M8,8 L52,8" />
              {/* Diagonal: top-right to bottom-left */}
              <path d="M52,8 L8,35" />
              {/* Short vertical down on left side */}
              <path d="M8,35 L8,50" />
            </svg>
            
            {/* Bottom half - for split animation */}
            <svg 
              viewBox="0 0 60 100" 
              className={`absolute w-28 h-44 drop-shadow-[0_0_20px_rgba(255,255,255,0.1)] ${
                isTransitioning ? 'animate-symbol-open-bottom' : ''
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="square"
              strokeLinejoin="miter"
              style={{ color: 'hsl(var(--foreground))' }}
            >
              {/* Diagonal: left to bottom-right */}
              <path d="M8,50 L52,77" />
              {/* Short vertical down on right side */}
              <path d="M52,77 L52,92" />
              {/* Bottom horizontal: right to left */}
              <path d="M52,92 L8,92" />
            </svg>
          </div>
        </div>

        {/* Brand text */}
        <h1 
          className={`text-4xl font-display font-bold text-foreground tracking-[0.3em] mb-1 ${
            isTransitioning ? 'animate-fade-out-up' : 'animate-fade-in'
          }`}
          style={{ animationDelay: isTransitioning ? '0s' : '0.1s' }}
        >
          LIONSX
        </h1>
        <p 
          className={`text-sm text-muted-foreground tracking-[0.4em] uppercase mb-10 ${
            isTransitioning ? 'animate-fade-out-up' : 'animate-fade-in'
          }`}
          style={{ animationDelay: isTransitioning ? '0.05s' : '0.15s' }}
        >
          Train · Rank · Become
        </p>

        {/* Login Form */}
        <form 
          onSubmit={handleSubmit} 
          className={`w-full space-y-4 ${isTransitioning ? 'animate-fade-out-up' : 'animate-fade-in'}`}
          style={{ animationDelay: isTransitioning ? '0.1s' : '0.2s' }}
        >
          {errors.general && (
            <div className="text-center text-destructive/80 text-sm py-2">
              {errors.general}
            </div>
          )}

          <div className="space-y-1">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 bg-foreground/[0.03] border-foreground/[0.1] text-foreground placeholder:text-muted-foreground/50 focus:border-foreground/25 focus:bg-foreground/[0.05] transition-all rounded-lg"
            />
            {errors.email && <p className="text-destructive/70 text-xs pl-1">{errors.email}</p>}
          </div>

          <div className="space-y-1">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 bg-foreground/[0.03] border-foreground/[0.1] text-foreground placeholder:text-muted-foreground/50 focus:border-foreground/25 focus:bg-foreground/[0.05] transition-all rounded-lg pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && <p className="text-destructive/70 text-xs pl-1">{errors.password}</p>}
          </div>

          <Button 
            type="submit" 
            disabled={isSubmitting || isTransitioning}
            className="w-full h-12 bg-foreground text-background font-display font-semibold tracking-wider hover:bg-foreground/90 transition-all rounded-lg mt-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'ENTER THE SYSTEM'
            )}
          </Button>

          <button
            type="button"
            onClick={() => navigate('/auth')}
            disabled={isTransitioning}
            className="w-full h-12 bg-transparent border border-foreground/[0.12] text-muted-foreground font-display tracking-wider hover:bg-foreground/[0.03] hover:text-foreground/80 hover:border-foreground/20 transition-all rounded-lg"
          >
            CREATE ACCOUNT
          </button>
        </form>
      </div>

      {/* Bottom subtle gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background/50 to-transparent pointer-events-none" />
      
      {/* Portal reveal overlay - appears during transition */}
      {isTransitioning && (
        <div className="fixed inset-0 z-50 bg-background animate-portal-reveal" />
      )}
    </div>
  );
};

export default Index;
