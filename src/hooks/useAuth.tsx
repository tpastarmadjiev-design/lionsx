import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { resetCameraPermissionFlag } from '@/components/TimedTrainingFlow';
import { gaEvents } from '@/lib/gtag';
import { saveUserTimezone } from '@/lib/analyticsTracker';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, nickname: string, country: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, nickname: string, country: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          nickname,
          country,
        },
      },
    });

    if (error) {
      return { error };
    }

    toast.success('Account created! Welcome to LION SYSTEM.');
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error };
    }

    gaEvents.login('email');
    
    // Save user timezone on login
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      saveUserTimezone(session.user.id);
    }
    
    toast.success('Welcome back, Lion!');
    return { error: null };
  };

  const signOut = async () => {
    resetCameraPermissionFlag();
    gaEvents.logout();
    // Clear popup throttle so it shows again on next login
    Object.keys(localStorage)
      .filter((k) => k.startsWith('challengePromoLastShown:'))
      .forEach((k) => localStorage.removeItem(k));
    await supabase.auth.signOut();
    toast.success('Signed out successfully');
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // During HMR, context can temporarily be undefined - return safe defaults
    // instead of crashing the entire app
    return {
      user: null,
      session: null,
      loading: true,
      signUp: async () => ({ error: new Error('Auth not ready') }),
      signIn: async () => ({ error: new Error('Auth not ready') }),
      signOut: async () => {},
    } as AuthContextType;
  }
  return context;
}
