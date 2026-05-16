import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface UserActivityMetrics {
  avgSessionDuration: string;
  avgDailyActiveUsers: number;
  retention7Day: number;
  retention30Day: number;
}

interface TrainingMetrics {
  popularExercises: { name: string; count: number }[];
  avgRepsPerMinute: { name: string; avg: number }[];
  totalRepsGlobal: number;
  lpPerDay: { date: string; lp: number }[];
}

interface CountryMetrics {
  usersPerCountry: { country: string; count: number }[];
  activePerCountry: { country: string; active: number }[];
}

export function AdminAnalytics() {
  const [userMetrics, setUserMetrics] = useState<UserActivityMetrics>({
    avgSessionDuration: 'Not tracked',
    avgDailyActiveUsers: 0,
    retention7Day: 0,
    retention30Day: 0,
  });
  const [trainingMetrics, setTrainingMetrics] = useState<TrainingMetrics>({
    popularExercises: [],
    avgRepsPerMinute: [],
    totalRepsGlobal: 0,
    lpPerDay: [],
  });
  const [countryMetrics, setCountryMetrics] = useState<CountryMetrics>({
    usersPerCountry: [],
    activePerCountry: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllMetrics();
  }, []);

  const fetchAllMetrics = async () => {
    setLoading(true);
    await Promise.all([
      fetchUserActivityMetrics(),
      fetchTrainingMetrics(),
      fetchCountryMetrics(),
    ]);
    setLoading(false);
  };

  const fetchUserActivityMetrics = async () => {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    // Get total users
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Get daily active users for last 7 days
    const { data: recentLogs } = await supabase
      .from('training_logs')
      .select('user_id, completed_at')
      .gte('completed_at', sevenDaysAgo.toISOString());

    // Calculate avg DAU
    const dailyUsers: Record<string, Set<string>> = {};
    recentLogs?.forEach(log => {
      const date = new Date(log.completed_at).toDateString();
      if (!dailyUsers[date]) dailyUsers[date] = new Set();
      dailyUsers[date].add(log.user_id);
    });
    const daysWithActivity = Object.keys(dailyUsers).length;
    const totalActiveUsers = Object.values(dailyUsers).reduce((sum, set) => sum + set.size, 0);
    const avgDAU = daysWithActivity > 0 ? Math.round(totalActiveUsers / daysWithActivity) : 0;

    // 7-day retention: users active in last 7 days
    const uniqueUsers7Days = new Set(recentLogs?.map(l => l.user_id) || []);
    const retention7 = totalUsers ? Math.round((uniqueUsers7Days.size / totalUsers) * 100) : 0;

    // 30-day retention
    const { data: monthLogs } = await supabase
      .from('training_logs')
      .select('user_id')
      .gte('completed_at', thirtyDaysAgo.toISOString());
    const uniqueUsers30Days = new Set(monthLogs?.map(l => l.user_id) || []);
    const retention30 = totalUsers ? Math.round((uniqueUsers30Days.size / totalUsers) * 100) : 0;

    // Calculate avg session duration from training_logs
    const { data: durationLogs } = await supabase
      .from('training_logs')
      .select('session_duration_seconds')
      .not('session_duration_seconds', 'is', null);

    let avgDuration = 'No data';
    if (durationLogs && durationLogs.length > 0) {
      const totalSeconds = durationLogs.reduce((sum, l) => sum + (l.session_duration_seconds || 0), 0);
      const avgSeconds = Math.round(totalSeconds / durationLogs.length);
      const mins = Math.floor(avgSeconds / 60);
      const secs = avgSeconds % 60;
      avgDuration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    }

    setUserMetrics({
      avgSessionDuration: avgDuration,
      avgDailyActiveUsers: avgDAU,
      retention7Day: retention7,
      retention30Day: retention30,
    });
  };

  const fetchTrainingMetrics = async () => {
    // Get all training logs with exercise info
    const { data: logs } = await supabase
      .from('training_logs')
      .select('exercise_id, lp_earned, completed_at');

    const { data: exercises } = await supabase
      .from('exercises')
      .select('id, name');

    const exerciseMap = new Map(exercises?.map(e => [e.id, e.name]) || []);

    // Count exercises
    const exerciseCounts: Record<string, number> = {};
    let totalLP = 0;
    const lpByDate: Record<string, number> = {};

    logs?.forEach(log => {
      const name = exerciseMap.get(log.exercise_id) || 'Unknown';
      exerciseCounts[name] = (exerciseCounts[name] || 0) + 1;
      totalLP += log.lp_earned;
      
      const date = new Date(log.completed_at).toLocaleDateString();
      lpByDate[date] = (lpByDate[date] || 0) + log.lp_earned;
    });

    const popularExercises = Object.entries(exerciseCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // LP per day (last 7 days)
    const lpPerDay = Object.entries(lpByDate)
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .slice(0, 7)
      .reverse()
      .map(([date, lp]) => ({ date, lp }));

    setTrainingMetrics({
      popularExercises,
      avgRepsPerMinute: [], // Would need rep count tracking
      totalRepsGlobal: logs?.length || 0, // Each log = 1 exercise session
      lpPerDay,
    });
  };

  const fetchCountryMetrics = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, country');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: todayLogs } = await supabase
      .from('training_logs')
      .select('user_id')
      .gte('completed_at', today.toISOString());

    const activeUserIds = new Set(todayLogs?.map(l => l.user_id) || []);

    // Users per country
    const countryUsers: Record<string, number> = {};
    const countryActive: Record<string, number> = {};

    profiles?.forEach(p => {
      countryUsers[p.country] = (countryUsers[p.country] || 0) + 1;
      if (activeUserIds.has(p.id)) {
        countryActive[p.country] = (countryActive[p.country] || 0) + 1;
      }
    });

    setCountryMetrics({
      usersPerCountry: Object.entries(countryUsers)
        .sort((a, b) => b[1] - a[1])
        .map(([country, count]) => ({ country, count })),
      activePerCountry: Object.entries(countryActive)
        .sort((a, b) => b[1] - a[1])
        .map(([country, active]) => ({ country, active })),
    });
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* User Activity Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">User Activity Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Avg Session Duration</TableCell>
                <TableCell>{userMetrics.avgSessionDuration}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Avg Daily Active Users (7d)</TableCell>
                <TableCell>{userMetrics.avgDailyActiveUsers}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">7-Day Retention</TableCell>
                <TableCell>{userMetrics.retention7Day}%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">30-Day Retention</TableCell>
                <TableCell>{userMetrics.retention30Day}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Training Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Training Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Total Training Sessions: <span className="font-bold text-foreground">{trainingMetrics.totalRepsGlobal}</span></p>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Most Popular Exercises</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exercise</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trainingMetrics.popularExercises.map(e => (
                  <TableRow key={e.name}>
                    <TableCell>{e.name}</TableCell>
                    <TableCell className="text-right">{e.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">LP Earned Per Day (Last 7 Days)</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">LP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trainingMetrics.lpPerDay.map(d => (
                  <TableRow key={d.date}>
                    <TableCell>{d.date}</TableCell>
                    <TableCell className="text-right">{d.lp}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Country Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Country-Based Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Users Per Country</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {countryMetrics.usersPerCountry.map(c => (
                  <TableRow key={c.country}>
                    <TableCell>{c.country}</TableCell>
                    <TableCell className="text-right">{c.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Active Users Today Per Country</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {countryMetrics.activePerCountry.length > 0 ? (
                  countryMetrics.activePerCountry.map(c => (
                    <TableRow key={c.country}>
                      <TableCell>{c.country}</TableCell>
                      <TableCell className="text-right">{c.active}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">No active users today</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
