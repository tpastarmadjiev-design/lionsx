import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import { COUNTRIES } from '@/lib/countries';

const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  nickname: z.string().min(2, 'Nickname must be at least 2 characters').max(20, 'Nickname too long'),
  country: z.string().min(2, 'Please select a country'),
});

export default function Auth() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [country, setCountry] = useState('');
  
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const result = signUpSchema.safeParse({ email, password, nickname, country });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
        setLoading(false);
        return;
      }

      const { error } = await signUp(email, password, nickname, country);
      if (error) {
        if (error.message.includes('already registered')) {
          setErrors({ email: 'This email is already registered' });
        } else {
          setErrors({ general: error.message });
        }
      } else {
        navigate('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />
      
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 text-white/40 hover:text-white/70 transition-colors flex items-center gap-2 z-20"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-display tracking-wider">BACK</span>
      </button>
      
      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-6">
        {/* Symbol with subtle glow */}
        <div className="mb-4 animate-fade-in">
          <div className="relative flex items-center justify-center">
            {/* Pulsing glow */}
            <div 
              className="absolute w-48 h-48 rounded-full blur-2xl animate-pulse-glow"
              style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)' }}
            />
            {/* SVG Symbol - Same zigzag pattern */}
            <svg 
              viewBox="0 0 60 100" 
              className="w-16 h-24 drop-shadow-[0_0_15px_rgba(255,255,255,0.08)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="square"
              strokeLinejoin="miter"
              style={{ color: 'hsl(var(--foreground))' }}
            >
              {/* Top horizontal */}
              <path d="M8,8 L52,8" />
              {/* Diagonal down-left */}
              <path d="M52,8 L8,35" />
              {/* Vertical connector */}
              <path d="M8,35 L8,50" />
              {/* Diagonal down-right */}
              <path d="M8,50 L52,77" />
              {/* Bottom vertical + horizontal */}
              <path d="M52,77 L52,92" />
              <path d="M52,92 L8,92" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 
          className="text-2xl font-display font-bold text-white tracking-[0.2em] mb-1 animate-fade-in"
          style={{ animationDelay: '0.1s' }}
        >
          JOIN LIONSX
        </h1>
        <p 
          className="text-xs text-white/30 tracking-[0.3em] uppercase mb-8 animate-fade-in"
          style={{ animationDelay: '0.15s' }}
        >
          Begin Your Journey
        </p>

        {/* Sign Up Form */}
        <form 
          onSubmit={handleSubmit} 
          className="w-full space-y-3 animate-fade-in"
          style={{ animationDelay: '0.2s' }}
        >
          {errors.general && (
            <div className="text-center text-red-400/80 text-sm py-2 bg-red-500/5 rounded-lg border border-red-500/10">
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

          <div className="space-y-1">
            <Input
              type="text"
              placeholder="Nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="h-12 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-white/20 focus:bg-white/[0.05] transition-all rounded-lg"
            />
            {errors.nickname && <p className="text-red-400/70 text-xs pl-1">{errors.nickname}</p>}
          </div>

          <div className="space-y-1">
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="h-12 bg-white/[0.03] border-white/[0.08] text-white focus:border-white/20 focus:bg-white/[0.05] transition-all rounded-lg [&>span]:text-white/30 [&[data-state=open]>span]:text-white [&>span[data-placeholder]]:text-white/30">
                <SelectValue placeholder="Select Country" />
              </SelectTrigger>
              <SelectContent className="bg-black/95 border-white/10 max-h-60">
                {COUNTRIES.map((c) => (
                  <SelectItem 
                    key={c.code} 
                    value={c.name}
                    className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white"
                  >
                    {c.flag} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.country && <p className="text-red-400/70 text-xs pl-1">{errors.country}</p>}
          </div>

          <Button 
            type="submit" 
            disabled={loading}
            className="w-full h-12 bg-white text-black font-display font-semibold tracking-wider hover:bg-white/90 transition-all rounded-lg mt-4"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'CREATE ACCOUNT'
            )}
          </Button>
        </form>

        <p className="mt-8 text-xs text-white/20 text-center">
          Already have an account?{' '}
          <button
            onClick={() => navigate('/')}
            className="text-white/50 hover:text-white/80 transition-colors underline underline-offset-2"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
