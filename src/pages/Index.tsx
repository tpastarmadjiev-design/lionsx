import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Crown, Dumbbell, TrendingUp, Users } from 'lucide-react';
import { useEffect } from 'react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const features = [
    {
      icon: Dumbbell,
      title: 'Train Hard',
      description: 'Complete exercises to earn LP and level up your skills',
    },
    {
      icon: TrendingUp,
      title: 'Rise in Ranks',
      description: 'From Bronze to Lion - climb the ranks and prove your worth',
    },
    {
      icon: Users,
      title: 'Track Progress',
      description: 'Monitor your strength, endurance, and mobility growth',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        {/* Logo */}
        <div className="animate-float mb-6">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center lion-glow">
            <Crown className="w-14 h-14 text-primary-foreground" />
          </div>
        </div>

        <h1 className="text-5xl font-display font-bold text-foreground tracking-wide mb-2 animate-fade-in">
          LION
        </h1>
        <p className="text-xl text-primary font-display tracking-widest mb-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          SYSTEM
        </p>
        
        <p className="text-muted-foreground max-w-sm mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          Train. Earn LP. Rise through the ranks. Become the Lion you were meant to be.
        </p>

        <Button 
          variant="hero" 
          size="xl" 
          className="animate-fade-in"
          style={{ animationDelay: '0.3s' }}
          onClick={() => navigate('/auth')}
        >
          <Crown className="w-5 h-5" />
          Begin Your Journey
        </Button>
      </div>

      {/* Features */}
      <div className="p-6 pb-12">
        <div className="space-y-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div 
                key={feature.title}
                className="lion-card p-4 flex items-center gap-4 animate-slide-up"
                style={{ animationDelay: `${0.4 + index * 0.1}s` }}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Index;
