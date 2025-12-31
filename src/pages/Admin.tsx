import { getRank } from '@/lib/ranks';
import { Crown, Edit2, Users, TrendingUp, Dumbbell, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  nickname: string;
  country: string;
  lp: number;
  strength: number;
  endurance: number;
  mobility: number;
}

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editLP, setEditLP] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    
    if (!adminLoading && !isAdmin) {
      navigate('/dashboard');
      toast.error('Admin access required');
      return;
    }
  }, [user, authLoading, isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('lp', { ascending: false });

    if (error) {
      toast.error('Failed to fetch users');
      console.error(error);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const handleUpdateLP = async (userId: string, newLP: number) => {
    const { error } = await supabase
      .from('profiles')
      .update({ lp: newLP })
      .eq('id', userId);

    if (error) {
      toast.error('Failed to update LP');
    } else {
      toast.success('LP updated successfully');
      setEditingUser(null);
      setEditLP('');
      fetchUsers();
    }
  };

  const filteredUsers = users.filter((u) =>
    u.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.country.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-display text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const totalLP = users.reduce((sum, u) => sum + u.lp, 0);

  return (
    <AppLayout title="Admin Panel">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="lion-card p-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Users</span>
          </div>
          <p className="text-2xl font-display font-bold text-foreground">{users.length}</p>
        </div>
        <div className="lion-card p-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-accent" />
            <span className="text-xs text-muted-foreground">Total LP</span>
          </div>
          <p className="text-2xl font-display font-bold text-foreground">{totalLP.toLocaleString()}</p>
        </div>
        <div className="lion-card p-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-2 mb-2">
            <Dumbbell className="w-4 h-4 text-strength" />
            <span className="text-xs text-muted-foreground">Exercises</span>
          </div>
          <p className="text-2xl font-display font-bold text-foreground">15</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-11"
        />
      </div>

      {/* Users List */}
      <div className="space-y-2">
        {filteredUsers.map((userProfile, index) => {
          const rank = getRank(userProfile.lp);
          const isEditing = editingUser?.id === userProfile.id;

          return (
            <div 
              key={userProfile.id} 
              className="lion-card p-4 animate-fade-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${rank.bgClass} flex items-center justify-center`}>
                    <span className="text-lg">{rank.icon}</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{userProfile.nickname}</p>
                    <p className="text-xs text-muted-foreground">{userProfile.country}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={editLP}
                        onChange={(e) => setEditLP(e.target.value)}
                        className="w-24 h-9"
                        placeholder="LP"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleUpdateLP(userProfile.id, parseInt(editLP) || 0)}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingUser(null);
                          setEditLP('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="text-right">
                        <p className={`text-lg font-display font-bold ${rank.textClass}`}>
                          {userProfile.lp.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">{rank.name}</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingUser(userProfile);
                          setEditLP(userProfile.lp.toString());
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
