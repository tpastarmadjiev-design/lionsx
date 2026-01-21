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
      navigate('/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
      {/* Ambient glow behind symbol */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[200px] h-[200px] bg-white/[0.04] rounded-full blur-2xl pointer-events-none" />
      
      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-6">
        {/* Symbol - The emotional core with pulsing glow */}
        <div className="mb-8 animate-fade-in">
          <div className="relative flex items-center justify-center">
            {/* Pulsing glow effect */}
            <div 
              className="absolute w-64 h-64 rounded-full blur-3xl animate-[pulse-glow_4s_ease-in-out_infinite]"
              style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)' }}
            />
            <div 
              className="absolute w-40 h-40 rounded-full blur-2xl animate-[pulse-glow_4s_ease-in-out_infinite_0.5s]"
              style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)' }}
            />
            {/* SVG Symbol - 3 angular shapes like the logo */}
            <svg 
              viewBox="0 0 100 160" 
              className="w-40 h-56 drop-shadow-[0_0_40px_rgba(255,255,255,0.12)]"
              fill="none"
              stroke="white"
              strokeWidth="10"
              strokeLinecap="butt"
              strokeLinejoin="miter"
            >
              {/* Top right-pointing arrow */}
              <path d="M25,15 L75,40 L25,65" />
              {/* Middle connector going down-left */}
              <path d="M75,40 L75,95" />
              {/* Bottom left-pointing arrow */}
              <path d="M75,95 L25,120 L75,145" />
            </svg>
          </div>
        </div>

        {/* Brand text */}
        <h1 
          className="text-4xl font-display font-bold text-white tracking-[0.3em] mb-1 animate-fade-in"
          style={{ animationDelay: '0.1s' }}
        >
          LIONSX
        </h1>
        <p 
          className="text-sm text-white/40 tracking-[0.4em] uppercase mb-12 animate-fade-in"
          style={{ animationDelay: '0.15s' }}
        >
          Train · Rank · Become
        </p>

        {/* Login Form - integrated into the environment */}
        <form 
          onSubmit={handleSubmit} 
          className="w-full space-y-4 animate-fade-in"
          style={{ animationDelay: '0.2s' }}
        >
          {errors.general && (
            <div className="text-center text-red-400/80 text-sm py-2">
              {errors.general}
            </div>
          )}

          <div className="space-y-1">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-white/20 focus:bg-white/[0.05] transition-all rounded-lg"
            />
            {errors.email && <p className="text-red-400/70 text-xs pl-1">{errors.email}</p>}
          </div>

          <div className="space-y-1">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-white/20 focus:bg-white/[0.05] transition-all rounded-lg pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && <p className="text-red-400/70 text-xs pl-1">{errors.password}</p>}
          </div>

          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full h-12 bg-white text-black font-display font-semibold tracking-wider hover:bg-white/90 transition-all rounded-lg mt-2"
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
            className="w-full h-12 bg-transparent border border-white/[0.12] text-white/60 font-display tracking-wider hover:bg-white/[0.03] hover:text-white/80 hover:border-white/20 transition-all rounded-lg"
          >
            CREATE ACCOUNT
          </button>
        </form>
      </div>

      {/* Subtle bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
    </div>
  );
};

export default Index;
