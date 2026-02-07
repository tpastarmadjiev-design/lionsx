import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RANKS, getRank } from '@/lib/ranks';

interface RankDistribution {
  rank: string;
  count: number;
  icon: string;
}

interface InactiveUser {
  nickname: string;
  country: string;
  lastActive: string;
}

export function AdminDeepMetrics() {
  const [rankDistribution, setRankDistribution] = useState<RankDistribution[]>([]);
  const [inactiveUsers, setInactiveUsers] = useState<InactiveUser[]>([]);
  const [weeklyImprovers, setWeeklyImprovers] = useState<number>(0);
  const [avgTimeToRankUp] = useState<string>('Not enough data');
  const [deviceMetrics, setDeviceMetrics] = useState<{ type: string; count: number }[]>([]);
  const [screenResolutions, setScreenResolutions] = useState<{ resolution: string; count: number }[]>([]);
  const [screenViews, setScreenViews] = useState<{ screen: string; count: number }[]>([]);
  const [avgDailyViews, setAvgDailyViews] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeepMetrics();
  }, []);

  const fetchDeepMetrics = async () => {
    setLoading(true);
    await Promise.all([
      fetchRankDistribution(),
      fetchInactiveUsers(),
      fetchWeeklyImprovers(),
      fetchDeviceMetrics(),
    ]);
    setLoading(false);
  };

  const fetchRankDistribution = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('lp');

    const distribution: Record<string, number> = {};
    RANKS.forEach(r => { distribution[r.name] = 0; });

    profiles?.forEach(p => {
      const rank = getRank(p.lp);
      distribution[rank.name] = (distribution[rank.name] || 0) + 1;
    });

    setRankDistribution(
      RANKS.map(r => ({
        rank: r.name,
        count: distribution[r.name] || 0,
        icon: r.icon,
      }))
    );
  };

  const fetchInactiveUsers = async () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nickname, country, updated_at');

    const { data: recentLogs } = await supabase
      .from('training_logs')
      .select('user_id')
      .gte('completed_at', sevenDaysAgo.toISOString());

    const activeUserIds = new Set(recentLogs?.map(l => l.user_id) || []);

    const inactive = profiles
      ?.filter(p => !activeUserIds.has(p.id))
      .map(p => ({
        nickname: p.nickname,
        country: p.country,
        lastActive: new Date(p.updated_at).toLocaleDateString(),
      })) || [];

    setInactiveUsers(inactive);
  };

  const fetchWeeklyImprovers = async () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { data: logs } = await supabase
      .from('training_logs')
      .select('user_id, lp_earned')
      .gte('completed_at', oneWeekAgo.toISOString());

    const usersWithGains = new Set(logs?.filter(l => l.lp_earned > 0).map(l => l.user_id) || []);
    
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const percentage = totalUsers ? Math.round((usersWithGains.size / totalUsers) * 100) : 0;
    setWeeklyImprovers(percentage);
  };

  const fetchDeviceMetrics = async () => {
    const { data: analytics } = await supabase
      .from('user_analytics')
      .select('device_type, screen_resolution, screen_name, user_id, viewed_at');

    if (!analytics || analytics.length === 0) {
      return;
    }

    // Device type distribution
    const deviceCounts: Record<string, number> = {};
    const resolutionCounts: Record<string, number> = {};
    const screenCounts: Record<string, number> = {};
    const dailyUserViews: Record<string, Set<string>> = {};

    analytics.forEach(a => {
      if (a.device_type) {
        deviceCounts[a.device_type] = (deviceCounts[a.device_type] || 0) + 1;
      }
      if (a.screen_resolution) {
        resolutionCounts[a.screen_resolution] = (resolutionCounts[a.screen_resolution] || 0) + 1;
      }
      if (a.screen_name) {
        screenCounts[a.screen_name] = (screenCounts[a.screen_name] || 0) + 1;
      }
      
      // Calculate daily views per user
      const date = new Date(a.viewed_at).toDateString();
      if (!dailyUserViews[a.user_id]) {
        dailyUserViews[a.user_id] = new Set();
      }
      dailyUserViews[a.user_id].add(date);
    });

    setDeviceMetrics(
      Object.entries(deviceCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ type, count }))
    );

    setScreenResolutions(
      Object.entries(resolutionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([resolution, count]) => ({ resolution, count }))
    );

    setScreenViews(
      Object.entries(screenCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([screen, count]) => ({ screen, count }))
    );

    // Average daily views
    const totalDays = Object.values(dailyUserViews).reduce((sum, dates) => sum + dates.size, 0);
    const totalUsersWithViews = Object.keys(dailyUserViews).length;
    setAvgDailyViews(totalUsersWithViews > 0 ? Math.round(totalDays / totalUsersWithViews * 10) / 10 : 0);
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading deep metrics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* User Progression Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">User Progression Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Avg Time to Rank Up</TableCell>
                <TableCell>{avgTimeToRankUp}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Users Who Improved This Week</TableCell>
                <TableCell>{weeklyImprovers}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          
          <div>
            <p className="text-sm font-medium mb-2">Rank Distribution</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankDistribution.map(r => (
                  <TableRow key={r.rank}>
                    <TableCell>
                      <span className="mr-2">{r.icon}</span>
                      {r.rank}
                    </TableCell>
                    <TableCell className="text-right">{r.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Engagement Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Engagement Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Avg Daily Screen Views Per User</TableCell>
                <TableCell>{avgDailyViews > 0 ? avgDailyViews : 'Not enough data'}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          
          {screenViews.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Time Spent Per Module (Views)</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Screen</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {screenViews.map(s => (
                    <TableRow key={s.screen}>
                      <TableCell className="capitalize">{s.screen}</TableCell>
                      <TableCell className="text-right">{s.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inactivity List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Inactive Users (7+ Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {inactiveUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-right">Last Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactiveUsers.slice(0, 20).map((u, i) => (
                  <TableRow key={i}>
                    <TableCell>{u.nickname}</TableCell>
                    <TableCell>{u.country}</TableCell>
                    <TableCell className="text-right">{u.lastActive}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">All users have been active recently!</p>
          )}
          {inactiveUsers.length > 20 && (
            <p className="text-xs text-muted-foreground mt-2">Showing 20 of {inactiveUsers.length} inactive users</p>
          )}
        </CardContent>
      </Card>

      {/* Device Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Device Level Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {deviceMetrics.length > 0 ? (
            <>
              <div>
                <p className="text-sm font-medium mb-2">Device Type Distribution</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deviceMetrics.map(d => (
                      <TableRow key={d.type}>
                        <TableCell className="capitalize">{d.type}</TableCell>
                        <TableCell className="text-right">{d.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {screenResolutions.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Screen Resolutions</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Resolution</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {screenResolutions.map(r => (
                        <TableRow key={r.resolution}>
                          <TableCell>{r.resolution}</TableCell>
                          <TableCell className="text-right">{r.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-center py-4">No device data collected yet</p>
          )}
        </CardContent>
      </Card>

      {/* Per-Exercise Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Per-Exercise Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Avg Reps Per User Level</TableCell>
                <TableCell className="text-muted-foreground">Tracked (data accumulating)</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Avg Improvement Over 7 Days</TableCell>
                <TableCell className="text-muted-foreground">Tracked (data accumulating)</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Exercise Difficulty Comparison</TableCell>
                <TableCell className="text-muted-foreground">Tracked (data accumulating)</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
