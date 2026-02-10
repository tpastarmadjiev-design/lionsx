import { getRank } from '@/lib/ranks';
import { Edit2, Users, TrendingUp, Activity, ClipboardCheck, Search, BarChart3, Database, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { AdminAnalytics } from '@/components/admin/AdminAnalytics';
import { AdminDeepMetrics } from '@/components/admin/AdminDeepMetrics';
import { AdminSuspiciousActivity } from '@/components/admin/AdminSuspiciousActivity';

interface UserProfile {
  id: string;
  nickname: string;
  email: string | null;
  country: string;
  lp: number;
  strength: number;
  endurance: number;
  mobility: number;
}

interface DashboardStats {
  totalUsers: number;
  activeUsersToday: number;
  sessionsStartedToday: number;
  sessionsCompletedToday: number;
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
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsersToday: 0,
    sessionsStartedToday: 0,
    sessionsCompletedToday: 0,
  });

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
      fetchStats();
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

  const fetchStats = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { data: todayLogs } = await supabase
      .from('training_logs')
      .select('user_id, completed_at')
      .gte('completed_at', todayISO);

    const uniqueUsersToday = new Set(todayLogs?.map(log => log.user_id) || []);
    const sessionsToday = todayLogs?.length || 0;

    setStats({
      totalUsers: totalUsers || 0,
      activeUsersToday: uniqueUsersToday.size,
      sessionsStartedToday: sessionsToday,
      sessionsCompletedToday: sessionsToday,
    });
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
    (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
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

  return (
    <AppLayout title="Admin Panel">
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="dashboard" className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-1">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="deep-metrics" className="flex items-center gap-1">
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">Deep Metrics</span>
          </TabsTrigger>
          <TabsTrigger value="suspicious" className="flex items-center gap-1">
            <ShieldAlert className="w-4 h-4" />
            <span className="hidden sm:inline">Suspicious</span>
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="lion-card p-4 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Total Users</span>
              </div>
              <p className="text-2xl font-display font-bold text-foreground">{stats.totalUsers}</p>
            </div>
            <div className="lion-card p-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-accent" />
                <span className="text-xs text-muted-foreground">Active Today</span>
              </div>
              <p className="text-2xl font-display font-bold text-foreground">{stats.activeUsersToday}</p>
            </div>
            <div className="lion-card p-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-strength" />
                <span className="text-xs text-muted-foreground">Sessions Started</span>
              </div>
              <p className="text-2xl font-display font-bold text-foreground">{stats.sessionsStartedToday}</p>
            </div>
            <div className="lion-card p-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div className="flex items-center gap-2 mb-2">
                <ClipboardCheck className="w-4 h-4 text-endurance" />
                <span className="text-xs text-muted-foreground">Sessions Completed</span>
              </div>
              <p className="text-2xl font-display font-bold text-foreground">{stats.sessionsCompletedToday}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
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
                        <p className="text-xs text-muted-foreground">{userProfile.email || userProfile.country}</p>
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
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <AdminAnalytics />
        </TabsContent>

        {/* Deep Metrics Tab */}
        <TabsContent value="deep-metrics">
          <AdminDeepMetrics />
        </TabsContent>

        {/* Suspicious Activity Tab */}
        <TabsContent value="suspicious">
          <AdminSuspiciousActivity />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
